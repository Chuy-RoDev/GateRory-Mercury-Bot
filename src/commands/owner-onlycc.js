const handler = async (m, { text, usedPrefix, command, isROwner }) => {
    if (!isROwner) return

    let isEnable = /on|activar|1/i.test(text)
    let isDisable = /off|desactivar|0/i.test(text)

    if (isEnable) {
        global.opts['onlycc'] = true
        m.reply(`╭─「 ⚙️ 𝗢𝗻𝗹𝘆𝗖𝗖 」\n│\n│ ✔️ *Activado*\n│ _Solo el Creador puede usar el bot._\n│\n╰─────────────────`)
    } else if (isDisable) {
        global.opts['onlycc'] = false
        m.reply(`╭─「 ⚙️ 𝗢𝗻𝗹𝘆𝗖𝗖 」\n│\n│ ✔️ *Desactivado*\n│ _El bot vuelve a ser público._\n│\n╰─────────────────`)
    } else {
        let status = global.opts['onlycc'] ? '✅ Activo' : '❌ Inactivo'
        m.reply(`╭─「 ⚙️ 𝗢𝗻𝗹𝘆𝗖𝗖 」\n│\n│ ✦ *Estado:* ${status}\n│\n│ _${usedPrefix + command} on_ — activar\n│ _${usedPrefix + command} off_ — desactivar\n│\n╰─────────────────`)
    }
}

handler.help = ['onlycc']
handler.tags = ['owner']
handler.command = ['onlycc', 'cc', 'control']
handler.rowner = true
export default handler