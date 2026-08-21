import ws from "ws"

function getActiveConnections() {
    return global.conns ?? []
}

function getActiveUsers(activeConnections) {
    const mainBotJid = global.conn.user.jid
    const subBotsJids = new Set(
        activeConnections
            .filter(conn => conn.user && conn.ws.socket && conn.ws.socket.readyState !== ws.CLOSED)
            .map(conn => conn.user.jid)
    )
    return [mainBotJid, ...subBotsJids]
}

function mapBotsInGroup(users, participants) {
    let groupBots = users.filter(bot => participants.some(p => p.id === bot))
    
    if (participants.some(p => p.id === global.conn.user.jid) && !groupBots.includes(global.conn.user.jid)) {
        groupBots.push(global.conn.user.jid)
    }
    
    const botsGroupText = groupBots.length > 0 
        ? groupBots.map(bot => {
            const isMainBot = bot === global.conn.user.jid
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
        const users = getActiveUsers(activeConnections)
        const { groupBots, botsGroupText } = mapBotsInGroup(users, participants)
        
        const message = `*「 ✦ 」 Lista de bots activos*

❀ Principal: *1*
✿ Subs: *${users.length - 1}*

❏ En este grupo: *${groupBots.length}* bots
${botsGroupText}`

        const mentionList = groupBots.map(bot => bot.endsWith("@s.whatsapp.net") ? bot : `${bot}@s.whatsapp.net`)
        
        rcanal.contextInfo.mentionedJid = mentionList

        await conn.sendMessage(m.chat, { text: message, ...rcanal }, { quoted: m })

    } catch (error) {
        m.reply(`⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`)
    }
}

handler.tags = ["serbot"]
handler.help = ["botlist"]
handler.command = ["botlist", "listbots", "listbot", "bots", "sockets", "socket"]

export default handler
