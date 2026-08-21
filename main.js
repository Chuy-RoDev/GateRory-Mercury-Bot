import { createRequire } from 'module'
import { fileURLToPath, pathToFileURL } from 'url'
import { platform } from 'process'
import fs, { readdirSync, statSync, unlinkSync, existsSync, mkdirSync, readFileSync, watch } from 'fs'
import path, { join, dirname } from 'path'
import chalk from 'chalk'
import syntaxerror from 'syntax-error'
import pino from 'pino'
import Pino from 'pino'
import { Boom } from '@hapi/boom'
import { makeWASocket, protoType, serialize } from './lib/simple.js'
import store from './lib/store.js'
import pkg from 'google-libphonenumber'
import { spawn } from 'child_process'
import readline from 'readline'
import NodeCache from 'node-cache'
import lodash from 'lodash'
import { shirokoJadiBot } from './src/commands/sockets-serbot.js'

global.getProperName = async (conn, jid) => {
    try {
        const whatsappName = await conn.getName(jid)
        if (whatsappName && typeof whatsappName === 'string' && whatsappName.trim()) {
            return whatsappName.trim()
        }
        if (global.db?.data?.users?.[jid]?.name?.trim()) {
            return global.db.data.users[jid].name.trim()
        }
        return jid.split('@')[0]
    } catch {
        return global.db?.data?.users?.[jid]?.name?.trim() || jid.split('@')[0]
    }
}
const { PhoneNumberUtil } = pkg
const phoneUtil = PhoneNumberUtil.getInstance()
const { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, jidNormalizedUser } = await import('@whiskeysockets/baileys')
const { chain, debounce } = lodash

global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') {
    return rmPrefix ? /file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL : pathToFileURL(pathURL).toString()
}
global.__dirname = function dirname(pathURL) {
    return path.dirname(global.__filename(pathURL, true))
}
global.__require = function require(dir = import.meta.url) {
    return createRequire(dir)
}

if (typeof protoType === 'function') protoType();
if (typeof serialize === 'function') serialize();

const __dirname = global.__dirname(import.meta.url)

const credsFile = join(global.sessions, 'creds.json')

async function isValidPhoneNumber(number) {
    try {
        let num = String(number).replace(/\s+/g, '')
        if (num.startsWith('+521')) {
            num = num.replace('+521', '+52')
        } else if (num.startsWith('+52') && num[4] === '1') {
            num = num.replace('+52 1', '+52')
        }
        const parsedNumber = phoneUtil.parseAndKeepRawInput(num)
        return phoneUtil.isValidNumber(parsedNumber)
    } catch (error) {
        return false
    }
}

async function joinChannels(sock) {
    for (const value of Object.values(global.ch || {})) {
        if (typeof value === 'string' && value.endsWith('@newsletter')) {
            await sock.newsletterFollow(value).catch(() => {})
        }
    }
}

async function _quickTest() {
    const test = await Promise.all([
        spawn('ffmpeg'),
        spawn('ffprobe'),
        spawn('ffmpeg', ['-hidebanner', '-loglevel', 'error', '-filter_complex', 'color', '-frames:v', '1', '-f', 'webp', '-']),
        spawn('convert'),
        spawn('magick'),
        spawn('gm'),
        spawn('find', ['--version']),
    ].map((p) => {
        return Promise.race([
            new Promise((resolve) => {
                p.on('close', (code) => {
                    resolve(code !== 127)
                })
            }),
            new Promise((resolve) => {
                p.on('error', (_) => resolve(false))
            })
        ])
    }))
    const [ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find] = test
    const s = global.support = { ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find }
    Object.freeze(global.support)
}

function getRelativePluginName(filePath) {
    const commandsFolder = global.__dirname(join(__dirname, './src/commands'))
    const relativePath = path.relative(commandsFolder, filePath)
    return relativePath.replace(/\\/g, '/')
}

