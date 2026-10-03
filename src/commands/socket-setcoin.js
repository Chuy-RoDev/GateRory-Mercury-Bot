async function handler(m, { usedPrefix, command, text }) {
    const chatData = global.db.data.chats[m.chat]

    if (!text) return m.reply(
        `╭─「 💰 𝗦𝗲𝘁 𝗠𝗼𝗻𝗲𝗱𝗮 」\n` +
        `│ ꕤ Escribe el nombre de la moneda.\n` +
        `│\n` +
        `│ ✦ Ejemplo: *${usedPrefix + command} GemCoins*\n` +
        `╰─────────────────`
    )

    const anterior = global.currency
    chatData.currency = text.trim()
    global.currency = text.trim()
    await global.db.write()

    await m.react('✔️')
    m.reply(
        `╭─「 💰 𝗠𝗼𝗻𝗲𝗱𝗮 𝗔𝗰𝘁𝘂𝗮𝗹𝗶𝘇𝗮𝗱𝗮 」\n` +
        `│\n` +
        `│ ✦ Antes: *${anterior}*\n` +
        `│ ✦ Ahora: *${global.currency}*\n` +
        `│\n` +
        `│ _Aplicado para todos los grupos._\n` +
        `╰─────────────────`
    )
}

handler.help = ['setbotcoin']
handler.tags = ['owner']
handler.command = ['setbotcoin', 'setcurrency', 'setmoneda']
handler.group = true
handler.rowner = true
export default handler