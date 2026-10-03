let handler = async (m, { conn, usedPrefix, command }) => {
    const quoted = m.quoted ? m.quoted : m
    const mime = (quoted.msg || quoted).mimetype || ''

    if (!/image/.test(mime)) return m.reply(`Cita o envía una imagen junto al comando.\nUso: ${usedPrefix}${command}`)

    const img = await quoted.download()
    const chatData = global.db.data.chats[m.chat]
    chatData.menuImage = img.toString('base64')
    await global.db.write()

    await m.react('✔️')
    m.reply(`*Banner del menú actualizado.*\n\n> Solo aplica en este grupo.`)
}

handler.help = ['setbanner']
handler.tags = ['owner']
handler.command = ['setbotbanner', 'setmenuimg', 'bannermenu']
handler.group = true
handler.rowner = true
export default handler