async function loadCommandsFromFolders() {
    const commandsFolder = global.__dirname(join(__dirname, './src/commands'))
    global.plugins = {}
    async function loadFolder(folderPath, basePath = commandsFolder) {
        try {
            const items = readdirSync(folderPath)
            for (const item of items) {
                const fullPath = join(folderPath, item)
                const stat = statSync(fullPath)
                if (stat.isDirectory()) {
                    await loadFolder(fullPath, basePath)
                } else if (stat.isFile() && /\.js$/.test(item)) {
                    try {
                        const file = global.__filename(fullPath)
                        const module = await import(file)
                        const pluginName = getRelativePluginName(fullPath)
                        global.plugins[pluginName] = module.default || module
                    } catch (e) {
                        const pluginName = getRelativePluginName(fullPath)
                        console.error(chalk.rgb(220, 20, 60)(`✗ Error al cargar ${pluginName}: ${e.message}`))
                        delete global.plugins[getRelativePluginName(fullPath)]
                    }
                }
            }
        } catch (error) {
            console.error(`Error al cargar carpeta ${folderPath}:`, error)
        }
    }
    await loadFolder(commandsFolder)
    console.log(chalk.rgb(180, 20, 20)(`✓ Comandos cargados: ${Object.keys(global.plugins).length}`))
}

async function _reloadCore(_ev, filename) {
    const commandsFolder = global.__dirname(join(__dirname, './src/commands'))
    const fullPath = global.__filename(join(__dirname, filename))
    if (fullPath.startsWith(commandsFolder) && /\.js$/.test(filename)) {
        const dir = global.__filename(join(__dirname, filename), true)
        const pluginName = getRelativePluginName(dir)
        if (existsSync(dir)) {
            if (pluginName in global.plugins) {
                console.log(chalk.rgb(220, 20, 60)('ꕤ ') + chalk.rgb(180, 20, 20)('Cambio Realizado en') + chalk.rgb(220, 20, 60)(`en "${pluginName}" `) + chalk.rgb(180, 20, 20)('con éxito.'))
            } else {
                console.log(chalk.rgb(220, 20, 60)('ꕤ ') + chalk.rgb(180, 20, 20)('Plugin Añadido ') + chalk.rgb(220, 20, 60)(`"${pluginName}" `) + chalk.rgb(180, 20, 20)('con éxito.'))
            }
            const err = syntaxerror(readFileSync(dir), pluginName, {
                sourceType: 'module',
                allowAwaitOutsideFunction: true,
            })
            if (err) {
                conn.logger.error(`syntax error while loading '${pluginName}'\n${err}`)
            } else {
                try {
                    const module = await import(`${global.__filename(dir)}?update=${Date.now()}`)
                    global.plugins[pluginName] = module.default || module
                } catch (e) {
                    conn.logger.error(`error require plugin '${pluginName}'\n${e}`)
                } finally {
                    global.plugins = Object.fromEntries(
                        Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b))
                    )
                }
            }
        } else if (!existsSync(dir)) {
            if (pluginName in global.plugins) {
                console.log(chalk.rgb(220, 20, 60)('ꕤ ') + chalk.rgb(220, 20, 60)('Plugin Eliminado ') + chalk.rgb(220, 20, 60)(`"${pluginName}" `) + chalk.rgb(220, 20, 60)('con éxito.'))
                delete global.plugins[pluginName]
            }
        }
    }
}

global.reload = debounce(_reloadCore, 100)
Object.freeze(global.reload)

function setupWatcher() {
    const commandsFolder = global.__dirname(join(__dirname, './src/commands'))
    function watchFolder(folderPath) {
        watch(folderPath, (eventType, filename) => {
            if (filename) {
                const fullPath = join(folderPath, filename)
                const stat = existsSync(fullPath) ? statSync(fullPath) : null
                if (stat && stat.isDirectory()) {
                    watchFolder(fullPath)
                } else {
                    const relativePath = path.relative(__dirname, fullPath)
                    global.reload(eventType, relativePath)
                }
            }
        })
        try {
            const items = readdirSync(folderPath)
            for (const item of items) {
                const fullPath = join(folderPath, item)
                if (statSync(fullPath).isDirectory()) {
                    watchFolder(fullPath)
                }
            }
        } catch (error) {
            console.error(`Error set up watcher for ${folderPath}:`, error)
        }
    }
    watchFolder(commandsFolder)
}

