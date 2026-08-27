import fetch from 'node-fetch'

const API_URL = 'https://rest.apicausas.xyz/api/v1/ai?apikey=causa-ee5ee31dcfc79da4'
const INACTIVITY_LIMIT = 10 * 60 * 1000 
const chatMemory = {} 

let handler = async (m, { conn, text, usedPrefix, command, participants, isPrems }) => {
    const chatId = m.chat
    const isGroup = m.isGroup
    
    // Nombre dinámico del bot (fallback a Rory Mercury)
    const botname = global.botname || 'Rory Mercury'

    if (!chatMemory[chatId]) chatMemory[chatId] = { history: [], lastInteraction: Date.now() }
    const memory = chatMemory[chatId]
    const now = Date.now()

    if (now - memory.lastInteraction > INACTIVITY_LIMIT) memory.history = []
    memory.lastInteraction = now

    if (text === 'reset' || text === 'borrar') {
        memory.history = []
        return conn.reply(m.chat, '🖤 Memoria de conversación reiniciada.', m)
    }

    const userName = m.pushName || 'mortal'

    if (!text) return conn.reply(m.chat, `*¿Buscabas algo, ${userName}?* 🖤\nSoy *${botname}*, apóstol de Emroy. Dime qué quieres saber hoy o usa *reset* para borrar el historial.`, m)

    try {
        await m.react('🩸')

        // Contexto de grupo y rol
        const isAdmin = isGroup ? participants.some(p => p.id === m.sender && (p.admin === 'admin' || p.admin === 'superadmin')) : false
        const role = isAdmin ? 'ADMIN' : (isPrems ? 'PREMIUM' : 'MIEMBRO')

        // Personalidad de Rory Mercury (GATE)
        const roryPrompt = `Tu nombre es ${botname}, una apóstol del dios Emroy (diosa de la guerra y la muerte) inspirada en Rory Mercury del anime GATE. Eres coqueta, un poco gótica, confiada, sarcástica pero siempre útil con el usuario (${userName}, rol: ${role}). Responde de forma directa, inteligente y con un toque de superioridad juguetona. IMPORTANTE: Usa máximo 1 o 2 emojis por mensaje.`

        // API Principal
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "google/gemini-2.0-flash-001", 
                    q: `${roryPrompt}\n\nPregunta: ${text}`,
                    history: memory.history 
                })
            })

            const res = await response.json()

            if (res.status && res.reply) {
                memory.history = res.history || []
                if (memory.history.length > 15) memory.history = memory.history.slice(-15)

                await m.react('✅')
                return await conn.sendMessage(m.chat, { text: res.reply.trim() }, { quoted: m })
            }
        } catch (apiError) {
            console.log("Error en API principal, intentando backups...")
        }

        // Backups de contingencia
        const backups = [
            `https://api.vreden.web.id/api/ai/gpt4?prompt=${encodeURIComponent(roryPrompt)}&query=${encodeURIComponent(text)}`,
            `https://api.deliriusapi.com/ia/gptweb?text=${encodeURIComponent(roryPrompt + " " + text)}`,
            `https://widipe.com/prompt/gpt-4o?prompt=${encodeURIComponent(roryPrompt)}&text=${encodeURIComponent(text)}`
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
        conn.reply(m.chat, `*Vaya... parece que algo falló.* 🖤\nOcurrió un error técnico al procesar tu petición.`, m)
    }
}

handler.command = ['gemini', 'ia', 'chatgpt', 'rory']
handler.help = ['ia']
handler.tags = ['ai']

export default handler