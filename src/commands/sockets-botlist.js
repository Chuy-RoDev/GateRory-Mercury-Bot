import ws from "ws"

function getActiveConnections() {
    return global.conns ?? []
}

function getActiveUsers(activeConnections) {
    const mainBotJid = global.conn?.user?.jid || global.conn?.user?.id
    const subBotsJids = new Set(
        activeConnections
            .filter(c => c?.sock && c.sock.ws?.socket?.readyState !== ws.CLOSED)
            .map(c => c.jid || c.sock?.user?.jid || c.sock?.user?.id)
            .filter(Boolean)
    )
    return { mainBotJid, subBotsJids: Array.from(subBotsJids) }
}

function mapBotsInGroup(mainBotJid, subBotsJids, participants) {
    const allBots = [mainBotJid, ...subBotsJids].map(id => id?.includes('@') ? id : `${id}@s.whatsapp.net`)
    let groupBots = allBots.filter(bot => participants.some(p => p.id === bot || p.jid === bot))
    
    // Asegurar que el principal esté si está en los participantes
    if (mainBotJid && !groupBots.includes(mainBotJid) && participants.some(p => p.id === mainBotJid || p.jid === mainBotJid)) {
        groupBots.push(mainBotJid)
    }
    
    const botsGroupText = groupBots.length > 0 
        ? groupBots.map(bot => {
            const isMainBot = bot.includes(mainBotJid?.split('@')[0])
            const mention = bot.replace(/[^0-9]/g, '')
            return `@${mention}\n> Bot: ${isMainBot ? 'Principal' : 'Sub-Bot'}`
        }).join("\n\n") 
        : `✧ No hay bots activos en este grupo`

    return { groupBots, botsGroupText }
}

const handler = async (m, { conn, command, usedPrefix, participants }) => {
    const rcanal = { contextInfo: { mentionedJid: [] } }

    try {
        const activeConnections = getActiveConnections()
        const { mainBotJid, subBotsJids } = getActiveUsers(activeConnections)
        const { groupBots, botsGroupText } = mapBotsInGroup(mainBotJid, subBotsJids, participants)
        
        const message = `*「 ✦ 」 Lista de bots activos*

❀ Principal: *1*
✿ Subs: *${subBotsJids.length}*

❏ En este grupo: *${groupBots.length}* bots
${botsGroupText}`

        rcanal.contextInfo.mentionedJid = groupBots

        await conn.sendMessage(m.chat, { text: message, ...rcanal }, { quoted: m })

    } catch (error) {
        m.reply(`⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`)
    }
}

handler.tags = ["serbot"]
handler.help = ["botlist"]
handler.command = ["botlist", "listbots", "listbot", "bots", "sockets", "socket"]

export default handler