async function connectionUpdate(update) {
    const { connection, lastDisconnect, isNewLogin } = update
    global.stopped = connection
    if (isNewLogin) conn.isInit = true
    const code = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode
    if (code && code !== DisconnectReason.loggedOut && conn?.ws.socket == null) {
        await global.reloadHandler(true).catch(console.error)
        global.timestamp.connect = new Date()
    }
    if (global.db.data == null) global.loadDatabase()
    if (update.qr != 0 && update.qr != undefined || methodCodeQR) {
        if (opcion == '1' || methodCodeQR) {
            console.log(chalk.rgb(220, 20, 60)(`[ 青 ]  Escanea este código QR`))
        }
    }
    if (connection === "open") {
        const userName = conn.user.name || conn.user.verifiedName || "Desconocido"
        await joinChannels(conn)
        console.log(chalk.rgb(220, 20, 60)(`[ 青 ]  Conectado a: ${userName}`))
        const restartFile = join(__dirname, './src/json/restart.json')
        if (existsSync(restartFile)) {
            try {
                const data = JSON.parse(readFileSync(restartFile))
                await conn.sendMessage(data.chat, { text: 'ꕤ Reiniciado con éxito, nuevamente en línea.', edit: data.key })
                unlinkSync(restartFile)
            } catch (e) {
                console.error('Error al editar mensaje de reinicio:', e)
            }
        }
    }
    let reason = new Boom(lastDisconnect?.error)?.output?.statusCode
    if (connection === "close") {
        if ([401, 440, 428, 405].includes(reason)) {
            console.log(chalk.rgb(220, 20, 60)(`→ (${code}) › Cierra la session Principal.`))
        }
        console.log(chalk.rgb(220, 20, 60)("→ Reconectando el Bot Principal..."))
        await global.reloadHandler(true).catch(console.error)
    }
}

const raidTracker = new Map()

