import fs from 'fs'
import path from 'path'

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const cleanUnicode = (str) => {
    if (!str) return ''
    return str
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\p{Cf}/gu, '')
        .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2060\u061C]/g, '')
}

const getCleanNumber = (jid) => jid ? String(jid).split('@')[0].split(':')[0].replace(/[^0-9]/g, '') : ''

// Desfase dinámico mejorado para evitar que múltiples bots tiren en el mismo milisegundo
const getBotStaggerDelay = (botNumber) => {
    const num = parseInt(botNumber.slice(-4), 10) || 0
    const baseDelay = (num % 5) * 2500 // Separación de 2.5s por bot
    const jitter = Math.floor(Math.random() * 1000) // Variación aleatoria de 0-1s
    return baseDelay + jitter
}

const getConfigPath = (botNumber) => {
    const botDir = path.join('./database/autorw', botNumber)
    if (!fs.existsSync(botDir)) fs.mkdirSync(botDir, { recursive: true })
    return path.join(botDir, 'config.json')
}

const loadConfig = (botNumber) => {
    const configPath = getConfigPath(botNumber)
    const defaultConfig = { minValor: 8000, groups: {} }

    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2))
        return defaultConfig
    }

    try {
        const fileContent = fs.readFileSync(configPath, 'utf8')
        if (!fileContent.trim()) {
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2))
            return defaultConfig
        }
        const data = JSON.parse(fileContent)
        if (!data.groups) data.groups = {}
        if (typeof data.minValor !== 'number') data.minValor = parseInt(data.minValor, 10) || 8000
        return data
    } catch {
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2))
        return defaultConfig
    }
}

const saveConfig = (botNumber, data) => {
    const configPath = getConfigPath(botNumber)
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2))
}

const getGroupConfig = (config, chat) => {
    if (!config.groups[chat]) {
        config.groups[chat] = {
            enabled: false,
            minValor: 8000
        }
    }
    return config.groups[chat]
}

const getBotState = (botNumber, chat) => {
    if (!global.autorwStates) global.autorwStates = {}
    const key = `${botNumber}_${chat}`
    if (!global.autorwStates[key]) {
        global.autorwStates[key] = {
            status: 'IDLE',
            lastGinfoSent: 0,
            lastRwSent: 0,
            botName: ''
        }
    }
    return global.autorwStates[key]
}

const parseCooldown = (text, typePattern) => {
    const cleaned = cleanUnicode(text)
    if (!cleaned) return 0
    const lines = cleaned.split(/[\n\r]+/)
    const line = lines.find(l => new RegExp(typePattern, 'i').test(l)) || cleaned

    const lower = line.toLowerCase()
    if (/listo|disponible|ready|ahora/i.test(lower) && !/espera|cooldown|faltan|\d+\s*m/i.test(lower)) return 0

    const minsMatch = lower.match(/(\d+)\s*(?:m|min|minutos?)/i)
    const secsMatch = lower.match(/(\d+)\s*(?:s|seg|segundos?)/i)
    const hoursMatch = lower.match(/(\d+)\s*(?:h|horas?)/i)

    const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0
    const mins = minsMatch ? parseInt(minsMatch[1], 10) : 0
    const secs = secsMatch ? parseInt(secsMatch[1], 10) : 0

    const totalMs = (hours * 3600 + mins * 60 + secs) * 1000
    return totalMs > 0 ? totalMs : 0
}

const parseValue = (text) => {
    const cleaned = cleanUnicode(text)
    if (!cleaned) return 0

    const lines = cleaned.split(/[\n\r]+/)
    const valorLine = lines.find(l => /Valor\s*»|Valor\s*:/i.test(l) && !/Valor\s*total/i.test(l))
    if (!valorLine) return 0

    const afterValor = valorLine.substring(valorLine.search(/Valor/i))
    const match = afterValor.match(/([\d.,]+)\s*(k|m)?/i)
    if (!match) return 0

    let rawNum = match[1]
    const mult = match[2]?.toLowerCase()

    if (mult === 'k' || mult === 'm') {
        rawNum = rawNum.replace(',', '.')
        let val = parseFloat(rawNum)
        if (isNaN(val)) return 0
        if (mult === 'k') val *= 1000
        if (mult === 'm') val *= 1000000
        return Math.round(val)
    } else {
        let numStr = rawNum.replace(/[,.]/g, '')
        let val = parseInt(numStr, 10)
        return isNaN(val) ? 0 : val
    }
}

