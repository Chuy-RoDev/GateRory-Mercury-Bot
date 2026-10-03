let handler = async (m, { usedPrefix, command }) => {
    const chatData = global.db.data.chats[m.chat]

    delete chatData.botname
    delete chatData.menuImage
    delete chatData.currency

    await global.db.write()
    await m.react('✔️')
    m.reply(`*Configuración del grupo restablecida*\n\n• Nombre del bot: ${global.botname}\n• Banner: imagen global\n• Moneda: ${global.currency}\n\n> Todo volvió a los valores por defecto.`)
}

handler.help = ['botresetall']
handler.tags = ['owner']
handler.command = ['botresetall', 'resetbot', 'resetconfig']
handler.group = true
handler.rowner = true
export default handler