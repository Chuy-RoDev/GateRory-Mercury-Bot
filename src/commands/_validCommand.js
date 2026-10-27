let handler = m => m

handler.before = async function (m, { conn }) {
    // global.prefix es un RegExp (index.js lo reescribe al arrancar desde el array de
    // src/config.js). Si por algún orden de carga llegara a ser aún el array, no tiene
    // .test() y esto reventaría: salimos sin romper nada.
    if (!m.text || !(global.prefix instanceof RegExp)) return
    if (!global.prefix.test(m.text)) return

    const usedPrefix = global.prefix.exec(m.text)[0]
    const command = m.text.slice(usedPrefix.length).trim().split(' ')[0].toLowerCase()
    
    if (!command) return 

    let chat = global.db.data.chats?.[m.chat] || {}
    let settings = global.db.data.settings?.[this.user.jid] || {}
    let owner = global.owner?.some(([num]) => num && (num.replace(/[^0-9]/g, "") + "@s.whatsapp.net") === m.sender)
    
    if (chat.modoadmin || settings.self || (chat.isMute && !owner) || (chat.isBanned && !owner)) return

    const plugins = global.plugins
    // FIX: varios plugins declaran command como RegExp (ej: /^s(ticker)?$/i).
    // Antes solo se comparaba con === (identidad), así que un regex NUNCA daba true
    // y el bot respondía "Comando no encontrado" a comandos que sí existen.
    const isCommand = Object.values(plugins).some(p =>
        p.command && (Array.isArray(p.command) ? p.command.includes(command)
            : p.command instanceof RegExp ? p.command.test(command)
            : p.command === command)
    )

    if (!isCommand) {
        await conn.sendMessage(m.chat, { 
            text: `ꕤ *Comando no encontrado*\n\n❒ *${command}* no existe\n✰ Usa *${usedPrefix}help* para ver la lista de comandos` 
        }, { quoted: m })
    }
}

export default handler