const resetTimer = (conn, botNumber, chat, timeMs = 10 * 60 * 1000) => {
    if (!global.autorwTimersByBot) global.autorwTimersByBot = {}
    if (!global.autorwTimersByBot[botNumber]) global.autorwTimersByBot[botNumber] = {}
    const timers = global.autorwTimersByBot[botNumber]

    if (timers[chat]) clearTimeout(timers[chat])

    const stagger = getBotStaggerDelay(botNumber)

    timers[chat] = setTimeout(async () => {
        let config = loadConfig(botNumber)
        let gConfig = getGroupConfig(config, chat)
        let state = getBotState(botNumber, chat)

        if (!gConfig.enabled) return

        state.status = 'WAITING_GINFO'
        state.lastGinfoSent = Date.now()

        await delay(stagger)
        await conn.sendMessage(chat, { text: '#ginfo' })
        resetTimer(conn, botNumber, chat, 10 * 60 * 1000)
    }, timeMs)
}

let handler = async (m, { conn, args, usedPrefix, command }) => {
    const myCleanNumber = getCleanNumber(conn.user?.jid)
    if (!myCleanNumber) return

    let config = loadConfig(myCleanNumber)
    const chat = m.chat
    const gConfig = getGroupConfig(config, chat)
    const state = getBotState(myCleanNumber, chat)
    const subCommand = args[0]?.toLowerCase()

    if (subCommand === 'off') {
        gConfig.enabled = false
        state.status = 'IDLE'
        saveConfig(myCleanNumber, config)
        if (global.autorwTimersByBot?.[myCleanNumber]?.[chat]) {
            clearTimeout(global.autorwTimersByBot[myCleanNumber][chat])
        }
        return conn.sendMessage(chat, { text: `ꕤ AutoRW desactivado para @${myCleanNumber}.` }, { quoted: m })
    }

    if (subCommand === 'min') {
        const newMin = parseInt(args[1], 10)
        if (isNaN(newMin) || newMin < 0) {
            return conn.sendMessage(chat, { text: `ꕤ Usa: *${usedPrefix + command} min [número]*` }, { quoted: m })
        }
        config.minValor = newMin
        saveConfig(myCleanNumber, config)
        return conn.sendMessage(chat, { text: `ꕤ Valor mínimo para @${myCleanNumber} actualizado a: *${newMin}*` }, { quoted: m })
    }

    if (subCommand === 'sync') {
        const stagger = getBotStaggerDelay(myCleanNumber)
        
        gConfig.enabled = true
        saveConfig(myCleanNumber, config)

        state.status = 'WAITING_GINFO'
        state.lastGinfoSent = Date.now()

        resetTimer(conn, myCleanNumber, chat, 10 * 60 * 1000)
        await conn.sendMessage(chat, { text: `ꕤ AutoRW activado para @${myCleanNumber}. Sincronizando...` }, { quoted: m })
        
        await delay(stagger)
        state.lastGinfoSent = Date.now()
        return conn.sendMessage(chat, { text: '#ginfo' })
    }

    return conn.sendMessage(chat, { text: `Usa:\n*${usedPrefix + command} sync* - Activar\n*${usedPrefix + command} min [número]* - Valor mínimo\n*${usedPrefix + command} off* - Desactivar` }, { quoted: m })
}

