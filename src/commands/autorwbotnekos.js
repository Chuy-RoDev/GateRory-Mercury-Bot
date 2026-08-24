import fs from 'fs'
import path from 'path'

const CONFIG_PATH = path.join('./database/autorw_config.json')

global.autorwProcessedMsgs = global.autorwProcessedMsgs || new Set()
global.autorwTimers = global.autorwTimers || {}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const getRandomDelay = (min = 4000, max = 7000) => Math.floor(Math.random() * (max - min + 1)) + min

const cleanUnicode = (str) => {
    if (!str) return ''
    return str
        .replace(/\p{Cf}/gu, '')
        .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2060\u061C]/g, '')
}

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

const getGroupConfig = (config, chat) => {
    if (!config.groups[chat]) {
        config.groups[chat] = {
            enabled: false,
            status: 'IDLE',
            lastStateTime: Date.now(),
            lastSentRwTime: 0,
            targetBot: ''
        }
    }
    return config.groups[chat]
}

const parseCooldown = (text, typePattern) => {
    const cleaned = cleanUnicode(text)
    if (!cleaned) return 0
    const lines = cleaned.split(/[\n\r]+/)
    const line = lines.find(l => new RegExp(typePattern, 'i').test(l)) || cleaned

    const lower = line.toLowerCase()
    if (/ahora|listo|disponible|ready/i.test(lower) && !/espera|cooldown|faltan/i.test(lower)) return 0

    const minsMatch = lower.match(/(\d+)\s*(?:m|min|minutos?)/i)
    const secsMatch = lower.match(/(\d+)\s*(?:s|seg|segundos?)/i)
    const hoursMatch = lower.match(/(\d+)\s*(?:h|horas?)/i)

    const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0
    const mins = minsMatch ? parseInt(minsMatch[1], 10) : 0
    const secs = secsMatch ? parseInt(secsMatch[1], 10) : 0

    const totalMs = (hours * 3600 + mins * 60 + secs) * 1000
    if (totalMs > 0) return totalMs

    if (/espera|cooldown|faltan|agotado/i.test(lower)) return 60000

    return 0
}

