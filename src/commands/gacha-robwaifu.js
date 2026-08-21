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

function getSeriesName(charactersData, characterId) {
    return Object.values(charactersData).find(series =>
        Array.isArray(series.characters) &&
        series.characters.some(c => String(c.id) === String(characterId))
    )?.name || 'Desconocido';
}

function buscarSimilitud(nombre, lista) {
    const query = nombre.toLowerCase().trim();
    return lista.filter(c => c.name.toLowerCase().includes(query));
}

const sesionesRobo = new Map();
const COSTO_ROBO = 100000
const SELECCION_TTL = 60 * 1000

let handler = async (m, { conn, usedPrefix, command, text }) => {
    const ctxErr = (global.rcanalx || {});
    const ctxWarn = (global.rcanalw || {});
    const ctxOk = (global.rcanalr || {});
    const cooldownTime = 8 * 60 * 60 * 1000;
    const robCooldown = 24 * 60 * 60 * 1000;

    try {
        const chatData = global.db?.data?.chats?.[m.chat] || {};
        if (!chatData.gacha && m.isGroup) {
            return conn.reply(m.chat, 'ꕤ Los comandos de *Gacha* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con:\n» *' + usedPrefix + 'gacha on*', m, ctxWarn);
        }

        const currentUserData = global.db?.data?.users?.[m.sender] || {};
        if (!Array.isArray(currentUserData.characters)) currentUserData.characters = [];
        if (!currentUserData.robCooldown) currentUserData.robCooldown = 0;
        if (!currentUserData.robVictims) currentUserData.robVictims = {};

        const currentTime = Date.now();
        const sessionKey = `${m.chat}_${m.sender}`;

        // ── MODO SELECCIÓN: responde con numero ────────────────────────
        const sesionActiva = sesionesRobo.get(sessionKey);
        if (sesionActiva && text) {
            const trimmed = text.trim().toLowerCase()

            if (currentTime > sesionActiva.expiresAt) {
                sesionesRobo.delete(sessionKey)
                return conn.reply(m.chat, 'ꕤ Se acabó el tiempo. Usa el comando de nuevo.', m, ctxWarn);
            }

            if (trimmed === 'siguiente' || trimmed === 'mas') {
                sesionActiva.pagina = (sesionActiva.pagina || 0) + 1
                sesionesRobo.set(sessionKey, sesionActiva)
                return mostrarPaginaDuenos(conn, m, sesionActiva, ctxWarn)
            }

            if (/^\d+$/.test(trimmed)) {
                const num = parseInt(trimmed)
                const inicio = (sesionActiva.pagina || 0) * 10

                // Modo duenos (sin mencion)
                if (sesionActiva.modoDuenos) {
                    const seleccion = sesionActiva.listaDuenos[inicio + num - 1]
                    if (!seleccion) return conn.reply(m.chat, 'ꕤ Número inválido.', m, ctxErr)
                    sesionesRobo.delete(sessionKey)
                    if (seleccion.enCooldown) {
                        return conn.reply(m.chat, 'ꕤ Ya robaste a esa persona hoy. Elige otro.', m, ctxWarn)
                    }
                    return ejecutarRobo(conn, m, seleccion.charId, seleccion.ownerId, currentUserData, ctxOk, ctxWarn, ctxErr)
                }

                // Modo personajes (con mencion, varios resultados)
                const seleccion = sesionActiva.lista[inicio + num - 1]
                if (!seleccion) return conn.reply(m.chat, 'ꕤ Número inválido.', m, ctxErr)
                sesionesRobo.delete(sessionKey)
                return ejecutarRobo(conn, m, seleccion.id, sesionActiva.targetUser, currentUserData, ctxOk, ctxWarn, ctxErr)
            }
        }

        // ── MODO INICIAL ───────────────────────────────────────────────

        // Verificar monedas
        const monedas = currentUserData.coin || 0
        if (monedas < COSTO_ROBO) {
            return conn.reply(m.chat, `ꕤ Necesitas *${COSTO_ROBO.toLocaleString()} Sky-Coins* para intentar un robo.\nTienes: *${monedas.toLocaleString()}*`, m, ctxWarn);
        }

        // Verificar cooldown general
        const nextRobTime = currentUserData.robCooldown + cooldownTime;
        if (currentUserData.robCooldown > 0 && currentTime < nextRobTime) {
            const remaining = Math.ceil((nextRobTime - currentTime) / 1000);
            const h = Math.floor(remaining / 3600);
            const min = Math.floor((remaining % 3600) / 60);
            const sec = remaining % 60;
            
            let t = '';
            if (h > 0) t += h + 'h ';
            if (min > 0) t += min + 'm ';
            if (sec > 0 || !t) t += sec + 's';
            return conn.reply(m.chat, 'ꕤ Debes esperar *' + t.trim() + '* para robar de nuevo.', m, ctxWarn);
        }

        const targetUser = m.mentionedJid?.[0] || m.quoted?.sender || null;
        const nombrePersonaje = (text || '').replace(/@\d+/g, '').trim();

        if (!nombrePersonaje) {
            return conn.reply(m.chat,
                'ꕤ Especifica el nombre del personaje que quieres robar.\n' +
                '> Sin mención: *' + usedPrefix + command + ' Miku Nakano*\n' +
                '> Con mención: *' + usedPrefix + command + ' @usuario Miku Nakano*',
                m, ctxErr);
        }

        const charactersData = await loadCharacters();
        const todosLosPersonajes = Object.values(charactersData).flatMap(s => s.characters || []);

        // ── CON MENCIÓN: buscar en el harem de esa persona ────────────
        if (targetUser) {
            if (targetUser === m.sender) {
                return conn.reply(m.chat, 'ꕤ No puedes robarte a ti mismo.', m, ctxErr);
            }

            const lastRobTime = currentUserData.robVictims[targetUser];
            if (lastRobTime && currentTime - lastRobTime < robCooldown) {
                const victimName = await global.getProperName(conn, targetUser)
                return conn.reply(m.chat, 'ꕤ Ya robaste a *' + victimName + '* hoy. Espera 24 horas.', m, ctxWarn);
            }

            const targetUserData = global.db?.data?.users?.[targetUser] || {};
            if (!Array.isArray(targetUserData.characters) || targetUserData.characters.length === 0) {
                const tn = await global.getProperName(conn, targetUser);
                return conn.reply(m.chat, 'ꕤ *' + tn + '* no tiene personajes que puedas robar.', m, ctxWarn);
            }

            const personajesVictima = todosLosPersonajes.filter(c =>
                targetUserData.characters.includes(String(c.id)) ||
                targetUserData.characters.includes(c.id)
            );

            const resultados = buscarSimilitud(nombrePersonaje, personajesVictima);

            if (resultados.length === 0) {
                const tn = await global.getProperName(conn, targetUser);
                return conn.reply(m.chat, 'ꕤ No encontré *' + nombrePersonaje + '* en el harem de *' + tn + '*.', m, ctxWarn);
            }

            if (resultados.length === 1) {
                return ejecutarRobo(conn, m, resultados[0].id, targetUser, currentUserData, ctxOk, ctxWarn, ctxErr)
            }

            const sesion = { lista: resultados, targetUser, pagina: 0, expiresAt: currentTime + SELECCION_TTL, modoDuenos: false }
            sesionesRobo.set(sessionKey, sesion)
            setTimeout(() => sesionesRobo.delete(sessionKey), SELECCION_TTL + 1000)

            const inicio = 0
            const paginaActual = resultados.slice(0, 10)
            let msg = `ꕤ Encontré *${resultados.length}* personajes similares. Elige el número:\n\n`
            for (let i = 0; i < paginaActual.length; i++) {
                const c = paginaActual[i]
                const serie = getSeriesName(charactersData, c.id)
                msg += `*${i + 1}.* ${c.name} — _${serie}_\n`
            }
            if (resultados.length > 10) msg += `\nEscribe *siguiente* para ver más.`
            msg += `\n> Tienes *60 segundos* para elegir.`
            return conn.reply(m.chat, msg, m, ctxWarn)
        }

        // ── SIN MENCIÓN: buscar en toda la DB quién tiene el personaje ─
        const resultadosPersonaje = buscarSimilitud(nombrePersonaje, todosLosPersonajes);

        if (resultadosPersonaje.length === 0) {
            return conn.reply(m.chat, 'ꕤ No encontré ningún personaje llamado *' + nombrePersonaje + '* en el gacha.', m, ctxWarn);
        }

        // Buscar duenos en la DB
        const duenosEncontrados = []
        for (const char of resultadosPersonaje) {
            const charDB = global.db.data.characters?.[String(char.id)]
            if (charDB?.user && charDB.user !== m.sender) {
                const lastRob = currentUserData.robVictims[charDB.user]
                const enCooldown = !!(lastRob && currentTime - lastRob < robCooldown)
                duenosEncontrados.push({
                    charId: String(char.id),
                    charName: char.name,
                    ownerId: charDB.user,
                    enCooldown
                })
            }
        }

        if (duenosEncontrados.length === 0) {
            return conn.reply(m.chat, 'ꕤ Nadie tiene ese personaje, o eres tú quien lo tiene.', m, ctxWarn);
        }

        // Un solo resultado y sin cooldown: robar directo
        if (duenosEncontrados.length === 1 && !duenosEncontrados[0].enCooldown) {
            return ejecutarRobo(conn, m, duenosEncontrados[0].charId, duenosEncontrados[0].ownerId, currentUserData, ctxOk, ctxWarn, ctxErr)
        }

        // Varios: mostrar lista
        const sesion = { listaDuenos: duenosEncontrados, pagina: 0, expiresAt: currentTime + SELECCION_TTL, modoDuenos: true }
        sesionesRobo.set(sessionKey, sesion)
        setTimeout(() => sesionesRobo.delete(sessionKey), SELECCION_TTL + 1000)

        let msg = `ꕤ Encontré *${duenosEncontrados.length}* resultado(s). Elige el número:\n\n`
        const pagina0 = duenosEncontrados.slice(0, 10)
        for (let i = 0; i < pagina0.length; i++) {
            const d = pagina0[i]
            const ownerName = await global.getProperName(conn, d.ownerId)
            const coolStr = d.enCooldown ? ' _(ya robaste hoy)_' : ''
            msg += `*${i + 1}.* ${d.charName} — dueño: *${ownerName}*${coolStr}\n`
        }
        if (duenosEncontrados.length > 10) msg += `\nEscribe *siguiente* para ver más.`
        msg += `\n> Tienes *60 segundos* para elegir.`
        return conn.reply(m.chat, msg, m, ctxWarn)

    } catch (error) {
        console.error('Error en robwaifu:', error);
        conn.reply(m.chat, '⚠︎ Se produjo un problema.\n' + error.message, m, ctxErr);
    }
};

