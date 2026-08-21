let handler = async (m, { conn, groupMetadata }) => {
    let mentionedJid = await m.mentionedJid
    let user = mentionedJid && mentionedJid.length ? mentionedJid[0] : m.quoted ? m.quoted.sender : m.sender

    const name = await global.getProperName(conn, user)
    let percentage = Math.floor(Math.random() * 101)

    let status = ''
    if (percentage <= 10) status = "☀️ Feliz y funcional. Asqueroso."
    else if (percentage <= 25) status = "🌧️ Le pone sad playlist cuando llueve. Indicios."
    else if (percentage <= 45) status = "🖤 Ya tiene una canción de Twenty One Pilots favorita."
    else if (percentage <= 65) status = "✂️ El flequillo le tapa un ojo y no es accidente."
    else if (percentage <= 80) status = "🩸 Llora con las luces apagadas escuchando Evanescence."
    else if (percentage <= 94) status = "⛓️ Full emo. El cuarto tiene luces moradas y posters de Naruto."
    else status = "🦇 NIVEL FINAL. Se cree vampiro y odia los lunes en serio."

    await m.react('🖤')

    if (percentage >= 95 && m.isGroup) {
        let participants = groupMetadata.participants.map(p => p.id)
        let groupName = groupMetadata.subject

        let alertMsg = `╭─「 🦇 𝗘𝗺ó𝗺𝗲𝘁𝗿𝗼 — 𝗔𝗟𝗘𝗥𝗧𝗔 𝗠Á𝗫𝗜𝗠𝗔 」\n│\n`
        alertMsg += `│ 🦇 *¡EMO NIVEL DIOS EN ${groupName.toUpperCase()}!*\n│\n`
        alertMsg += `│ 👤 *${name}* alcanzó *${percentage}%*\n│\n`
        alertMsg += `│ _Alguien avísenle a la madre._\n`
        alertMsg += `│ _Ya no hay solución._\n│\n`
        alertMsg += `╰─────────────────`

        return conn.sendMessage(m.chat, {
            text: alertMsg,
            mentions: [user, ...participants]
        }, { quoted: m })
    }

    let txt = `╭─「 🖤 𝗘𝗺ó𝗺𝗲𝘁𝗿𝗼 𝗥𝗼𝗿𝘆 」\n│\n`
    txt += `│ 👤 *Usuario:* *${name}*\n`
    txt += `│ 📊 *Porcentaje:* ${percentage}%\n`
    txt += `│ ⚠️ *Veredicto:*\n│ _${status}_\n│\n`
    txt += `╰─────────────────`

    await conn.sendMessage(m.chat, { text: txt, mentions: [user] }, { quoted: m })
}

handler.help = ['emo']
handler.tags = ['tools']
handler.command = ['emo', 'emometro', 'darkmetro']
handler.group = true
export default handler