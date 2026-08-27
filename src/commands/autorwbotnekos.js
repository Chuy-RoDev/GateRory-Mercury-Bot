import fs from 'fs'
import path from 'path'

const CONFIG_PATH = path.join('./database/autorw_config.json')

global.autorwProcessedMsgs = global.autorwProcessedMsgs || new Set()
global.autorwTimers = global.autorwTimers || {}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const getRandomDelay = (min = 3500, max = 5500) => Math.floor(Math.random() * (max - min + 1)) + min
const getClaimDelay = (min = 2500, max = 4000) => Math.floor(Math.random() * (max - min + 1)) + min

const cleanUnicode = (str) => {
    if (!str) return ''
    return str
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\p{Cf}/gu, '')
        .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2060\u061C]/g, '')
}

const getCleanNumber = (jid) => jid ? String(jid).split('@')[0].split(':')[0].replace(/[^0-9]/g, '') : ''

const loadConfig = () => {
    if (!fs.existsSync('./database')) fs.mkdirSync('./database', { recursive: true })
    const defaultConfig = { minValor: 8000, groups: {} }
    
    if (!fs.existsSync(CONFIG_PATH)) {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2))
        return defaultConfig
    }
    
    try {
        const fileContent = fs.readFileSync(CONFIG_PATH, 'utf8')
        if (!fileContent.trim()) {
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2))
            return defaultConfig
        }
        const data = JSON.parse(fileContent)
        if (!data.groups) data.groups = {}
        if (typeof data.minValor !== 'number') data.minValor = parseInt(data.minValor, 10) || 8000
        return data
    } catch {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2))
        return defaultConfig
    }
}

const saveConfig = (data) => fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2))

