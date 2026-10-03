let handler = async (m, { conn, groupMetadata }) => {
    let mentionedJid = await m.mentionedJid
    let user = mentionedJid && mentionedJid.length ? mentionedJid[0] : m.quoted ? m.quoted.sender : m.sender

    const name = await global.getProperName(conn, user)
    let percentage = Math.floor(Math.random() * 101)

    let status = ''
    if (percentage <= 10) status = "🏳️‍🌈 Hetero... sí claro. Ni tú te lo crees."
    else if (percentage <= 25) status = "🤔 Le llama 'amigo especial' a su amigo especial."
    else if (percentage <= 45) status = "😐 Neutral sospechoso. El tipo que 'solo pregunta'."
    else if (percentage <= 65) status = "🧍 Hetero funcional. Aburrido, pero hetero."
    else if (percentage <= 80) status = "✅ Bastante hetero. Probablemente tiene pickup truck."
    else if (percentage <= 94) status = "💪 Hetero de manual. Le gustan las motos y el fútbol."
    else status = "🗿 HETERO PURO. Llora solo con el Chavo del 8."

    if (percentage >= 95 && m.isGroup) {
        let participants = groupMetadata.participants.map(p => p.id)
        let groupName = groupMetadata.subject

        let alertMsg = `╭─「 🗿 𝗛𝗲𝘁𝗲𝗿ó𝗺𝗲𝘁𝗿𝗼 — 𝗙𝗘𝗡Ó𝗠𝗘𝗡𝗢 」\n│\n`
        alertMsg += `│ 🗿 *¡ESPÉCIMEN RARO EN ${groupName.toUpperCase()}!*\n│\n`
        alertMsg += `│ 👤 *${name}* marcó *${percentage}%* hetero.\n│\n`
        alertMsg += `│ _Esto ya es un fenómeno de la naturaleza._\n`
        alertMsg += `│ _Denle un aplauso._\n│\n`
        alertMsg += `╰─────────────────`

        await m.react('🗿')
        return conn.sendMessage(m.chat, {
            text: alertMsg,
            mentions: [user, ...participants]
        }, { quoted: m })
    }

    let txt = `╭─「 🗿 𝗛𝗲𝘁𝗲𝗿ó𝗺𝗲𝘁𝗿𝗼 𝗥𝗼𝗿𝘆 」\n│\n`
    txt += `│ 👤 *Usuario:* *${name}*\n`
    txt += `│ 📊 *Porcentaje:* ${percentage}%\n`
    txt += `│ ⚠️ *Veredicto:*\n│ _${status}_\n│\n`
    txt += `╰─────────────────`

    await m.react('🗿')
    await conn.sendMessage(m.chat, { text: txt, mentions: [user] }, { quoted: m })
}

handler.help = ['hetero']
handler.tags = ['tools']
handler.command = ['hetero', 'heterometro', 'straight']
handler.group = true
export default handler