const parseValue = (text) => {
    const cleaned = cleanUnicode(text)
    if (!cleaned) return 0

    const lines = cleaned.split(/[\n\r]+/)
    const valorLine = lines.find(l => /Valor/i.test(l))
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

const getCleanNumber = (jid) => jid ? String(jid).split('@')[0].split(':')[0].replace(/[^0-9]/g, '') : ''

const reset10MinTimer = (conn, chat) => {
    if (global.autorwTimers[chat]) clearTimeout(global.autorwTimers[chat])

    const TEN_MINUTES = 10 * 60 * 1000

    global.autorwTimers[chat] = setTimeout(async () => {
        let config = loadConfig()
        let gConfig = getGroupConfig(config, chat)

        if (!gConfig.enabled) return

        gConfig.status = 'WAITING_GINFO'
        gConfig.lastStateTime = Date.now()
        saveConfig(config)

        await delay(getRandomDelay(4000, 7000))
        
        config = loadConfig()
        gConfig = getGroupConfig(config, chat)
        if (gConfig.status === 'WAITING_GINFO') {
            await conn.sendMessage(chat, { text: '#ginfo' })
        }
        
        reset10MinTimer(conn, chat)
    }, TEN_MINUTES)
}

const restoreLoops = (conn) => {
    const config = loadConfig()
    for (const chat of Object.keys(config.groups)) {
        if (config.groups[chat].enabled) {
            reset10MinTimer(conn, chat)
        }
    }
}

let handler = async (m, { conn, args, usedPrefix, command }) => {
    let config = loadConfig()
    const chat = m.chat
    const gConfig = getGroupConfig(config, chat)
    const subCommand = args[0]?.toLowerCase()
    
    if (subCommand === 'min') {
        const newMin = parseInt(args[1], 10)
        if (isNaN(newMin)) return conn.sendMessage(chat, { text: `Ejemplo: ${usedPrefix + command} min 8000` }, { quoted: m })
        config.minValor = newMin
        saveConfig(config)
        return conn.sendMessage(chat, { text: `Mínimo global actualizado a: ${newMin}` }, { quoted: m })
    }
    
    if (subCommand === 'off') {
        gConfig.enabled = false
        gConfig.status = 'IDLE'
        saveConfig(config)
        
        if (global.autorwTimers[chat]) {
            clearTimeout(global.autorwTimers[chat])
            delete global.autorwTimers[chat]
        }
        return conn.sendMessage(chat, { text: `AutoRW desactivado en este grupo.` }, { quoted: m })
    }
    
    if (subCommand === 'sync') {
        gConfig.enabled = true
        gConfig.targetBot = m.quoted?.sender || (m.mentionedJid && m.mentionedJid[0]) || gConfig.targetBot || ''
        gConfig.status = 'WAITING_GINFO'
        gConfig.lastStateTime = Date.now()
        saveConfig(config)
        
        reset10MinTimer(conn, chat)

        await conn.sendMessage(chat, { text: `AutoRW activado. Enviando #ginfo con delay (4-7s)...` }, { quoted: m })

        await delay(getRandomDelay(4000, 7000))
        return conn.sendMessage(chat, { text: '#ginfo' })
    }
    
    const activeCount = Object.values(config.groups).filter(g => g.enabled).length
    const cleanNumber = getCleanNumber(gConfig.targetBot)
    
    return conn.sendMessage(chat, { 
        text: `Estado en este grupo: ${gConfig.enabled ? 'Activado' : 'Desactivado'}\n` +
              `Bot objetivo: ${cleanNumber ? '@' + cleanNumber : 'Auto-detectar respuesta'}\n` +
              `Grupos Activos: ${activeCount}\n` +
              `Valor Mínimo: ${parseInt(config.minValor || 8000, 10)}\n\n` +
              `• ${usedPrefix + command} sync\n` +
              `• ${usedPrefix + command} off\n` +
              `• ${usedPrefix + command} min <valor>`,
        mentions: gConfig.targetBot ? [gConfig.targetBot] : []
    }, { quoted: m })
}

handler.before = async function (m, { conn }) {
    if (!m.chat || m.isBaileys) return

    if (!global.autorwRestored) {
        global.autorwRestored = true
        restoreLoops(conn)
    }

    if (global.autorwProcessedMsgs.size > 500) global.autorwProcessedMsgs.clear()

    const chat = m.chat
    let config = loadConfig()
    const gConfig = getGroupConfig(config, chat)
    
    if (!gConfig.enabled) return

    if (gConfig.status !== 'IDLE' && (Date.now() - (gConfig.lastStateTime || 0) > 30000)) {
        gConfig.status = 'IDLE'
        saveConfig(config)
    }

    let rawText = m.text || m.caption || m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.imageMessage?.caption || ''
    const cleanText = cleanUnicode(rawText)
    
    if (!cleanText) return

    const isUserGachaCmd = /^[/#.!]?\s*(ginfo|rw|rollwaifu|c|claim)\b/i.test(cleanText.trim())
    if (isUserGachaCmd && !m.key?.fromMe) {
        reset10MinTimer(conn, chat)
        gConfig.status = 'IDLE'
        saveConfig(config)
    }

    if (m.key?.fromMe || m.sender === conn.user?.jid) return
    
    const msgId = m.key?.id || m.id
    if (msgId && global.autorwProcessedMsgs.has(msgId)) return
    
    let senderJid = m.sender || m.key?.participant || ''
    
    const isGinfoMsg = /RollWaifu|Roll Waifu|Personajes reclamados|Personajes totales/i.test(cleanText)
    const isCardMsg = /Valor\s*»|✰\s*Valor|Valor\s*:/i.test(cleanText)
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
    
    const cleanTarget = getCleanNumber(gConfig.targetBot)
    const cleanSender = getCleanNumber(senderJid)
    if (cleanSender !== cleanTarget) return

    reset10MinTimer(conn, chat)

    if (isCooldownMsg) {
        if (msgId) global.autorwProcessedMsgs.add(msgId)
        gConfig.status = 'IDLE'
        gConfig.lastStateTime = Date.now()
        saveConfig(config)
        return
    }

    if (isGinfoMsg && gConfig.status === 'WAITING_GINFO') {
        if (msgId) global.autorwProcessedMsgs.add(msgId)
        
        const claimCooldown = parseCooldown(cleanText, 'Claim')
        const rwCooldown = parseCooldown(cleanText, 'RollWaifu|Roll Waifu')
        
        if (claimCooldown === 0 && rwCooldown === 0) {
            gConfig.status = 'WAITING_RW'
            gConfig.lastStateTime = Date.now()
            gConfig.lastSentRwTime = Date.now()
            saveConfig(config)
            
            await delay(getRandomDelay(4000, 7000))
            
            config = loadConfig()
            if (config.groups[chat]?.status === 'WAITING_RW') {
                return conn.sendMessage(chat, { text: '#rw' })
            }
        } else {
            gConfig.status = 'IDLE'
            gConfig.lastStateTime = Date.now()
            saveConfig(config)
            return
        }
    }

    if (isCardMsg) {
        const wasMyRoll = (Date.now() - (gConfig.lastSentRwTime || 0)) < 15000
        if (!wasMyRoll || gConfig.status !== 'WAITING_RW') return

        if (msgId) global.autorwProcessedMsgs.add(msgId)
        
        const itemValue = parseValue(cleanText)
        const minVal = parseInt(config.minValor || 8000, 10)
        
        if (itemValue >= minVal) {
            await delay(getRandomDelay(4000, 7000))
            await conn.sendMessage(chat, { text: '#c' }, { quoted: m })
            
            gConfig.status = 'WAITING_GINFO'
            gConfig.lastStateTime = Date.now()
            saveConfig(config)
            
            await delay(getRandomDelay(4000, 7000))
            
            config = loadConfig()
            if (config.groups[chat]?.status === 'WAITING_GINFO') {
                return conn.sendMessage(chat, { text: '#ginfo' })
            }
        } else {
            gConfig.status = 'WAITING_RW'
            gConfig.lastStateTime = Date.now()
            gConfig.lastSentRwTime = Date.now()
            saveConfig(config)
            
            await delay(getRandomDelay(4000, 7000))
            
            config = loadConfig()
            if (config.groups[chat]?.status === 'WAITING_RW') {
                return conn.sendMessage(chat, { text: '#rw' })
            }
        }
    }
}

handler.help = ['autorw', 'autorw sync', 'autorw min <valor>', 'autorw off']
handler.tags = ['gacha']
handler.command = ['autorw']

export default handler