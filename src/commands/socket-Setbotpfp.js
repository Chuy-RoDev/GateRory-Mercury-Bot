let handler = async (m, { usedPrefix, command }) => {
    const quoted = m.quoted ? m.quoted : m
    const mime = (quoted.msg || quoted).mimetype || ''

    if (!/image/.test(mime)) return m.reply(`Cita o envía una imagen junto al comando.\nUso: ${usedPrefix}${command}`)

    const img = await quoted.download()
    const chatData = global.db.data.chats[m.chat]
    chatData.botpfp = img.toString('base64')
    await global.db.write()

    await m.react('✔️')
    m.reply(`*Foto de perfil del bot actualizada.*\n\n> Solo aplica en este grupo.`)
}

handler.help = ['setbotpfp']
handler.tags = ['owner']
handler.command = ['setbotpfp', 'botpfp', 'setbotfoto']
handler.group = true
handler.rowner = true
export default handler