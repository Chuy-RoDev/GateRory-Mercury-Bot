import { promises as fs } from 'fs';

function formatTime(ms) {
    if (ms <= 0 || isNaN(ms)) return 'Ahora';
    
    const totalSeconds = Math.ceil(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor(totalSeconds % 86400 / 3600);
    const minutes = Math.floor(totalSeconds % 3600 / 60);
    const seconds = totalSeconds % 60;
    
    const parts = [];
    if (days) parts.push(days + ' día' + (days !== 1 ? 's' : ''));
    if (hours) parts.push(hours + ' hora' + (hours !== 1 ? 's' : ''));
    if (minutes || hours || days) parts.push(minutes + ' minuto' + (minutes !== 1 ? 's' : ''));
    parts.push(seconds + ' segundo' + (seconds !== 1 ? 's' : ''));
    
    return parts.join(' ');
}

let handler = async (m, { conn, usedPrefix, command }) => {
    try {
        const userCurrency = global.getUserCurrency ? global.getUserCurrency(m.sender) : global.currency || '$';
        
        const chatData = global.db?.data?.chats?.[m.chat] || {};
        if (!chatData.economy && m.isGroup) {
            return m.reply('ꕤ Los comandos de *Economía* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con el comando:\n» *' + usedPrefix + 'economy on*');
        }

        const userData = global.db?.data?.users?.[m.sender] || {};
        if (!userData) {
            return conn.reply(m.chat, 'ꕤ No se encontraron datos de economía para este usuario.', m);
        }

        const currentTime = Date.now();
        
        const cooldowns = {
            'Work': userData.lastwork,
            'Slut': userData.lastslut,
            'Crime': userData.lastcrime,
            'Steal': userData.lastrob,
            'Daily': userData.lastDaily,
            'Weekly': userData.lastweekly,
            'Monthly': userData.lastmonthly,
            'Cofre': userData.lastcofre,
            'Adventure': userData.lastAdventure,
            'Dungeon': userData.lastDungeon,
            'Fish': userData.lastFish,
            'Hunt': userData.lastHunt,
            'Mine': userData.lastmine
        };

        const cooldownList = Object.entries(cooldowns).map(([commandName, lastTime]) => {
            const remainingTime = typeof lastTime === 'number' ? lastTime - currentTime : 0;
            return 'ⴵ ' + commandName + ' » *' + formatTime(remainingTime) + '*';
        });

        const totalWealth = ((userData.coin || 0) + (userData.bank || 0)).toLocaleString();

        const getUsername = async (userId) => {
            try {
                return userData.name?.trim() || 
                       (await conn.getName(userId)) || 
                       userId.split('@')[0];
            } catch {
                return userId.split('@')[0];
            }
        };

        const username = await getUsername(m.sender);

        let infoMessage = '*ꕤ Usuario `<' + username + '>`*\n\n';
        infoMessage += cooldownList.join('\n');
        infoMessage += '\n\n⛁ Coins totales » *$' + totalWealth + ' ' + userCurrency + '*';

        await m.reply(infoMessage.trim());

    } catch (error) {
        console.error('Error en handler de economía:', error);
        await conn.reply(
            m.chat,
            '⚠︎ Se ha producido un problema.\n> Usa *' + usedPrefix + 'report* para informarlo.\n\n' + error.message,
            m
        );
    }
};

handler.help = ['economyinfo'];
handler.tags = ['economy'];
handler.command = ['economyinfo', 'einfo', 'infoeconomy'];
handler.group = true;

export default handler;