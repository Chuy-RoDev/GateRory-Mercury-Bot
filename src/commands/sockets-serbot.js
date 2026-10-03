import {
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion
} from "@whiskeysockets/baileys"
import qrcode from "qrcode"
import NodeCache from "node-cache"
import fs from "fs"
import path from "path"
import pino from 'pino'
import chalk from 'chalk'
import { makeWASocket } from '../../lib/simple.js'
import { fileURLToPath } from 'url'
import { Boom } from '@hapi/boom'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

if (!Array.isArray(global.conns)) global.conns = []
if (!global.isSent) global.isSent = {}

const JADI_FOLDER = global.jadi || 'jadibts'

const rtxQR = `✿ \`Vincula tu cuenta usando el código QR.\`
[ ✰ ] *Instrucciones:*
1 » Abre WhatsApp en tu dispositivo
2 » Ve a *Dispositivos vinculados*
3 » Toca en *Vincular un dispositivo*
4 » Escanea este código QR
> *Nota:* Este código expira en 30 segundos.`

const rtxCode = `✿ \`Vincula tu cuenta usando el código de 8 dígitos.\`
[ ✰ ] *Instrucciones:*
1 » Ve a *Dispositivos vinculados* en tu WhatsApp
2 » Toca en *Vincular un dispositivo*
3 » Selecciona *Vincular con el número de teléfono*
4 » Ingresa el código enviado a continuación`

function msToTime(duration) {
    const seconds = Math.floor((duration / 1000) % 60)
    const minutes = Math.floor((duration / (1000 * 60)) % 60)
    return `${minutes}m y ${seconds}s`
}

async function resolveRealJid(conn, chat, sender) {
    if (!sender) return ''
    if (!sender.includes('@lid')) return sender
    try {
        const meta = await conn.groupMetadata(chat).catch(() => null)
        if (meta) {
            const participant = meta.participants.find(p =>
                p.lid === sender || p.lid?.split('@')[0] === sender.split('@')[0]
            )
            if (participant?.id) return participant.id
        }
    } catch {}
    return sender
}

function cleanInactiveSessions() {
    const sessionPath = path.resolve(`./${JADI_FOLDER}/`)
    if (!fs.existsSync(sessionPath)) return

    try {
        const files = fs.readdirSync(sessionPath)
        const now = Date.now()
        const threeDays = 3 * 24 * 60 * 60 * 1000

        files.forEach(file => {
            const filePath = path.join(sessionPath, file)
            const credsFile = path.join(filePath, 'creds.json')
            const targetPath = fs.existsSync(credsFile) ? credsFile : filePath

            try {
                const stats = fs.statSync(targetPath)
                if (now - stats.mtimeMs > threeDays) {
                    fs.rmSync(filePath, { recursive: true, force: true })
                    const daysAgo = Math.floor((now - stats.mtimeMs) / (24 * 60 * 60 * 1000))
                    console.log(chalk.yellow(`[ SUB-BOT ] Sesión inactiva eliminada: ${file} (${daysAgo} días)`))
                }
            } catch (err) {
                console.error(chalk.red(`[ SUB-BOT ERROR ] Error limpiando ${file}:`), err.message)
            }
        })
    } catch (err) {
        console.error(chalk.red('[ SUB-BOT ERROR ] Error en limpieza de sesiones:'), err)
    }
}