async function mostrarPaginaDuenos(conn, m, sesion, ctxWarn) {
    const { listaDuenos, pagina } = sesion
    const inicio = pagina * 10
    const paginaActual = listaDuenos.slice(inicio, inicio + 10)
    const hayMas = listaDuenos.length > inicio + 10

    let msg = `ꕤ Página ${pagina + 1}:\n\n`
    for (let i = 0; i < paginaActual.length; i++) {
        const d = paginaActual[i]
        const ownerName = await global.getProperName(conn, d.ownerId)
        const coolStr = d.enCooldown ? ' _(ya robaste hoy)_' : ''
        msg += `*${i + 1}.* ${d.charName} — dueño: *${ownerName}*${coolStr}\n`
    }
    if (hayMas) msg += `\nEscribe *siguiente* para ver más.`
    msg += `\n> Tienes *60 segundos* para elegir.`
    return conn.reply(m.chat, msg, m, ctxWarn)
}

async function ejecutarRobo(conn, m, charId, targetUser, currentUserData, ctxOk, ctxWarn, ctxErr) {
    const currentTime = Date.now()
    const COSTO_ROBO = 100000

    const charDB = global.db.data.characters?.[charId] || {}
    if (charDB.protectedUntil && currentTime < charDB.protectedUntil) {
        const restante = Math.ceil((charDB.protectedUntil - currentTime) / 1000 / 60)
        return conn.reply(m.chat, `ꕤ *${charDB.name || charId}* está protegido. Quedan *${restante} minutos* de protección.`, m, ctxWarn)
    }

    const targetUserData = global.db?.data?.users?.[targetUser] || {}
    if (!targetUserData.characters?.includes(String(charId)) && !targetUserData.characters?.includes(charId)) {
        return conn.reply(m.chat, 'ꕤ Ese personaje ya no pertenece a esa persona.', m, ctxWarn)
    }

    // Gastar monedas DESPUÉS de verificar todo
    currentUserData.coin = (currentUserData.coin || 0) - COSTO_ROBO
    const success = Math.random() < 0.9
    currentUserData.robCooldown = currentTime
    currentUserData.robVictims[targetUser] = currentTime

    const [robberName, victimName] = await Promise.all([
        global.getProperName(conn, m.sender),
        global.getProperName(conn, targetUser)
    ])

    const charName = charDB.name || `ID:${charId}`

    if (!success) {
        return conn.reply(m.chat, `ꕤ El intento de robo falló. *${victimName}* defendió a *${charName}*.\n> Perdiste *${COSTO_ROBO.toLocaleString()} Sky-Coins*.`, m, ctxWarn)
    }

    if (!global.db.data.characters) global.db.data.characters = {}
    if (!global.db.data.characters[charId]) global.db.data.characters[charId] = {}
    global.db.data.characters[charId].user = m.sender

    targetUserData.characters = (targetUserData.characters || []).filter(id => String(id) !== String(charId))
    if (!currentUserData.characters) currentUserData.characters = []
    if (!currentUserData.characters.includes(String(charId))) currentUserData.characters.push(String(charId))

    if (targetUserData.favorite === charId || targetUserData.favorite === String(charId)) {
        delete targetUserData.favorite
    }
    if (global.db.data.characters[charId].protectedUntil) {
        delete global.db.data.characters[charId].protectedUntil
    }

    return conn.reply(m.chat, `ꕤ *${robberName}* robó a *${charName}* del harem de *${victimName}*.\n> Costó *${COSTO_ROBO.toLocaleString()} Sky-Coins*.`, m, ctxOk)
}

handler.help = ['robwaifu nombre'];
handler.tags = ['gacha'];
handler.command = ['robwaifu', 'robarwaifu'];
handler.group = true;

export default handler;