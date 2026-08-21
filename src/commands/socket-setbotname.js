let handler = async (m, { conn, text, usedPrefix, command }) => {
    if (!text) return m.reply(`Uso: ${usedPrefix}${command} <nombre>\nEjemplo: ${usedPrefix}${command} Shiroko`)

    const chatData = global.db.data.chats[m.chat]
    const anterior = chatData.botname || global.botname
    chatData.botname = text.trim()
    await global.db.write()

    await m.react('✔️')
    m.reply(`*Nombre del bot actualizado*\n\nAntes: ${anterior}\nAhora: ${chatData.botname}\n\n> Solo aplica en este grupo.`)
}

handler.help = ['setbotname <nombre>']
handler.tags = ['owner']
handler.command = ['setbotname', 'botnombre']
handler.group = true
handler.rowner = true
export default handler