export async function roryJadiBot(options) {
    const { pathSubBot, pathshirokoJadiBot, m, conn, args, usedPrefix, command, fromCommand } = options
    const sessionPath = pathSubBot || pathshirokoJadiBot || options.pathRoryJadiBot
    const mcode = command === 'code' || (args && args.includes('--code'))

    const realSender = await resolveRealJid(conn, m?.chat, m?.sender)
    const senderNum = realSender ? realSender.split('@')[0].replace(/[^0-9]/g, '') : ''
    const userId = options.args?.[0]?.replace(/[^0-9]/g, '') || (senderNum.length > 13 ? "525656953441" : senderNum) || path.basename(sessionPath)

    const existingIdx = global.conns.findIndex(c => c?.subId === userId)
    if (existingIdx !== -1) {
        try {
            global.conns[existingIdx]?.sock?.ws?.close()
        } catch {}
        global.conns.splice(existingIdx, 1)
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
    const { version } = await fetchLatestBaileysVersion()

    const connectionOptions = {
        logger: pino({ level: 'error' }),
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        browser: ['Ubuntu', 'Chrome', '120.0.0.0'],
        version,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        msgRetryCounterCache: new NodeCache(),
        connectTimeoutMs: 30000,
        keepAliveIntervalMs: 15000
    }

    let sock = makeWASocket(connectionOptions)
    let startTime = Math.floor(Date.now() / 1000)
    sock.isInit = false
    sock.subId = userId

    let reconnectAttempts = 0
    const MAX_RECONNECT_ATTEMPTS = 8

    let pairingRequested = false

    async function connectionUpdate(update) {
        const { connection, lastDisconnect, qr } = update

        if (qr && fromCommand && !global.isSent[userId]) {
            if (mcode) {
                if (!pairingRequested) {
                    pairingRequested = true
                    setTimeout(async () => {
                        try {
                            let code = await sock.requestPairingCode(userId)
                            code = code?.match(/.{1,4}/g)?.join('-') || code

                            global.isSent[userId] = true
                            await conn.sendMessage(m.chat, { text: rtxCode }, { quoted: m })
                            await conn.sendMessage(m.chat, { text: `*${code}*` }, { quoted: m })
                        } catch (e) {
                            console.error('[ SUB-BOT ERROR ] Error generando Pairing Code:', e)
                            global.isSent[userId] = false
                            pairingRequested = false
                        }
                    }, 2500)
                }
            } else {
                try {
                    global.isSent[userId] = true
                    const qrBuffer = await qrcode.toBuffer(qr, { scale: 8 })
                    await conn.sendMessage(m.chat, {
                        image: qrBuffer,
                        caption: rtxQR
                    }, { quoted: m })
                } catch (e) {
                    console.error('[ SUB-BOT ERROR ] Error enviando QR:', e)
                    global.isSent[userId] = false
                }
            }
        }

        if (connection === 'open') {
            sock.isInit = true
            const subUserJid = sock.user.id.split(':')[0]
            const botName = sock.user.name || sock.user.verifiedName || 'Bot'
            const cleanJid = subUserJid.replace(/[^0-9]/g, '')
            const firstLetter = botName.charAt(0).toUpperCase()
            sock.customPrefix = `${firstLetter}/`
            global.conns.push({ sock, subId: userId, jid: cleanJid, name: botName, uptime: Date.now() })

            if (fromCommand && m && m.chat) {
                const botname = global.botname || 'Rory Mercury'
                await conn.sendMessage(m.chat, {
                    text: `❀ ¡Sub-Bot registrado con éxito!\n\n*Usuario:* @${userId}\n*Bot:* ${botname}\n\n> Usa el comando *${usedPrefix}infobot* para ver los detalles.`,
                    mentions: [m.sender]
                }, { quoted: m })
            }
        }

        if (connection === 'close') {
            const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode
            const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401 || statusCode === 403

            try {
                sock.ev.removeAllListeners()
                sock.ws?.close()
            } catch {}

            const idx = global.conns.findIndex(c => c?.subId === userId || c?.sock === sock)
            if (idx !== -1) global.conns.splice(idx, 1)

            delete global.isSent[userId]

            if (isLoggedOut) {
                console.log(chalk.red(`[ SUB-BOT ] Sesión de +${userId} desvinculada.`))
                if (fs.existsSync(sessionPath)) {
                    fs.rmSync(sessionPath, { recursive: true, force: true })
                }
            } else {
                reconnectAttempts++
                if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                    console.log(chalk.red(`[ SUB-BOT ] +${userId} alcanzó ${MAX_RECONNECT_ATTEMPTS} intentos de reconexión. Eliminando...`))
                    if (fs.existsSync(sessionPath)) {
                        fs.rmSync(sessionPath, { recursive: true, force: true })
                    }
                    return
                }
                console.log(chalk.yellow(`[ SUB-BOT ] Reconectando +${userId} en 10s... (Intento ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`))
                setTimeout(() => roryJadiBot(options), 10000)
            }
        }
    }

    // PRIMERO: Asignar el handler ANTES de listeners
    let sock_handler = null
    try {
        const handlerFile = await import('../Rory-Mercury.js')
        if (handlerFile?.handler) {
            sock_handler = handlerFile.handler.bind(sock)
            sock.handler = sock_handler
        }
    } catch (e) {
        console.error('[ SUB-BOT ERROR ] No se pudo cargar handler:', e.message)
    }

    // SEGUNDO: Registrar connection listeners
    sock.ev.on('connection.update', connectionUpdate)
    sock.ev.on('creds.update', saveCreds)

    // TERCERO: Registrar mensajes SOLO si handler existe
    if (sock_handler) {
        sock.ev.on('messages.upsert', async (chatUpdate) => {
            if (!sock.isInit) return
            for (let msg of chatUpdate.messages) {
                if (!msg.message) continue
                let msgTime = msg.messageTimestamp
                if (msgTime < startTime) continue
                try {
                    await sock.handler(chatUpdate)
                } catch (err) {
                    console.error('[ SUB-BOT ERROR ] Error en handler:', err.message)
                }
            }
        })
    }

    return true
}

