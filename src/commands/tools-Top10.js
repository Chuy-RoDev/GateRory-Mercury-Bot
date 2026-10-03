const handler = async (m, { conn, text, groupMetadata, usedPrefix, command }) => {
    if (!text) return conn.reply(m.chat, `╭─「 🏆 𝗧𝗼𝗽 𝟭𝟬 」\n│\n│ ✦ Escribe el tema del ranking.\n│ _Uso:_ *${usedPrefix + command} <texto>*\n│\n╰─────────────────`, m)

    const participants = groupMetadata.participants
    if (participants.length < 5) return conn.reply(m.chat, `╭─「 ⚠︎ 𝗘𝗿𝗿𝗼𝗿 」\n│\n│ ✦ Grupo muy pequeño para un top.\n│\n╰─────────────────`, m)

    const emojisTop = ['🏆', '🥇', '👑', '⭐', '✨', '🔥', '🎯', '💎', '🚀', '⚡']
    const mainEmoji = emojisTop[Math.floor(Math.random() * emojisTop.length)]

    // 5% de probabilidad de modo global
    const isGlobal = Math.random() < 0.05

    // Top 10 con repetidos permitidos (azar puro)
    let selected = []
    for (let i = 0; i < 10; i++) {
        selected.push(participants[Math.floor(Math.random() * participants.length)])
    }

    // Contar repeticiones — huevo de pascua si alguien sale 3+ veces
    const counts = {}
    selected.forEach(u => { counts[u.id] = (counts[u.id] || 0) + 1 })
    const victimId = Object.keys(counts).find(id => counts[id] >= 3)
    const isSpammy = !!victimId

    // Construir texto con decoración nueva
    let txt = isGlobal
        ? `╭─「 🌐 𝗥𝗮𝗻𝗸𝗶𝗻𝗴 𝗚𝗹𝗼𝗯𝗮𝗹 — ${text.toUpperCase()} 」\n│\n`
        : `╭─「 ${mainEmoji} 𝗧𝗼𝗽 𝟭𝟬 — ${text.toUpperCase()} 」\n│\n`

    selected.forEach((user, index) => {
        txt += `│ *${index + 1}.* @${user.id.split('@')[0]}\n`
    })

    txt += `│\n`

    if (isSpammy) {
        const allMemberIds = participants.map(u => u.id)
        txt += `│ 📢 @${victimId.split('@')[0]} salió *${counts[victimId]} veces*.\n`
        txt += `│ 🔥 _¡El más ${text} de todos!_\n│\n`
        txt += `╰─────────────────`

        return conn.sendMessage(m.chat, {
            text: txt,
            mentions: [...allMemberIds, ...selected.map(u => u.id)]
        }, { quoted: m })
    }

    txt += isGlobal ? `│ 🌍 _Este ranking es ley._\n│\n` : `│ ${mainEmoji} _Azar total._\n│\n`
    txt += `╰─────────────────`

    await conn.sendMessage(m.chat, {
        text: txt,
        mentions: selected.map(u => u.id)
    }, { quoted: m })
}

handler.help = ['top10']
handler.tags = ['tools']
handler.command = ['top', 'top10']
handler.group = true
export default handler