const handler = async (m, { text, usedPrefix, command, isROwner, settings }) => {
    if (!isROwner) return

    let isEnable = /on|activar|1/i.test(text)
    let isDisable = /off|desactivar|0/i.test(text)

    // El estado vive en DOS lados: global.opts (efecto inmediato) y la db
    // (settings.onlycc, sobrevive reinicios). Antes solo se escribía global.opts
    // e index.js lo reconstruye al arrancar — el /onlycc se perdía al reiniciar.
    const setEstado = (v) => {
        global.opts['onlycc'] = v
        try { settings.onlycc = v } catch { }
    }
    const estadoActual = () => !!(global.opts['onlycc'] || settings?.onlycc)

    if (isEnable) {
        setEstado(true)
        m.reply(`╭─「 ⚙️ 𝗢𝗻𝗹𝘆𝗖𝗖 」\n│\n│ ✔️ *Activado*\n│ _Solo el Creador puede usar el bot._\n│\n╰─────────────────`)
    } else if (isDisable) {
        setEstado(false)
        m.reply(`╭─「 ⚙️ 𝗢𝗻𝗹𝘆𝗖𝗖 」\n│\n│ ✔️ *Desactivado*\n│ _El bot vuelve a ser público._\n│\n╰─────────────────`)
    } else {
        let status = estadoActual() ? '✅ Activo' : '❌ Inactivo'
        m.reply(`╭─「 ⚙️ 𝗢𝗻𝗹𝘆𝗖𝗖 」\n│\n│ ✦ *Estado:* ${status}\n│\n│ _${usedPrefix + command} on_ — activar\n│ _${usedPrefix + command} off_ — desactivar\n│\n╰─────────────────`)
    }
}

handler.help = ['onlycc']
handler.tags = ['owner']
handler.command = ['onlycc', 'cc', 'control']
handler.rowner = true
export default handler