let handler = async (m, { conn, args, usedPrefix, command }) => {
    cleanInactiveSessions()

    const botJid = conn.user?.jid || conn.user?.id
    const isJadibotEnabled = global.db?.data?.settings?.[botJid]?.jadibotmd ?? true

    if (!isJadibotEnabled) {
        return m.reply(`ꕤ El comando *${command}* está desactivado actualmente.`)
    }

    let user = global.db?.data?.users?.[m.sender] || {}
    let cooldown = (user.Subs || 0) + 120000
    if (Date.now() - (user.Subs || 0) < 120000) {
        return conn.reply(m.chat, `ꕤ Debes esperar *${msToTime(cooldown - Date.now())}* para volver a solicitar un Sub-Bot.`, m)
    }

    let activeBots = global.conns.filter(c => c?.sock?.user).length
    if (activeBots >= 50) {
        return m.reply(`ꕤ Se ha alcanzado el límite de Sub-Bots activos (50/50).`)
    }

    let inputNumber = args[0] ? args[0].replace(/[^0-9]/g, '') : ''
    let realSender = await resolveRealJid(conn, m.chat, m.sender)
    let senderNum = realSender.split('@')[0].replace(/[^0-9]/g, '')

    let id = inputNumber || (senderNum.length > 13 ? "584142921488" : senderNum)

    let pathSubBot = path.join(`./${JADI_FOLDER}/`, id)
    if (!fs.existsSync(pathSubBot)) fs.mkdirSync(pathSubBot, { recursive: true })

    global.isSent[id] = false
    if (global.db?.data?.users?.[m.sender]) {
        global.db.data.users[m.sender].Subs = Date.now()
    }

    const isCode = command === 'code' || (args && args.includes('--code'))
    await conn.reply(m.chat, `ꕤ Generando ${isCode ? 'código de vinculación' : 'código QR'}, por favor espera...`, m)

    await roryJadiBot({
        pathSubBot,
        m,
        conn,
        args,
        usedPrefix,
        command,
        fromCommand: true
    })
}

handler.help = ['jadibot', 'code']
handler.tags = ['jadibot']
handler.command = ['qr', 'code', 'jadibot', 'subbot']

export default handler