global.reloadHandler = async function (restatConn) {
    try {
        const Handler = await import(`./src/Rory-Mercury.js?update=${Date.now()}`).catch(console.error)
        if (Object.keys(Handler || {}).length) {
            handler = Handler
            if (global.processedMessages) {
                global.processedMessages.clear()
            }
        }
    } catch (e) { console.error(e) }
    if (restatConn) {
        const oldChats = global.conn.chats
        try { global.conn.ws.close() } catch { }
        conn.ev.removeAllListeners()
        global.conn = makeWASocket(connectionOptions, { chats: oldChats })
        isInit = true
    }
    if (!isInit) {
        conn.ev.off('messages.upsert', conn.handler)
        conn.ev.off('messages.upsert', conn.muteHandler)
        conn.ev.off('connection.update', conn.connectionUpdate)
        conn.ev.off('creds.update', conn.credsUpdate)
        conn.ev.off('group-participants.update', conn.antiraidHandler)
    }
    conn.handler = handler.handler.bind(global.conn)
    conn.connectionUpdate = connectionUpdate.bind(global.conn)
    conn.credsUpdate = saveCreds.bind(global.conn, true)
    if (!global.processedMessages) {
        global.processedMessages = new Set()
    }
    setInterval(() => {
        if (global.processedMessages && global.processedMessages.size > 1000) {
            global.processedMessages.clear()
        }
    }, 60000)

    // ─────────────────────────────────────────────────────────
    // ANTIRAID
    // ─────────────────────────────────────────────────────────
    conn.antiraidHandler = async (update) => {
        try {
            const { id: groupId, participants, action } = update
            if (action !== 'demote') return
            const chatData = global.db?.data?.chats?.[groupId]
            if (!chatData?.antiRaid) return
            const now = Date.now()
            const ONE_MINUTE = 60 * 1000
            if (!raidTracker.has(groupId)) raidTracker.set(groupId, [])
            const demoteLog = raidTracker.get(groupId)
            for (const jid of participants) {
                demoteLog.push({ jid, time: now })
            }
            const recent = demoteLog.filter(e => now - e.time < ONE_MINUTE)
            raidTracker.set(groupId, recent)
            if (recent.length < 2) return
            raidTracker.set(groupId, [])
            const groupMetadata = await conn.groupMetadata(groupId).catch(() => null)
            if (!groupMetadata) return
            const botJid = conn.user.jid
            const ownerJids = global.owner.map(n => n.replace(/[^0-9]/g, '') + '@s.whatsapp.net')
            const toRemove = groupMetadata.participants
                .filter(p => (p.admin === 'admin' || p.admin === 'superadmin') && p.jid !== botJid && !ownerJids.includes(p.jid))
                .map(p => p.jid)
            for (const jid of toRemove) {
                await conn.groupParticipantsUpdate(groupId, [jid], 'demote').catch(() => null)
            }
            const lista = toRemove.map(j => `@${j.split('@')[0]}`).join(', ')
            await conn.sendMessage(groupId, {
                text: `🛡️ *ANTIRAID ACTIVADO*\n\nSe detectaron ${recent.length} demotes en menos de 1 minuto.\n\nPermisos de admin removidos a:\n${lista || 'ninguno'}\n\nContacta al propietario si fue un error.`,
                mentions: toRemove
            })
        } catch (e) {
            console.error('AntiRaid error:', e)
        }
    }

    // ─────────────────────────────────────────────────────────
    // MUTE — listener dedicado
    // ─────────────────────────────────────────────────────────
   conn.muteHandler = async (upsert) => {
    try {
        const messages = upsert.messages
        for (const msg of messages) {
            if (!msg.key?.remoteJid?.endsWith('@g.us')) continue
            if (msg.key?.fromMe) continue
            const chat = msg.key.remoteJid
let sender = msg.participant || msg.key?.participant || ''
if (sender.includes('@lid')) {
    try {
        const meta = await conn.groupMetadata(chat).catch(() => null)
        if (meta) {
            const found = meta.participants.find(p => 
                p.lid === sender || 
                p.lid?.split('@')[0] === sender.split('@')[0]
            )
            if (found) sender = found.jid || found.id || sender
        }
    } catch {}
}            if (!sender) continue
            if (!global.db?.data?.mutedUsers) global.db.data.mutedUsers = {}
            const mutedUsers = global.db.data.mutedUsers
            const key = `${chat}:${sender}`
            const entry = mutedUsers[key]
            if (!entry) continue
            if (entry.expire !== -1 && Date.now() > entry.expire) {
                delete mutedUsers[key]
                continue
            }
            try {
                const groupMetadata = await conn.groupMetadata(chat).catch(() => null)
                if (!groupMetadata) continue
                const botJid = conn.user.jid
                const botParticipant = groupMetadata.participants.find(p => p.jid === botJid || p.id === botJid)
                const botIsAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin'
                if (botIsAdmin) {
                    await conn.sendMessage(chat, { 
                        delete: {
                            remoteJid: chat,
                            id: msg.key.id,
                            fromMe: false,
                            participant: sender
                        }
                    }).catch(e => console.log('DELETE ERROR:', e.message))
                }
            } catch {}
        }
    } catch (e) {
        console.error('MuteHandler error:', e)
    }
}

    conn.ev.on('messages.upsert', conn.handler)
    conn.ev.on('messages.upsert', conn.muteHandler)
    conn.ev.on('connection.update', conn.connectionUpdate)
    conn.ev.on('creds.update', conn.credsUpdate)
    conn.ev.on('group-participants.update', conn.antiraidHandler)

    isInit = false
    return true
}

const tmpDirCheck = join(__dirname, 'tmp')
if (!existsSync(tmpDirCheck)) mkdirSync(tmpDirCheck, { recursive: true })

