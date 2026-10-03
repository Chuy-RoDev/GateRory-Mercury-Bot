let handler = async (m, { conn, text, participants, command, usedPrefix }) => {
    const usersData = global.db.data.users
    const args = text.split(' ')
    const days = args[0] && !isNaN(args[0]) ? parseInt(args[0]) : 7
    const page = args[1] && !isNaN(args[1]) ? parseInt(args[1]) : 1
    const pageSize = 10 

    let list = participants.map(u => {
        const user = usersData[u.id] || {}
        const msgs = user.chat || user.message || user.msgs || 0
        const cmds = user.commands || user.commandCount || user.cmds || 0
        return {
            id: u.id,
            name: (user.name || conn.getName(u.id) || u.id.split('@')[0]).replace(/\n/g, ' '),
            msgs, cmds, total: msgs + cmds
        }
    }).sort((a, b) => b.total - a.total)

    const totalPages = Math.ceil(list.length / pageSize)
    const currentPage = Math.min(page, totalPages)
    const start = (currentPage - 1) * pageSize
    const items = list.slice(start, start + pageSize)

    let txt = `❀ *Top de mensajes de los últimos ${days} días*\n\n`
    items.forEach((v, i) => {
        const rank = start + i + 1
        txt += `#${rank} » ${v.name}\n`
        txt += `\t\t» Mensajes: ${v.msgs.toLocaleString()}, Comandos: ${v.cmds.toLocaleString()}\n`
    })
    txt += `\n*Página ${currentPage}/${totalPages}*`

    await m.react('🏆')
    return await conn.sendMessage(m.chat, { text: txt.trim(), mentions: items.map(u => u.id) }, { quoted: m })
}

handler.help = ['ranking', 'topmensajes']
handler.tags = ['grupo']
handler.command = ['topcount', 'ranking', 'topmensajes', 'topmessages']
handler.group = true

export default handler