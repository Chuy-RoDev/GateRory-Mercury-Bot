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

function getCharacterById(characterId, charactersData) {
    return Object.values(charactersData)
        .flatMap(series => series.characters || [])
        .find(character => String(character.id) === String(characterId));
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTA PARA EL COMANDO DE ROLL (rw):
// pendingClaims ahora usa el messageId del roll como clave.
// Al guardar un pending claim en el roll, usa esta estructura:
//
//   const sentMsg = await conn.sendMessage(...)
//   const msgId = sentMsg?.key?.id || Date.now().toString()
//   chatData.pendingClaims[msgId] = {
//       id: characterId,
//       rollerId: m.sender,
//       expiresAt: Date.now() + 5 * 60 * 1000,       // 5 min para reclamar
//       protectedUntil: Date.now() + 30 * 1000,       // 30s de protección del roller
//   }
// ─────────────────────────────────────────────────────────────────────────────

let handler = async (m, { conn, usedPrefix, command }) => {
    const ctxErr  = (global.rcanalx || {});
    const ctxWarn = (global.rcanalw || {});
    const ctxOk   = (global.rcanalr || {});

    const claimCooldown = 30 * 60 * 1000;

    try {
        if (!global.db.data.chats[m.chat]) global.db.data.chats[m.chat] = {};
        const chatData = global.db.data.chats[m.chat];

        if (!chatData.gacha && m.isGroup) {
            return conn.reply(m.chat, 'ꕤ Los comandos de *Gacha* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con:\n» *' + usedPrefix + 'gacha on*', m, ctxWarn);
        }

        if (!chatData.pendingClaims) chatData.pendingClaims = {};

        const currentUserData = global.db?.data?.users?.[m.sender] || {};
        const currentTime = Date.now();

        // ── COOLDOWN ──────────────────────────────────────────────────────────
        if (currentUserData.lastClaim && currentTime < currentUserData.lastClaim) {
            const remainingSeconds = Math.ceil((currentUserData.lastClaim - currentTime) / 1000);
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            let timeLeft = '';
            if (minutes > 0) timeLeft += minutes + ' minuto' + (minutes !== 1 ? 's' : '') + ' ';
            if (seconds > 0 || timeLeft === '') timeLeft += seconds + ' segundo' + (seconds !== 1 ? 's' : '');
            return conn.reply(m.chat, 'ꕤ Debes esperar *' + timeLeft.trim() + '* para reclamar de nuevo.', m, ctxWarn);
        }

        // ── LIMPIAR EXPIRADOS ─────────────────────────────────────────────────
        for (const key of Object.keys(chatData.pendingClaims)) {
            const slot = chatData.pendingClaims[key];
            if (!slot || !slot.id || currentTime > slot.expiresAt) {
                delete chatData.pendingClaims[key];
            }
        }

        // Compatibilidad con la estructura vieja (clave = rollerId sin campo rollerId)
        for (const [key, slot] of Object.entries(chatData.pendingClaims)) {
            if (slot && slot.id && !slot.rollerId) {
                slot.rollerId = key; // el rollerId era la clave en el formato antiguo
            }
        }

        let pendingClaim = null;
        let pendingKey   = null;

        // ── 1. CLAIM RESPONDIENDO A UN MENSAJE DE ROLL ────────────────────────
        if (m.quoted) {
            const quotedId = m.quoted.id || m.quoted.key?.id;
            if (quotedId && chatData.pendingClaims[quotedId]) {
                const slot = chatData.pendingClaims[quotedId];
                if (slot && slot.id && currentTime <= slot.expiresAt) {
                    if (slot.rollerId === m.sender) {
                        // Es el propio roller → siempre puede reclamar
                        pendingClaim = slot;
                        pendingKey   = quotedId;
                    } else if (currentTime >= slot.protectedUntil) {
                        // Pasó la protección → cualquiera puede reclamar
                        pendingClaim = slot;
                        pendingKey   = quotedId;
                    } else {
                        const secsLeft = Math.ceil((slot.protectedUntil - currentTime) / 1000);
                        return conn.reply(m.chat, `ꕤ Este personaje aún está protegido por *${secsLeft}s*. ¡Espera un momento!`, m, ctxWarn);
                    }
                }
            }
        }

        // ── 2. SIN REPLY: buscar slot propio (el más antiguo disponible) ──────
        if (!pendingClaim) {
            const propios = Object.entries(chatData.pendingClaims)
                .filter(([, slot]) =>
                    slot && slot.id &&
                    slot.rollerId === m.sender &&
                    currentTime <= slot.expiresAt
                )
                .sort(([, a], [, b]) => a.expiresAt - b.expiresAt); // más antiguo primero

            if (propios.length > 0) {
                [pendingKey, pendingClaim] = propios[0];
            }
        }

        // ── 3. Si no tiene propio, buscar cualquiera ya desprotegido ──────────
        if (!pendingClaim) {
            const ajenos = Object.entries(chatData.pendingClaims)
                .filter(([, slot]) =>
                    slot && slot.id &&
                    slot.rollerId !== m.sender &&
                    currentTime <= slot.expiresAt &&
                    currentTime >= slot.protectedUntil
                )
                .sort(([, a], [, b]) => a.protectedUntil - b.protectedUntil); // más antiguo primero

            if (ajenos.length > 0) {
                [pendingKey, pendingClaim] = ajenos[0];
            }
        }

        // ── SIN PERSONAJE DISPONIBLE ──────────────────────────────────────────
        if (!pendingClaim) {
            const hayProtegidos = Object.values(chatData.pendingClaims).some(slot =>
                slot && slot.id && currentTime < slot.protectedUntil && currentTime <= slot.expiresAt
            );
            if (hayProtegidos) {
                return conn.reply(m.chat, 'ꕤ Hay un personaje disponible pero aún está en período de protección (30s). ¡Espera un momento!', m, ctxWarn);
            }
            return conn.reply(m.chat, 'ꕤ No hay ningún personaje disponible para reclamar. Usa *' + usedPrefix + 'rw* primero.', m, ctxErr);
        }

        // ── CARGAR DATOS DEL PERSONAJE ────────────────────────────────────────
        const characterId   = pendingClaim.id;
        const charactersData = await loadCharacters();
        const characterData  = getCharacterById(characterId, charactersData);

        if (!characterData) {
            delete chatData.pendingClaims[pendingKey];
            return conn.reply(m.chat, 'ꕤ Personaje no encontrado en characters.json', m, ctxErr);
        }

        if (!global.db.data.characters) global.db.data.characters = {};
        if (!global.db.data.characters[characterId]) global.db.data.characters[characterId] = {};

        const dbCharacter = global.db.data.characters[characterId];

        // ── YA FUE RECLAMADO ──────────────────────────────────────────────────
        if (dbCharacter.user) {
            const ud = global.db?.data?.users?.[dbCharacter.user] || {};
            const claimantName = ud.name?.trim() || dbCharacter.user.split('@')[0];
            delete chatData.pendingClaims[pendingKey];
            return conn.reply(m.chat, 'ꕤ *' + (dbCharacter.name || characterData.name) + '* ya fue reclamado por *' + claimantName + '*', m, ctxWarn);
        }

        // ── RECLAMAR ──────────────────────────────────────────────────────────
        dbCharacter.user           = m.sender;
        dbCharacter.claimedAt      = currentTime;
        dbCharacter.name           = characterData.name;
        dbCharacter.value          = characterData.value || 100;
        dbCharacter.votes          = dbCharacter.votes || 0;
        dbCharacter.expiresAt      = null;
        dbCharacter.protectedUntil = null;

        delete chatData.pendingClaims[pendingKey];

        currentUserData.lastClaim = currentTime + claimCooldown;

        if (!Array.isArray(currentUserData.characters)) currentUserData.characters = [];
        if (!currentUserData.characters.includes(characterId)) currentUserData.characters.push(characterId);

        const currentUsername = currentUserData.name?.trim() || 
    (() => { const n = conn.getName(m.sender); return typeof n === 'string' && n.trim() ? n : m.sender.split('@')[0] })()

        const claimMessage = chatData.claimMessage
            ? chatData.claimMessage
                .replace(/€user/g,      '*' + currentUsername + '*')
                .replace(/€character/g, '*' + dbCharacter.name + '*')
            : 'ꕤ *' + dbCharacter.name + '* ha sido reclamado por *' + currentUsername + '*';

        await conn.reply(m.chat, claimMessage, m, ctxOk);

    } catch (error) {
        console.error('Error en handler de claim:', error);
        conn.reply(m.chat, '⚠︎ Se ha producido un problema.\n> Usa *' + usedPrefix + 'report* para informarlo.\n\n' + error.message, m, ctxErr);
    }
};

handler.help = ['claim'];
handler.tags = ['gacha'];
handler.command = ['claim', 'c', 'reclamar'];
handler.group = true;

export default handler