const getGroupConfig = (config, chat, botNum) => {
    const key = `${chat}_${botNum}`
    if (!config.groups[key]) {
        config.groups[key] = {
            enabled: false,
            status: 'IDLE',
            lastStateTime: Date.now(),
            lastSentGinfoTime: 0,
            lastSentRwTime: 0,
            botName: '',
            targetBot: ''
        }
    }
    return config.groups[key]
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
    // Evitar leer "Valor total"
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

const resetTimer = (conn, chat, timeMs = 10 * 60 * 1000) => {
    const myCleanNumber = getCleanNumber(conn.user?.jid)
    const timerKey = `${chat}_${myCleanNumber}`

    if (global.autorwTimers[timerKey]) clearTimeout(global.autorwTimers[timerKey])

    global.autorwTimers[timerKey] = setTimeout(async () => {
        let config = loadConfig()
        let gConfig = getGroupConfig(config, chat, myCleanNumber)

        if (!gConfig.enabled) return

        gConfig.status = 'WAITING_GINFO'
        gConfig.lastStateTime = Date.now()
        gConfig.lastSentGinfoTime = Date.now()
        saveConfig(config)

        await delay(getRandomDelay(3000, 5000))
        await conn.sendMessage(chat, { text: '#ginfo' })
        resetTimer(conn, chat, 10 * 60 * 1000)
    }, timeMs)
}

let handler = async (m, { conn, args, usedPrefix, command }) => {
    let config = loadConfig()
    const chat = m.chat
    const myCleanNumber = getCleanNumber(conn.user?.jid)
    const gConfig = getGroupConfig(config, chat, myCleanNumber)
    const subCommand = args[0]?.toLowerCase()

    if (subCommand === 'off') {
        gConfig.enabled = false
        gConfig.status = 'IDLE'
        saveConfig(config)
        const timerKey = `${chat}_${myCleanNumber}`
        if (global.autorwTimers[timerKey]) clearTimeout(global.autorwTimers[timerKey])
        return conn.sendMessage(chat, { text: `ꕤ AutoRW desactivado para @${myCleanNumber}.` }, { quoted: m })
    }
    
    if (subCommand === 'sync') {
        const manualName = args.slice(1).join(' ').trim()
        gConfig.enabled = true
        if (manualName) gConfig.botName = manualName
        gConfig.targetBot = m.quoted?.sender || (m.mentionedJid && m.mentionedJid[0]) || gConfig.targetBot || ''
        gConfig.status = 'WAITING_GINFO'
        gConfig.lastStateTime = Date.now()
        gConfig.lastSentGinfoTime = Date.now()
        saveConfig(config)
        
        resetTimer(conn, chat, 10 * 60 * 1000)
        await conn.sendMessage(chat, { text: `ꕤ AutoRW activado para @${myCleanNumber}${gConfig.botName ? ` (${gConfig.botName})` : ''}. Sincronizando...` }, { quoted: m })
        await delay(getRandomDelay(2500, 4500))
        return conn.sendMessage(chat, { text: '#ginfo' })
    }

    return conn.sendMessage(chat, { text: `Usa *${usedPrefix + command} sync [nombre_opcional]* para activar o *${usedPrefix + command} off* para desactivar.` }, { quoted: m })
}

handler.before = async function (m, { conn }) {
    if (!m.chat || m.isBaileys) return

    const myJid = conn.user?.jid || ''
    const myCleanNumber = getCleanNumber(myJid)
    if (!myCleanNumber) return

    const chat = m.chat
    let config = loadConfig()
    const gConfig = getGroupConfig(config, chat, myCleanNumber)

    if (!gConfig.enabled) return

    // Timeout de seguridad si el bot se atasca en un estado
    if (gConfig.status !== 'IDLE' && (Date.now() - (gConfig.lastStateTime || 0) > 18000)) {
        gConfig.status = 'IDLE'
        saveConfig(config)
    }

    let rawText = m.text || m.caption || m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.imageMessage?.caption || ''
    const cleanText = cleanUnicode(rawText)
    if (!cleanText) return

    const msgId = m.key?.id || m.id
    const processKey = `${msgId}_${myCleanNumber}`
    if (msgId && global.autorwProcessedMsgs.has(processKey)) return

    let senderJid = m.sender || m.key?.participant || ''

    // EXPRESIONES REGULARES DE TIPO DE MENSAJE ESTRICTAS
    const isGinfoMsg = /RollWaifu|Roll Waifu|Personajes reclamados|Personajes totales|Valor total/i.test(cleanText)
    const isCardMsg = !isGinfoMsg && /Nombre\s*»|Fuente\s*»/i.test(cleanText) && /Valor\s*»/i.test(cleanText)
    const isCooldownMsg = /Debes esperar|cooldown|agotado/i.test(cleanText)

    if (isGinfoMsg || isCardMsg || isCooldownMsg) {
        if (!/^[/#.!]/.test(cleanText.trim())) {
            const cleanTarget = getCleanNumber(gConfig.targetBot)
            const cleanSender = getCleanNumber(senderJid)
            if (!gConfig.targetBot || cleanTarget !== cleanSender) {
                gConfig.targetBot = senderJid
                saveConfig(config)
            }
        }
    }

    if (!gConfig.targetBot) return
    if (getCleanNumber(senderJid) !== getCleanNumber(gConfig.targetBot)) return

    const quotedSender = m.quoted ? getCleanNumber(m.quoted.sender) : null

    // CASO 1: Mensaje de Cooldown
    if (isCooldownMsg) {
        if (msgId) global.autorwProcessedMsgs.add(processKey)
        const waitMs = parseCooldown(cleanText, 'esperar|cooldown') || (3 * 60 * 1000)
        gConfig.status = 'IDLE'
        saveConfig(config)
        resetTimer(conn, chat, waitMs + getRandomDelay(3000, 6000))
        return
    }

    // CASO 2: Respuesta a #ginfo
    if (isGinfoMsg) {
        // Ignorar respuestas destinadas explícitamente a otro bot
        if (quotedSender && quotedSender !== myCleanNumber) return

        const userHeaderMatch = cleanText.match(/Usuario\s*[`<"']*\s*([^`"'>\n]+)/i)
        if (userHeaderMatch && userHeaderMatch[1]) {
            const extractedName = userHeaderMatch[1].trim().replace(/[`<"'>]/g, '')
            if (extractedName && gConfig.botName !== extractedName && (quotedSender === myCleanNumber || gConfig.status === 'WAITING_GINFO')) {
                gConfig.botName = extractedName
                saveConfig(config)
            }
        }

        if (gConfig.status === 'WAITING_GINFO') {
            if (msgId) global.autorwProcessedMsgs.add(processKey)
            
            const claimCooldown = parseCooldown(cleanText, 'Claim')
            const rwCooldown = parseCooldown(cleanText, 'RollWaifu|Roll Waifu')
            const maxCooldown = Math.max(claimCooldown, rwCooldown)
            
            if (maxCooldown === 0) {
                gConfig.status = 'WAITING_RW'
                gConfig.lastStateTime = Date.now()
                gConfig.lastSentRwTime = Date.now()
                saveConfig(config)
                
                await delay(getRandomDelay(3000, 5000))
                return conn.sendMessage(chat, { text: '#rw' })
            } else {
                gConfig.status = 'IDLE'
                saveConfig(config)
                resetTimer(conn, chat, maxCooldown + getRandomDelay(3000, 6000))
                return
            }
        }
        return
    }

    // CASO 3: Aparición de una Carta (Waifu)
    if (isCardMsg) {
        const elapsedTime = Date.now() - (gConfig.lastSentRwTime || 0)
        if (elapsedTime > 25000 || gConfig.status !== 'WAITING_RW') return

        if (msgId) global.autorwProcessedMsgs.add(processKey)
        
        const itemValue = parseValue(cleanText)
        const minVal = parseInt(config.minValor || 8000, 10)
        
        if (itemValue >= minVal) {
            // Reclamar la carta citando explícitamente el mensaje del bot de gacha
            await delay(getClaimDelay(2500, 4000))
            await conn.sendMessage(chat, { text: '#c' }, { quoted: m })
            
            gConfig.status = 'WAITING_GINFO'
            gConfig.lastStateTime = Date.now()
            gConfig.lastSentGinfoTime = Date.now()
            saveConfig(config)
            
            await delay(getRandomDelay(3500, 5000))
            return conn.sendMessage(chat, { text: '#ginfo' })
        } else {
            gConfig.status = 'WAITING_RW'
            gConfig.lastStateTime = Date.now()
            gConfig.lastSentRwTime = Date.now()
            saveConfig(config)
            
            await delay(getRandomDelay(3500, 5000))
            return conn.sendMessage(chat, { text: '#rw' })
        }
    }
}

handler.help = ['autorw sync [nombre]', 'autorw off']
handler.tags = ['gacha']
handler.command = ['autorw']

export default handler