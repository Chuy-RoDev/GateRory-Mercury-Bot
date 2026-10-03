const handler = async (m, { conn, text, usedPrefix, command }) => {
    if (!text) return conn.reply(m.chat, `╭─「 🔮 𝟴𝗕𝗮𝗹𝗹 」\n│\n│ ✦ Hazme una pregunta y te responderé.\n│ _Uso:_ *${usedPrefix + command} ¿Seré millonario?*\n│\n╰─────────────────`, m)

    const respuestas = [
        "✨ Sí, definitivamente.",
        "💫 Es cierto.",
        "✅ Sin duda alguna.",
        "🌟 Todo apunta a que sí.",
        "🌀 Es muy probable.",
        "⏳ Pregunta de nuevo más tarde.",
        "🌫️ No puedo predecirlo ahora.",
        "🧘 Concéntrate y pregunta otra vez.",
        "🤔 No lo sé, está confuso.",
        "❌ No cuentes con ello.",
        "🚫 Mi respuesta es no.",
        "🌪️ Mis fuentes dicen que no.",
        "💀 Las perspectivas no son buenas.",
        "📉 Muy dudosamente."
    ]

    const resultado = respuestas[Math.floor(Math.random() * respuestas.length)]

    let txt = `╭─「 🔮 𝗕𝗼𝗹𝗮 𝗠á𝗴𝗶𝗰𝗮 」\n│\n`
    txt += `│ ❓ *Pregunta:*\n│ _${text}_\n│\n`
    txt += `│ 🔮 *Rory dice:*\n│ _${resultado}_\n│\n`
    txt += `╰─────────────────`

    await m.react('🔮')
    await conn.sendMessage(m.chat, { text: txt }, { quoted: m })
}

handler.help = ['8ball']
handler.tags = ['tools']
handler.command = ['8ball', 'pregunta']
export default handler