import fetch from 'node-fetch'

const API_URL = 'https://rest.apicausas.xyz/api/v1/ai?apikey=causa-ee5ee31dcfc79da4'
const INACTIVITY_LIMIT = 10 * 60 * 1000 
const chatMemory = {} 

let handler = async (m, { conn, text, usedPrefix, command, participants, isPrems }) => {
    const chatId = m.chat
    const isGroup = m.isGroup
    
    if (!chatMemory[chatId]) chatMemory[chatId] = { history: [], lastInteraction: Date.now() }
    const memory = chatMemory[chatId]
    const now = Date.now()

    if (now - memory.lastInteraction > INACTIVITY_LIMIT) memory.history = []
    memory.lastInteraction = now

    if (text === 'reset' || text === 'borrar') {
        memory.history = []
        return conn.reply(m.chat, '✅ Memoria reiniciada.', m)
    }

    if (!text) return conn.reply(m.chat, `Hola, soy Shiroko. 🛠️\n¿En qué puedo ayudarte hoy?`, m)

    try {
        await m.react('🛠️')

        const userName = m.pushName || 'Usuario'

        // PERSONALIDAD EQUILIBRADA: Útil, activa y con pocos emojis
        const shirokoPrompt = `Tu nombre es Shiroko, estudiante de Abydos. Eres amable, eficiente y directa. Tu objetivo es ayudar al usuario (${userName}) con respuestas claras y completas. IMPORTANTE: No uses más de uno o dos emojis en toda tu respuesta. Mantén un tono profesional pero cercano.`

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "google/gemini-2.0-flash-001", 
                    q: `${shirokoPrompt}\n\nPregunta: ${text}`,
                    history: memory.history 
                })
            })

            const res = await response.json()

            if (res.status && res.reply) {
                memory.history = res.history
                if (memory.history.length > 15) memory.history = memory.history.slice(-15)

                await m.react('✅')
                return await conn.sendMessage(m.chat, { text: res.reply.trim() }, { quoted: m })
            }
        } catch (apiError) {
            console.log("Error en API principal.")
        }

        // BACKUPS (Siguiendo la regla de pocos emojis)
        const backups = [
            `https://api.vreden.web.id/api/ai/gpt4?prompt=${encodeURIComponent(shirokoPrompt)}&query=${encodeURIComponent(text)}`,
            `https://api.deliriusapi.com/ia/gptweb?text=${encodeURIComponent(shirokoPrompt + " " + text)}`,
            `https://widipe.com/prompt/gpt-4o?prompt=${encodeURIComponent(shirokoPrompt)}&text=${encodeURIComponent(text)}`
        ]

        let backupText = null
        for (const url of backups) {
            try {
                const bRes = await fetch(url)
                const bJson = await bRes.json()
                backupText = bJson.result || bJson.gpt || bJson.response || (bJson.data && bJson.data.content)
                if (backupText) break
            } catch (e) { continue }
        }

        if (backupText) {
            await m.react('✅')
            await conn.sendMessage(m.chat, { text: backupText.trim() }, { quoted: m })
        } else {
            throw new Error('Sin conexión')
        }

    } catch (error) {
        await m.react('❌')
        conn.reply(m.chat, `Lo siento, hubo un problema técnico. ¿Podemos intentarlo de nuevo? 🛠️`, m)
    }
}

handler.command = ['gemini', 'ia', 'chatgpt', 'shiroko']
handler.help = ['ia']
handler.tags = ['ai']
handler.group = true

export default handler