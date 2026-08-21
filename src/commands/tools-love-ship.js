let handler = async (m, { conn, usedPrefix, command }) => {
    let mentionedJid = await m.mentionedJid || []
    let user1, user2

    if (mentionedJid.length >= 2) {
        user1 = mentionedJid[0]
        user2 = mentionedJid[1]
    } else if (mentionedJid.length === 1) {
        user1 = m.sender
        user2 = mentionedJid[0]
    } else {
        return m.reply(
            `╭─「 💘 𝗦𝗵𝗶𝗽 」\n` +
            `│ ꕤ Menciona al menos una persona.\n` +
            `│\n` +
            `│ ✦ *${usedPrefix + command} @persona*\n` +
            `│ ✦ *${usedPrefix + command} @persona1 @persona2*\n` +
            `╰─────────────────`
        )
    }

    const name1 = await global.getProperName(conn, user1)
    const name2 = await global.getProperName(conn, user2)
    const shipName = name1.slice(0, Math.ceil(name1.length / 2)) + name2.slice(Math.floor(name2.length / 2))
    const porcentaje = Math.floor(Math.random() * 101)

    const getEmoji = (p) => {
        if (p <= 10) return '💀'
        if (p <= 20) return '😬'
        if (p <= 30) return '😐'
        if (p <= 40) return '🙂'
        if (p <= 50) return '😊'
        if (p <= 60) return '😍'
        if (p <= 70) return '💕'
        if (p <= 80) return '💞'
        if (p <= 90) return '💖'
        return '💘'
    }

    const getTexto = (p) => {
        if (p <= 10) return 'No hay ninguna chispa entre ellos...'
        if (p <= 20) return 'La conexión es casi inexistente.'
        if (p <= 30) return 'Apenas se toleran.'
        if (p <= 40) return 'Hay algo, pero muy débil.'
        if (p <= 50) return 'Una amistad especial, quizás algo más.'
        if (p <= 60) return 'Hay química, pero falta valor.'
        if (p <= 70) return 'Se llevan muy bien, la chispa existe.'
        if (p <= 80) return 'Una conexión fuerte y bonita.'
        if (p <= 90) return 'Están hechos el uno para el otro.'
        return 'Amor perfecto, destinados a estar juntos.'
    }

    const barra = Math.floor(porcentaje / 10)
    const barraVisual = '█'.repeat(barra) + '░'.repeat(10 - barra)

    const msg =
        `╭─「 💘 𝗦𝗵𝗶𝗽𝗺𝗲𝘁𝗲𝗿 」\n` +
        `│\n` +
        `│ ✦ *${name1}* 🤝 *${name2}*\n` +
        `│ ✦ 𝗡𝗼𝗺𝗯𝗿𝗲: *${shipName}*\n` +
        `│\n` +
        `│ ${barraVisual}\n` +
        `│ ${getEmoji(porcentaje)} *${porcentaje}%* de compatibilidad\n` +
        `│\n` +
        `│ ${getTexto(porcentaje)}\n` +
        `╰─────────────────`

    await conn.reply(m.chat, msg, m, { mentions: [user1, user2] })
}

handler.help = ['love @persona', 'love @persona1 @persona2']
handler.tags = ['diversion']
handler.command = ['Shipear', 'ship', 'compatibilidad']
export default handler