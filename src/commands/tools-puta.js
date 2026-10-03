let handler = async (m, { conn, groupMetadata }) => {
    let mentionedJid = await m.mentionedJid
    let user = mentionedJid && mentionedJid.length ? mentionedJid[0] : m.quoted ? m.quoted.sender : m.sender

    let percentage = Math.floor(Math.random() * 101)

    let status = ''
    if (percentage <= 10) status = "😇 Inocente. Ni sabe lo que es eso."
    else if (percentage <= 25) status = "🤨 Portada de santa, capítulo de otra cosa."
    else if (percentage <= 45) status = "👀 Tiene sus cositas... pero discretita."
    else if (percentage <= 65) status = "💅 Ya le están saliendo las plumas, mija."
    else if (percentage <= 80) status = "🚨 En lista de espera del infierno."
    else if (percentage <= 94) status = "🔥 Profesional certificada. Sin vuelta atrás."
    else status = "👑 LEYENDA VIVIENTE. La mismísima."

    if (percentage >= 95 && m.isGroup) {
        let participants = groupMetadata.participants.map(p => p.id)
        let groupName = groupMetadata.subject

        let alertMsg = `╭─「 💋 𝗣𝘂𝘁ó𝗺𝗲𝘁𝗿𝗼 — 𝗔𝗟𝗘𝗥𝗧𝗔 𝗠Á𝗫𝗜𝗠𝗔 」\n│\n`
        alertMsg += `│ 🚨 *¡ALERTA MÁXIMA EN ${groupName.toUpperCase()}!*\n│\n`
        alertMsg += `│ 👤 @${user.split('@')[0]} alcanzó *${percentage}%*\n│\n`
        alertMsg += `│ 💋 _El grupo entero debe saberlo._\n`
        alertMsg += `│ _Miren todos._\n│\n`
        alertMsg += `╰─────────────────`

        await m.react('💋')
        return conn.sendMessage(m.chat, {
            text: alertMsg,
            mentions: [user, ...participants]
        }, { quoted: m })
    }

    let txt = `╭─「 💋 𝗣𝘂𝘁ó𝗺𝗲𝘁𝗿𝗼 𝗥𝗼𝗿𝘆 」\n│\n`
    txt += `│ 👤 *Usuario:* @${user.split('@')[0]}\n`
    txt += `│ 📊 *Porcentaje:* ${percentage}%\n`
    txt += `│ ⚠️ *Veredicto:*\n│ _${status}_\n│\n`
    txt += `╰─────────────────`

    await m.react('💋')
    await conn.sendMessage(m.chat, { text: txt, mentions: [user] }, { quoted: m })
}

handler.help = ['puta']
handler.tags = ['tools']
handler.command = ['puta', 'putometro', 'puto']
handler.group = true
export default handler