handler.before = async function (m, { conn }) {
    if (!m.chat || m.isBaileys) return

    const myCleanNumber = getCleanNumber(conn.user?.jid)
    if (!myCleanNumber) return

    const chat = m.chat
    let config = loadConfig(myCleanNumber)
    const gConfig = getGroupConfig(config, chat)
    const state = getBotState(myCleanNumber, chat)

    if (!gConfig.enabled) return

    let rawText = m.text || m.caption || m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.imageMessage?.caption || ''
    const cleanText = cleanUnicode(rawText)
    if (!cleanText) return

    const isGinfoMsg = /RollWaifu|Roll Waifu|Personajes reclamados|Personajes totales|Valor total/i.test(cleanText)
    const isCardMsg = !isGinfoMsg && /Nombre\s*»|Fuente\s*»/i.test(cleanText) && /Valor\s*»/i.test(cleanText)
    const isCooldownMsg = /Debes esperar|cooldown|agotado/i.test(cleanText)

    const quotedSender = m.quoted ? getCleanNumber(m.quoted.sender) : null

    // CASO 1: Cooldowns dirigidos
    if (isCooldownMsg) {
        if (quotedSender && quotedSender !== myCleanNumber && (Date.now() - state.lastRwSent > 12000)) return
        
        const waitMs = parseCooldown(cleanText, 'esperar|cooldown') || (3 * 60 * 1000)
        state.status = 'IDLE'
        resetTimer(conn, myCleanNumber, chat, waitMs + 4000)
        return
    }

    // CASO 2: Procesar #ginfo
    if (isGinfoMsg) {
        const timeSinceGinfo = Date.now() - state.lastGinfoSent
        const isRecentRequest = timeSinceGinfo < 25000

        const userHeaderMatch = cleanText.match(/Usuario\s*[:»`<\*\s]*([^`"'>\*\n]+)/i)
        const extractedName = userHeaderMatch ? userHeaderMatch[1].trim().replace(/[`<"'>\*]/g, '') : ''

        let isForMe = false

        if (state.status === 'WAITING_GINFO' && isRecentRequest) {
            isForMe = true
            if (extractedName) state.botName = extractedName
        } else if (state.botName && extractedName) {
            if (extractedName.toLowerCase() === state.botName.toLowerCase()) {
                isForMe = true
            }
        }

        if (isForMe) {
            state.status = 'PROCESSING'

            const claimCooldown = parseCooldown(cleanText, 'Claim')
            const rwCooldown = parseCooldown(cleanText, 'RollWaifu|Roll Waifu')

            if (claimCooldown > 0) {
                state.status = 'IDLE'
                resetTimer(conn, myCleanNumber, chat, claimCooldown + 5000)
                return
            }

            if (rwCooldown === 0) {
                state.status = 'WAITING_CARD'
                state.lastRwSent = Date.now()

                const stagger = getBotStaggerDelay(myCleanNumber)
                await delay(1000 + (stagger % 1500))
                await conn.sendMessage(chat, { text: '#rw' })
                return
            } else {
                state.status = 'IDLE'
                resetTimer(conn, myCleanNumber, chat, rwCooldown + 4000)
                return
            }
        }
        return
    }

    // CASO 3: Procesar Carta
    if (isCardMsg) {
        const timeSinceRw = Date.now() - state.lastRwSent
        const isMyCardWindow = state.status === 'WAITING_CARD' && timeSinceRw < 15000

        if (!isMyCardWindow) return 

        // Consumir el estado de inmediato para que NO procese una segunda carta de otro subbot
        state.status = 'IDLE'
        
        const itemValue = parseValue(cleanText)
        const minVal = parseInt(config.minValor || 8000, 10)

        if (itemValue >= minVal) {
            await delay(1200)
            await conn.sendMessage(chat, { text: '#c' }, { quoted: m })
            resetTimer(conn, myCleanNumber, chat, 30 * 60 * 1000)
        } else {
            resetTimer(conn, myCleanNumber, chat, 15 * 60 * 1000)
        }
    }
}

handler.help = ['autorw sync', 'autorw off', 'autorw min [número]']
handler.tags = ['gacha']
handler.command = ['autorw']

export default handler