await global.loadDatabase()

const { state, saveState, saveCreds } = await useMultiFileAuthState(global.sessions)
const msgRetryCounterCache = new NodeCache({ stdTTL: 0, checkperiod: 0 })
const userDevicesCache = new NodeCache({ stdTTL: 0, checkperiod: 0 })
const { version } = await fetchLatestBaileysVersion()
let phoneNumber = global.botNumber
const methodCodeQR = process.argv.includes("qr")
const methodCode = !!phoneNumber || process.argv.includes("code")
const MethodMobile = process.argv.includes("mobile")

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (texto) => new Promise((resolver) => rl.question(texto, resolver))
let opcion

if (methodCodeQR) opcion = '1'

if (!methodCodeQR && !methodCode && !existsSync(credsFile)) {
    do {
        console.log('')
        console.log(chalk.rgb(220, 20, 60)('   ¿Cómo quieres conectar?'))
        console.log(chalk.rgb(220, 20, 60)('   ') + chalk.rgb(180, 20, 20)('1) ') + chalk.rgb(220, 20, 60)('Usar código QR'))
        console.log(chalk.rgb(220, 20, 60)('   ') + chalk.rgb(180, 20, 20)('2) ') + chalk.rgb(220, 20, 60)('Usar código de 8 dígitos'))
        console.log(chalk.rgb(220, 20, 60)('   » Tu opción: '))
        opcion = await question('')
        if (!/^[1-2]$/.test(opcion)) {
            console.log(chalk.rgb(220, 20, 60)('   Solo opciones 1 o 2'))
        }
    } while (opcion !== '1' && opcion !== '2')
}
console.info = () => {}

const connectionOptions = {
    logger: pino({ level: 'silent' }),
    printQRInTerminal: opcion == '1' ? true : methodCodeQR ? true : false,
    mobile: MethodMobile,
    browser: ["Ubuntu", "Chrome", "118.0.0.0"],
    auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, Pino({ level: "fatal" }).child({ level: "fatal" })),
    },
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    getMessage: async (key) => {
        try {
            let jid = jidNormalizedUser(key.remoteJid)
            let msg = await store.loadMessage(jid, key.id)
            return msg?.message || ""
        } catch (error) { return "" }
    },
    msgRetryCounterCache: msgRetryCounterCache,
    userDevicesCache: userDevicesCache,
    defaultQueryTimeoutMs: 5000,
    cachedGroupMetadata: (jid) => global.conn?.chats?.[jid] ?? {},
    version: version,
    keepAliveIntervalMs: 15000,
    maxIdleTimeMs: 20000,
    connectTimeoutMs: 30000,
    fireInitQueries: false,
    txnUpdateTimeoutMs: 5000,
    retryRequestDelayMs: 500,
    delayJitterMs: [100, 750],
    maxMsgRetryCount: 1,
    shouldIgnoreJid: (jid) => false,
    appStateMacVerification: { patch: false, snapshot: false },
    validateFingerprint: false,
    connectionStrategy: 'balanced',
    maxConnectionAttempts: 5,
    maxWaitForConnection: 60000,
    qrTimeout: 60000,
}

global.conn = makeWASocket(connectionOptions)
conn.ev.on("creds.update", saveCreds)

