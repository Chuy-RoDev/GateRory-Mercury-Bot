import { join } from "path";
import { promises as fs } from 'fs';

const charactersFilePath = join(process.cwd(), 'src', 'json', 'characters.json');
let charactersCache = null;
let lastCacheLoad = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function loadCharacters() {
    const now = Date.now();
    if (charactersCache && (now - lastCacheLoad) < CACHE_TTL) return charactersCache;
    const data = await fs.readFile(charactersFilePath, 'utf-8');
    charactersCache = JSON.parse(data);
    lastCacheLoad = now;
    return charactersCache;
}

function buscarSimilitud(nombre, lista) {
    const query = nombre.toLowerCase().trim();
    return lista.filter(c => c.name.toLowerCase().includes(query));
}

const COSTO_PROTECCION = 10000
const DURACION_PROTECCION = 24 * 60 * 60 * 1000

let handler = async (m, { conn, usedPrefix, command, text }) => {
    const ctxErr  = (global.rcanalx || {});
    const ctxWarn = (global.rcanalw || {});
    const ctxOk   = (global.rcanalr || {});
    const moneda  = global.currency

    try {
        const currentUserData = global.db?.data?.users?.[m.sender] || {};
        if (!Array.isArray(currentUserData.characters) || currentUserData.characters.length === 0) {
            return conn.reply(m.chat,
                `╭─「 🛡️ 𝗣𝗿𝗼𝘁𝗲𝗰𝗰𝗶ó𝗻 」\n` +
                `│ ꕤ No tienes ningún personaje\n` +
                `│ que proteger.\n` +
                `╰─────────────────`,
            m, ctxWarn);
        }

        const monedas = currentUserData.coin || 0
        if (monedas < COSTO_PROTECCION) {
            return conn.reply(m.chat,
                `╭─「 🛡️ 𝗣𝗿𝗼𝘁𝗲𝗰𝗰𝗶ó𝗻 」\n` +
                `│ ꕤ Saldo insuficiente.\n` +
                `│\n` +
                `│ ✦ Costo: *${COSTO_PROTECCION.toLocaleString()} ${moneda}*\n` +
                `│ ✦ Tienes: *${monedas.toLocaleString()} ${moneda}*\n` +
                `╰─────────────────`,
            m, ctxWarn);
        }

        if (!text) {
            return conn.reply(m.chat,
                `╭─「 🛡️ 𝗣𝗿𝗼𝘁𝗲𝗰𝗰𝗶ó𝗻 」\n` +
                `│ ꕤ Escribe el nombre del personaje\n` +
                `│ que deseas proteger.\n` +
                `│\n` +
                `│ ✦ Ejemplo: *${usedPrefix + command} Tohka*\n` +
                `│ ✦ Costo: *${COSTO_PROTECCION.toLocaleString()} ${moneda}*\n` +
                `│ ✦ Duración: *24 horas*\n` +
                `╰─────────────────`,
            m, ctxWarn);
        }

        const charactersData = await loadCharacters()
        const todosLosPersonajes = Object.values(charactersData).flatMap(s => s.characters || [])
        const misPersonajes = todosLosPersonajes.filter(c =>
            currentUserData.characters.includes(String(c.id)) ||
            currentUserData.characters.includes(c.id)
        )

        const currentTime = Date.now()
        let protegidos = []
        let sinSaldo = []
        let noEncontrados = []
        let yaProtegidos = []
        let saldoActual = monedas

        const esAll = text.trim().toLowerCase() === 'all'
        const listaAProteger = esAll
            ? misPersonajes
            : text.split(',').map(n => n.trim()).filter(Boolean).map(nombre => {
                const r = buscarSimilitud(nombre, misPersonajes)
                if (r.length === 0) { noEncontrados.push(nombre); return null }
                return r[0]
            }).filter(Boolean)

        if (esAll && misPersonajes.length === 0) {
            return conn.reply(m.chat,
                `╭─「 🛡️ 𝗣𝗿𝗼𝘁𝗲𝗰𝗰𝗶ó𝗻 」\n` +
                `│ ꕤ No tienes personajes\n` +
                `│ que proteger.\n` +
                `╰─────────────────`,
            m, ctxWarn)
        }

        if (esAll) {
            const maxProtegibles = Math.floor(saldoActual / COSTO_PROTECCION)
            const totalSinProteccion = listaAProteger.filter(c => {
                const db = global.db.data.characters?.[String(c.id)]
                return !db?.protectedUntil || currentTime >= db.protectedUntil
            }).length
            if (maxProtegibles === 0) {
                return conn.reply(m.chat,
                    `╭─「 🛡️ 𝗣𝗿𝗼𝘁𝗲𝗰𝗰𝗶ó𝗻 」\n` +
                    `│ ꕤ Saldo insuficiente.\n` +
                    `│ ✦ Necesitas: *${COSTO_PROTECCION.toLocaleString()}* por personaje\n` +
                    `│ ✦ Tienes: *${saldoActual.toLocaleString()} ${moneda}*\n` +
                    `╰─────────────────`,
                m, ctxWarn)
            }
            if (totalSinProteccion > maxProtegibles) {
                await conn.reply(m.chat,
                    `╭─「 🛡️ 𝗣𝗿𝗼𝘁𝗲𝗰𝗰𝗶ó𝗻 」\n` +
                    `│ ꕤ Tienes *${totalSinProteccion}* personajes sin proteger\n` +
                    `│ pero solo te alcanza para *${maxProtegibles}*.\n` +
                    `│ _Se protegerán los que alcancen._\n` +
                    `╰─────────────────`,
                m, ctxWarn)
            }
        }

        for (const personaje of listaAProteger) {
            if (saldoActual < COSTO_PROTECCION) {
                if (!esAll) sinSaldo.push(personaje.name)
                break
            }
            const charId = String(personaje.id)
            if (!global.db.data.characters) global.db.data.characters = {}
            if (!global.db.data.characters[charId]) global.db.data.characters[charId] = {}
            const charDB = global.db.data.characters[charId]
            if (charDB.protectedUntil && currentTime < charDB.protectedUntil) {
                const restante = Math.ceil((charDB.protectedUntil - currentTime) / 1000 / 60)
                yaProtegidos.push(`${personaje.name} _(${restante}min)_`)
                continue
            }
            charDB.protectedUntil = currentTime + DURACION_PROTECCION
            saldoActual -= COSTO_PROTECCION
            protegidos.push(personaje.name)
        }

        currentUserData.coin = saldoActual

        let msg = `╭─「 🛡️ 𝗣𝗿𝗼𝘁𝗲𝗰𝗰𝗶ó𝗻 𝗱𝗲 𝗣𝗲𝗿𝘀𝗼𝗻𝗮𝗷𝗲𝘀 」\n│\n`

        if (protegidos.length > 0) {
            msg += `│ ✦ 𝗣𝗿𝗼𝘁𝗲𝗴𝗶𝗱𝗼𝘀 _24h:_\n`
            protegidos.forEach(n => msg += `│  ✔ ${n}\n`)
            msg += `│\n`
            msg += `│ ✦ Gastaste: *${(COSTO_PROTECCION * protegidos.length).toLocaleString()} ${moneda}*\n`
            msg += `│ ✦ Saldo: *${saldoActual.toLocaleString()} ${moneda}*\n`
        }

        if (yaProtegidos.length > 0) {
            msg += `│\n│ ⚠️ 𝗬𝗮 𝗽𝗿𝗼𝘁𝗲𝗴𝗶𝗱𝗼𝘀:\n`
            yaProtegidos.forEach(n => msg += `│  • ${n}\n`)
        }

        if (noEncontrados.length > 0) {
            msg += `│\n│ ❌ 𝗡𝗼 𝗲𝗻𝗰𝗼𝗻𝘁𝗿𝗮𝗱𝗼𝘀:\n`
            noEncontrados.forEach(n => msg += `│  • ${n}\n`)
        }

        if (sinSaldo.length > 0) {
            msg += `│\n│ 💸 𝗦𝗶𝗻 𝘀𝗮𝗹𝗱𝗼:\n`
            sinSaldo.forEach(n => msg += `│  • ${n}\n`)
        }

        if (protegidos.length === 0 && yaProtegidos.length === 0 && noEncontrados.length === 0 && sinSaldo.length === 0) {
            msg += `│ ꕤ No se pudo proteger ningún personaje.\n`
        }

        msg += `╰─────────────────`

        return conn.reply(m.chat, msg.trim(), m, protegidos.length > 0 ? ctxOk : ctxWarn)

    } catch (error) {
        console.error('Error en protegerwaifu:', error);
        conn.reply(m.chat,
            `╭─「 ⚠︎ 𝗘𝗿𝗿𝗼𝗿 」\n` +
            `│ _${error.message}_\n` +
            `╰─────────────────`,
        m, ctxErr);
    }
};

handler.help = ['protegerwaifu nombre'];
handler.tags = ['gacha'];
handler.command = ['protegerwaifu', 'proteger', 'pw'];

export default handler;