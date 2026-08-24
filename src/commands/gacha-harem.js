import { join } from "path";
import { promises as fs } from 'fs';

const charactersFilePath = join(process.cwd(), 'src', 'json', 'characters.json');

async function loadCharacters() {
    const data = await fs.readFile(charactersFilePath, 'utf-8');
    return JSON.parse(data);
}

function flattenCharacters(charactersData) {
    return Object.values(charactersData).flatMap(series => 
        Array.isArray(series.characters) ? series.characters : []
    );
}

let handler = async (m, { conn, args, usedPrefix, command, quoted }) => {
    try {
        // Verificar si los comandos de gacha están activados en el grupo
        const chatData = global.db?.data?.chats?.[m.chat] || {};
        if (!chatData.gacha && m.isGroup) {
            return m.reply('ꕤ Los comandos de *Gacha* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con el comando:\n» *' + usedPrefix + 'gacha on*');
        }

        // Inicializar datos si no existen
        if (!global.db.data.characters) global.db.data.characters = {};
        if (!global.db.data.users) global.db.data.users = {};

        // Obtener usuario objetivo - Lógica mejorada
        let mentionedJid = await m.mentionedJid
        let targetRaw = (Array.isArray(mentionedJid) && mentionedJid.length)
            ? mentionedJid[0]
            : null

        if (targetRaw && typeof targetRaw === 'string' && targetRaw.includes('@lid')) {
            try {
                const meta = await conn.groupMetadata(m.chat)
                const found = meta.participants.find(p =>
                    p.lid === targetRaw ||
                    p.lid?.split('@')[0] === targetRaw.split('@')[0]
                )
                if (found) targetRaw = found.jid || found.id || targetRaw
            } catch {}
        }

        if (!targetRaw && quoted) {
            targetRaw = await Promise.resolve(quoted.sender)
            if (typeof targetRaw !== 'string') {
                targetRaw = targetRaw?.jid || targetRaw?.id || String(targetRaw || '')
            }
        }

        let targetUser = String(targetRaw || m.sender || '');
        
        if (targetUser.includes('@lid') || !targetUser.includes('@s.whatsapp.net')) {
            try {
                const meta = await conn.groupMetadata(m.chat)
                const found = meta.participants.find(p =>
                    p.lid === targetUser ||
                    p.jid === targetUser ||
                    p.id === targetUser ||
                    p.lid?.split('@')[0] === targetUser.split('@')[0] ||
                    p.jid?.split('@')[0] === targetUser.split('@')[0]
                )
                if (found) targetUser = String(found.jid || found.id || targetUser);
            } catch {
                targetUser = targetUser
            }
        }

        // Obtener nombre del usuario objetivo
        const targetUsername = await global.getProperName(conn, targetUser);

        // Cargar datos de personajes
        const charactersData = await loadCharacters();
        const allCharacters = flattenCharacters(charactersData);

        // Obtener personajes del usuario objetivo (BLINDADO CONTRA ERRORES DE TIPO)
        const targetNum = String(targetUser || '').replace(/[^0-9]/g, '');
        const userCharacters = Object.entries(global.db.data.characters)
            .filter(([_, charData]) => {
                if (!charData) return false;
                const charUserNum = String(charData.user || '').replace(/[^0-9]/g, '');
                return charUserNum === targetNum && charUserNum !== '';
            })
            .map(([charId]) => charId);

        // Verificar si el usuario tiene personajes
        if (userCharacters.length === 0) {
            const message = targetUser === m.sender ? 
                'ꕤ No tienes personajes reclamados.' : 
                'ꕤ *' + targetUsername + '* no tiene personajes reclamados.';
            
            return conn.reply(m.chat, message, m, { mentions: [targetUser] });
        }

        // Ordenar personajes por valor (descendente)
        userCharacters.sort((charA, charB) => {
            const charAData = global.db.data.characters[charA] || {};
            const charBData = global.db.data.characters[charB] || {};
            
            const charAOriginal = allCharacters.find(char => char.id === charA);
            const charBOriginal = allCharacters.find(char => char.id === charB);
            
            const valueA = typeof charAData.value === 'number' ? 
                charAData.value : Number(charAOriginal?.value || 0);
            const valueB = typeof charBData.value === 'number' ? 
                charBData.value : Number(charBOriginal?.value || 0);
            
            return valueB - valueA;
        });

        // Configurar paginación
        const page = parseInt(args[1]) || 1;
        const itemsPerPage = 50;
        const totalPages = Math.ceil(userCharacters.length / itemsPerPage);

        if (page < 1 || page > totalPages) {
            return conn.reply(
                m.chat, 
                'ꕤ Página no válida. Hay un total de *' + totalPages + '* páginas.', 
                m
            );
        }

        // Obtener personajes de la página actual
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, userCharacters.length);
        const pageCharacters = userCharacters.slice(startIndex, endIndex);

        // Construir mensaje
        let message = '✿ Personajes reclamados ✿\n';
        message += '⌦ Usuario: *' + targetUsername + '*\n';
        message += '♡ Personajes: *(' + userCharacters.length + ')*\n\n';

        for (const charId of pageCharacters) {
            const charData = global.db.data.characters[charId] || {};
            const charOriginal = allCharacters.find(char => char.id === charId);
            
            const charName = charOriginal?.name || charData.name || `ID:${charId}`;
            const charValue = typeof charData.value === 'number' ? 
                charData.value : Number(charOriginal?.value || 0);
            
            message += '» *' + charName + '* (*' + charValue.toLocaleString() + '*)\n';
        }

        message += '\n⌦ _Página *' + page + '* de *' + totalPages + '*_';

        // Enviar mensaje
        await conn.reply(m.chat, message.trim(), m, { mentions: [targetUser] });

    } catch (error) {
        console.error('Error en handler de harem:', error);
        await conn.reply(
            m.chat, 
            '⚠︎ Se ha producido un problema.\n> Usa *' + usedPrefix + 'report* para informarlo.\n\n' + error.message, 
            m
        );
    }
};

// Configuración del handler
handler.help = ['harem [@usuario] [página]'];
handler.tags = ['anime'];
handler.command = ['harem', 'waifus', 'claims'];
handler.group = true;

export default handler;