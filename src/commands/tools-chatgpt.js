import fetch from 'node-fetch'

// ─────────────────────────────────────────────────────────────
// CADENA DE IA (reemplaza apicausas/vreden/deliriusapi/widipe, dominios muertos)
//  1. text.pollinations.ai → gratuita, sin key, responde texto plano
//  2. alyacore /ai/copilot → reserva (estaba offline temporalmente)
// ─────────────────────────────────────────────────────────────

const ALYACORE_KEY = 'oboe'
const INACTIVITY_LIMIT = 10 * 60 * 1000
const chatMemory = {}

async function iaPollinations(prompt) {
    const r = await fetch('https://text.pollinations.ai/' + encodeURIComponent(prompt), {
        signal: AbortSignal.timeout(60000)
    })
    if (!r.ok) throw new Error(`pollinations HTTP ${r.status}`)
    const texto = await r.text()
    if (!texto || texto.length < 1) throw new Error('pollinations respondió vacío')
    return texto
}

async function iaAlyacore(prompt) {
    const r = await fetch(`https://api.alyacore.xyz/ai/copilot?text=${encodeURIComponent(prompt)}&key=${ALYACORE_KEY}`, {
        signal: AbortSignal.timeout(60000)
    })
    const j = await r.json().catch(() => null)
    const texto = j?.data?.response || j?.data?.text || j?.result || j?.data?.message
    if (!j?.status || !texto) throw new Error('alyacore sin respuesta útil')
    return texto
}

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

        // historial reciente incluido en el prompt (las APIs de reserva no mantienen sesión)
        const contexto = memory.history.slice(-6)
            .map(h => `${h.role === 'user' ? userName : botname}: ${h.content}`)
            .join('\n')
        const promptCompleto = `${roryPrompt}${contexto ? `\n\nConversación anterior:\n${contexto}` : ''}\n\nPregunta: ${text}\n\nResponde SOLO como ${botname}, sin prefijos ni acotaciones.`

        // cadena: pollinations → alyacore
        let respuesta = null
        for (const api of [iaPollinations, iaAlyacore]) {
            try {
                respuesta = await api(promptCompleto)
                if (respuesta) break
            } catch (e) {
                console.log(`[IA] ${e.message}, probando la siguiente...`)
            }
        }

        if (!respuesta) throw new Error('Sin conexión')

        memory.history.push({ role: 'user', content: text })
        memory.history.push({ role: 'bot', content: respuesta.trim() })
        if (memory.history.length > 15) memory.history = memory.history.slice(-15)

        await m.react('✅')
        await conn.sendMessage(m.chat, { text: respuesta.trim() }, { quoted: m })

    } catch (error) {
        await m.react('❌')
        conn.reply(m.chat, `*Vaya... parece que algo falló.* 🖤\nOcurrió un error técnico al procesar tu petición.`, m)
    }
}

handler.command = ['gemini', 'ia', 'chatgpt', 'rory']
handler.help = ['ia']
handler.tags = ['ai']

export default handler
