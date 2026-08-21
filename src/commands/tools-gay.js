let handler = async (m, { conn, groupMetadata }) => {
    let mentionedJid = await m.mentionedJid
    let user = mentionedJid && mentionedJid.length ? mentionedJid[0] : m.quoted ? m.quoted.sender : m.sender

    const name = await global.getProperName(conn, user)
    let percentage = Math.floor(Math.random() * 101)

    let status = ''
    if (percentage <= 10) status = "✨ Hetero real, nada que temer."
    else if (percentage <= 30) status = "🤔 Hetero, pero se le queda viendo al dúa."
    else if (percentage <= 50) status = "🌀 Dudoso... está en fase de experimentación."
    else if (percentage <= 75) status = "🏳️‍🌈 Sospechoso, ya le gusta el arroz con popote."
    else if (percentage <= 94) status = "✅ ¡Confirmado! Ya no hay vuelta atrás, fiera."
    else status = "👑 ¡NIVEL DIOS! Es el emperador del arcoíris."

    if (percentage >= 95 && m.isGroup) {
        let participants = groupMetadata.participants.map(p => p.id)
        let groupName = groupMetadata.subject

        let alertMsg = `╭─「 🏳️‍🌈 𝗝𝗼𝘁ó𝗺𝗲𝘁𝗿𝗼 — 𝗔𝗟𝗘𝗥𝗧𝗔 」\n│\n`
        alertMsg += `│ ⚠️ *¡ALERTA DE GAY EN ${groupName.toUpperCase()}!*\n│\n`
        alertMsg += `│ 👤 *${name}* salió del clóset\n`
        alertMsg += `│ con un *${percentage}%* 🏳️‍🌈\n│\n`
        alertMsg += `│ _¡Miren todos a esta loca!_\n│\n`
        alertMsg += `╰─────────────────`

        await m.react('🏳️‍🌈')
        return conn.sendMessage(m.chat, {
            text: alertMsg,
            mentions: [user, ...participants]
        }, { quoted: m })
    }

    let txt = `╭─「 🏳️‍🌈 𝗝𝗼𝘁ó𝗺𝗲𝘁𝗿𝗼 𝗥𝗼𝗿𝘆 」\n│\n`
    txt += `│ 👤 *Usuario:* *${name}*\n`
    txt += `│ 📊 *Porcentaje:* ${percentage}%\n`
    txt += `│ ⚠️ *Estado:*\n│ _${status}_\n│\n`
    txt += `╰─────────────────`

    await m.react('📊')
    await conn.sendMessage(m.chat, { text: txt, mentions: [user] }, { quoted: m })
}

handler.help = ['gay']
handler.tags = ['tools']
handler.command = ['gay', 'gei', 'jotometro', 'joto']
handler.group = true
export default handler