if (!existsSync(credsFile)) {
    if (opcion === '2' || methodCode) {
        opcion = '2'
        if (!conn.authState.creds.registered) {
            let addNumber
            if (!!phoneNumber) {
                addNumber = String(phoneNumber).replace(/[^0-9]/g, '')
            } else {
                do {
                    console.log(chalk.rgb(220, 20, 60)('🐺 INGRESAR NÚMERO'))
                    console.log(chalk.rgb(180, 20, 20)('[+] '))
                    phoneNumber = await question('')
                    phoneNumber = String(phoneNumber).replace(/\D/g, '')
                    if (!phoneNumber.startsWith('+')) phoneNumber = `+${phoneNumber}`
                } while (!await isValidPhoneNumber(phoneNumber))
                rl.close()
                addNumber = phoneNumber.replace(/\D/g, '')
                setTimeout(async () => {
                    let codeBot = await conn.requestPairingCode(addNumber)
                    codeBot = codeBot.match(/.{1,4}/g)?.join("-") || codeBot
                    console.log(chalk.rgb(220, 20, 60)('🔐 CÓDIGO GENERADO'))
                    console.log(chalk.rgb(180, 20, 20)('──────────────────────────'))
                    console.log(chalk.rgb(220, 20, 60)('╔══════════════════════╗'))
                    console.log(chalk.rgb(220, 20, 60)('║       ' + codeBot + '       ║'))
                    console.log(chalk.rgb(220, 20, 60)('╚══════════════════════╝'))
                    console.log(chalk.rgb(180, 20, 20)('──────────────────────────'))
                }, 1000)
            }
        }
    }
}

process.on('uncaughtException', console.error)
process.on('unhandledRejection', (reason, promise) => {
    console.error("Rechazo no manejado detectado:", reason)
})

let isInit = true
let handler = await import('./src/Rory-Mercury.js')

_quickTest().catch(console.error)

global.rutaJadiBot = join(__dirname, `./${global.jadi}`)
if (global.shirokoJadibts) {
    if (!existsSync(global.rutaJadiBot)) {
        mkdirSync(global.rutaJadiBot, { recursive: true })
    }
    const readRutaJadiBot = readdirSync(global.rutaJadiBot)
    if (readRutaJadiBot.length > 0) {
        console.log(chalk.rgb(180, 20, 20)(`→ Detectadas ${readRutaJadiBot.length} sesiones. Iniciando reconexión...`))
        for (const gjbts of readRutaJadiBot) {
            const botPath = join(global.rutaJadiBot, gjbts)
            if (existsSync(botPath) && statSync(botPath).isDirectory()) {
                const creds = join(botPath, 'creds.json')
                if (existsSync(creds)) {
                    setTimeout(async () => {
                        try {
                            await shirokoJadiBot({
                                pathshirokoJadiBot: botPath,
                                m: { sender: gjbts + '@s.whatsapp.net', chat: gjbts + '@s.whatsapp.net' },
                                conn: global.conn,
                                args: [],
                                usedPrefix: '/',
                                command: 'qr',
                                fromCommand: false
                            })
                        } catch (e) {}
                    }, 10000)
                }
            }
        }
    }
}

if (!global.opts['test']) {
    if (global.db) setInterval(async () => {
        if (global.db.data) await global.db.write()
        if (global.opts['autocleartmp'] && global.support?.find) {
            const tmp = [join(__dirname, 'tmp'), join(__dirname, 'tmp'), join(__dirname, 'tmp', `${global.jadi}`)]
            tmp.forEach((filename) => spawn('find', [filename, '-amin', '3', '-type', 'f', '-delete']))
        }
    }, 30 * 1000)
}

setInterval(async () => {
    const tmpDirInterval = join(__dirname, 'tmp')
    try {
        if (existsSync(tmpDirInterval)) {
            const filenames = readdirSync(tmpDirInterval)
            filenames.forEach(file => {
                const filePath = join(tmpDirInterval, file)
                if (statSync(filePath).isFile() && !filePath.includes('Sessions') && !filePath.includes('sessions') && file !== 'config.json') {
                    unlinkSync(filePath)
                }
            })
        }
    } catch { }
}, 30 * 1000)

loadCommandsFromFolders().then((_) => Object.keys(global.plugins)).catch(console.error)

conn.isInit = false
console.log(chalk.rgb(139, 0, 0)('╔══════════════════════════════╗'))
console.log(chalk.rgb(220, 20, 60).bold('║     ❤️  Rory-Bot   LISTO     ║'))
console.log(chalk.rgb(139, 0, 0)('╚══════════════════════════════╝'))

setupWatcher()
await global.reloadHandler()