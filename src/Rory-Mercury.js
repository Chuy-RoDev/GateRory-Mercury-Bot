import { smsg } from "../lib/simple.js"
import { format } from "util"
import { fileURLToPath } from "url"
import path, { join } from "path"
import fs, { unwatchFile, watchFile } from "fs"
import chalk from "chalk"
import fetch from "node-fetch"
import ws from "ws"

const { proto } = (await import("@whiskeysockets/baileys")).default

const isNumber = x => typeof x === "number" && !isNaN(x)
const delay = ms => isNumber(ms) && new Promise(resolve => setTimeout(resolve, ms))

const groupMetadataCache = new Map()

export async function handler(chatUpdate) {
    this.msgqueque = this.msgqueque || []
    this.uptime = this.uptime || Date.now()
    if (!chatUpdate) return

    this.pushMessage(chatUpdate.messages).catch(() => null)
    let m = chatUpdate.messages[chatUpdate.messages.length - 1]
    if (!m) return

    // BOZAL ABSOLUTO PARA SUB-BOTS: Si escriben /autorw, solo el principal actúa
    if (m.text && /^[#./!]?autorw/i.test(m.text.trim())) {
        const currentBotDigits = String(this.user?.jid || this.user?.id || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
        const mainBotDigits = String(global.conn?.user?.jid || global.conn?.user?.id || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
        if (currentBotDigits !== mainBotDigits) return
    }

    if (global.db.data == null) await global.loadDatabase()

    try {
        try {
            m = smsg(this, m) || m
        } catch (e) {
            return
        }

        if (!m || m.isBaileys) return
        m.exp = 0

        const { sender, chat: mChat, name: mName } = m
        const db = global.db.data

        if (!db.users[sender]) db.users[sender] = { name: mName, exp: 0, coin: 0, bank: 0, level: 0, health: 100, genre: "", birth: "", marry: "", description: "", packstickers: null, premium: false, premiumTime: 0, banned: false, bannedReason: "", commands: 0, afk: -1, afkReason: "", warn: 0 }
        if (!db.chats[mChat]) db.chats[mChat] = { isBanned: false, isMute: false, welcome: global.modes.welcome, sWelcome: "", sBye: "", detect: global.modes.detect, primaryBot: null, modoadmin: global.modes.modoadmin, antiLink: global.modes.antilink, nsfw: global.modes.nsfw, economy: global.modes.economy, gacha: global.modes.gacha }
        if (!db.settings[this.user.jid]) db.settings[this.user.jid] = { self: global.modes.self, jadibotmd: global.modes.jadibotmd, autoread: global.modes.autoread, autoreaction: global.modes.autoreaction, anticall: global.modes.anticall }

        const user = db.users[sender]
        const chat = db.chats[mChat]
        const settings = db.settings[this.user.jid]

        // Normalización limpia de JID (corta :dispositivo y @servidor antes de filtrar dígitos)
        const parseNum = v => {
            if (!v) return ""
            const str = Array.isArray(v) ? v[0] : v
            const base = String(str).split('@')[0].split(':')[0]
            return base.replace(/[^0-9]/g, "")
        }

        const isROwner = global.owner.some(num => {
            const clean = parseNum(num)
            return clean + "@s.whatsapp.net" === sender || clean + "@lid" === sender
        }) || m.fromMe

        const isOwner = isROwner
        const isPrems = isROwner || global.prems.some(v => {
            const clean = parseNum(v)
            return clean + "@s.whatsapp.net" === sender || clean + "@lid" === sender
        }) || user.premium

        const isOwners = [
            this.user.jid,
            ...global.owner.flatMap(v => {
                const clean = parseNum(v)
                return [clean + "@s.whatsapp.net", clean + "@lid"]
            })
        ].includes(sender)

        if (typeof m.text !== "string") m.text = ""
        m.exp += Math.ceil(Math.random() * 10)

        let usedPrefix
        let groupMetadata, participants, userGroup, botGroup

        if (m.isGroup) {
            const now = Date.now()
            const cached = groupMetadataCache.get(mChat)
            if (cached && (now - cached.timestamp) < 15000) {
                groupMetadata = cached.metadata
                participants = cached.participants
            } else {
                groupMetadata = await this.groupMetadata(mChat).catch(() => ({}))
                participants = (groupMetadata.participants || []).map(p => ({ id: p.jid || p.id, jid: p.jid || p.id, lid: p.lid, admin: p.admin }))
                groupMetadataCache.set(mChat, { metadata: groupMetadata, participants, timestamp: now })
            }

            userGroup = participants.find(u => this.decodeJid(u.jid) === sender || this.decodeJid(u.lid || '') === sender) || {}
            botGroup = participants.find(u => this.decodeJid(u.jid) === this.user.jid || this.decodeJid(u.lid || '') === this.user.jid) || {}
        } else {
            participants = []
            userGroup = {}
            botGroup = {}
        }

        const isRAdmin = userGroup?.admin === "superadmin" ||
            (m.isGroup && groupMetadata?.participants?.some(p =>
                (this.decodeJid(p.jid) === this.decodeJid(sender) || this.decodeJid(p.id) === this.decodeJid(sender)) &&
                p.admin === "superadmin"
            ))

        const isAdmin = isRAdmin ||
            userGroup?.admin === "admin" ||
            (m.isGroup && groupMetadata?.participants?.some(p =>
                (this.decodeJid(p.jid) === this.decodeJid(sender) || this.decodeJid(p.id) === this.decodeJid(sender)) &&
                p.admin === "admin"
            ))

        const isBotAdmin = botGroup?.admin === "admin" ||
            botGroup?.admin === "superadmin" ||
            (m.isGroup && groupMetadata?.participants?.some(p =>
                (this.decodeJid(p.jid) === this.decodeJid(this.user.jid) || this.decodeJid(p.id) === this.decodeJid(this.user.jid)) &&
                (p.admin === "admin" || p.admin === "superadmin")
            ))

        if (!m.isGroup) {
            const cmdPermitidos = /^[./!#]?(restart|update|join|reload|code|qr|jadibot|subbot|ping|estado|status|infobot|help|menu)$/i
            if (!isOwner && !cmdPermitidos.test(m.text)) return
        }

        // SISTEMA DE BOT PRIMARIO Y PREFIJOS DINÁMICOS
        let isCommandAllowed = true

        if (m.isGroup && m.text) {
            const currentBotDigits = parseNum(this.user?.jid || this.user?.id)
            const mainBotDigits = parseNum(global.conn?.user?.jid || global.conn?.user?.id)
            const primaryDigits = parseNum(chat.primaryBot)

            const currentSub = Array.isArray(global.conns) ? global.conns.find(c => {
                const cJidClean = parseNum(c.jid)
                const cSubIdClean = parseNum(c.subId)
                return currentBotDigits === cJidClean || currentBotDigits === cSubIdClean
            }) : null

            if (currentSub) {
                console.log(`[ DEBUG ] Found subbot: ${currentSub.name}, digits: ${parseNum(currentSub.subId)}`)
            }

            const botRawName = currentSub?.name || currentSub?.notify || this.user?.name || (currentBotDigits === mainBotDigits ? global.botname : '') || global.botname || ''

            const botPrefixesSet = new Set()
            if (currentSub?.prefix) {
                const cp = currentSub.prefix.trim().toLowerCase()
                botPrefixesSet.add(cp.endsWith('/') ? cp : `${cp}/`)
            }
            if (botRawName) {
                const parts = String(botRawName).toLowerCase().split(/[\s/_\-]+/).map(p => p.replace(/[^a-z0-9]/g, '')).filter(Boolean)
                for (const p of parts) {
                    botPrefixesSet.add(`${p[0]}/`)
                    botPrefixesSet.add(`${p}/`)
                }
            }
            const myPrefixes = Array.from(botPrefixesSet)

            let isPrimary = false
            if (primaryDigits) {
                const isPrimaryInGroup = participants.some(p => [p.jid, p.id, p.lid].map(parseNum).includes(primaryDigits))
                const isPrimaryAlive = (primaryDigits === mainBotDigits) || (Array.isArray(global.conns) && global.conns.some(c => {
                    const isAlive = c.sock?.ws?.socket?.readyState !== ws.CLOSED
                    const cDigits = [c.jid, c.subId, c.sock?.user?.id, c.sock?.user?.jid].map(parseNum)
                    return isAlive && cDigits.includes(primaryDigits)
                }))

                if (isPrimaryInGroup && isPrimaryAlive) {
                    isPrimary = (currentBotDigits === primaryDigits)
                } else {
                    chat.primaryBot = null
                    isPrimary = (currentBotDigits === mainBotDigits)
                }
            } else {
                isPrimary = (currentBotDigits === mainBotDigits)
            }

            // Exención para comandos de administración y gacha para evitar bloqueos
            const isExemptCmd = /^[#./!]?(setprimary|setprefix|prefix|rw|ginfo|c|claim|rollwaifu|autorw)(\s+|$)/i.test(m.text.trim())

            if (isExemptCmd) {
                isCommandAllowed = true
            } else {
                const matchedNamedPrefix = myPrefixes.find(p => m.text.toLowerCase().startsWith(p.toLowerCase()))
                const isOtherBotPrefix = !matchedNamedPrefix && /^[a-z0-9]+\//i.test(m.text)

                if (matchedNamedPrefix) {
                    m.text = '/' + m.text.slice(matchedNamedPrefix.length).trim()
                    isCommandAllowed = true
                } else if (isOtherBotPrefix) {
                    isCommandAllowed = false
                } else {
                    isCommandAllowed = isPrimary
                }
            }
        }

        for (const name in global.plugins) {
            const plugin = global.plugins[name]
            if (!plugin || plugin.disabled) continue

            if (typeof plugin.all === "function") {
                await plugin.all.call(this, m, { chatUpdate, user, chat, settings }).catch(() => null)
                await delay(200)
            }

            if (!opts["restrict"] && plugin.tags?.includes("admin")) continue

            // Si el grupo tiene un prefijo asignado (chat.prefix), se usa exclusivamente ese.
            // Si no tiene prefijo personalizado, usa la lista por defecto (global.prefix).
            const globalPrefixList = Array.isArray(global.prefix) ? global.prefix : (global.prefix ? [global.prefix] : ['/'])
            const combinedPrefixes = chat.prefix ? [chat.prefix] : globalPrefixList

            const pluginPrefix = plugin.customPrefix || combinedPrefixes || this.prefix || global.prefix
            let match = null

            const strRegex = (str) => {
                if (str instanceof RegExp) return str.source
                return String(str || '').replace(/[|\\{}()[\]^$+*?.]/g, "\\$&")
            }

            if (m.text) {
                const prefixRegex = pluginPrefix instanceof RegExp 
                    ? pluginPrefix 
                    : new RegExp(`^(${[].concat(pluginPrefix).filter(Boolean).map(p => strRegex(p)).join('|')})`)
                
                const execResult = prefixRegex.exec(m.text)
                if (execResult) match = [execResult, prefixRegex]
            }

            if (typeof plugin.before === "function") {
                if (await plugin.before.call(this, m, { match, conn: this, participants, groupMetadata, userGroup, botGroup, isROwner, isOwner, isRAdmin, isAdmin, isBotAdmin, isPrems, chatUpdate, user, chat, settings })) continue
            }

            if (!isCommandAllowed) continue
            if (typeof plugin !== "function" || !match) continue

            usedPrefix = match[0][0]
            const noPrefix = m.text.slice(usedPrefix.length).trim()
            let [command, ...args] = noPrefix.split(/\s+/).filter(v => v)
            command = (command || "").toLowerCase()

            const isAccept = plugin.command instanceof RegExp ? plugin.command.test(command) :
                Array.isArray(plugin.command) ? plugin.command.some(cmd => cmd instanceof RegExp ? cmd.test(command) : cmd === command) :
                plugin.command === command

            global.comando = command
            if (!isOwners && settings.self) return
            if (/^(NJX-|BAE5|B24E)/.test(m.id)) return
            if (!isAccept) continue

            m.plugin = name
            user.commands = (user.commands || 0) + 1

            if (chat.isBanned && !isAdmin && !isROwner && name !== "group-banchat.js") {
                await m.reply(global.msg.aviso.replace('${botname}', global.botname).replace('${usedPrefix}', usedPrefix))
                return
            }

            if (user.banned && !isROwner) {
                m.reply(global.msg.mensaje.replace('${bannedReason}', user.bannedReason))
                return
            }

            if (!isOwners && !m.chat.endsWith('g.us') && !/code|p|ping|qr|estado|status|infobot|botinfo|report|reportar|invite|join|logout|suggest|help|menu/gim.test(m.text)) return

            const wa = plugin.botAdmin || plugin.admin || plugin.group || plugin.command
            if (chat.modoadmin && !isOwner && m.isGroup && !isAdmin && wa) return

            if (global.opts['onlycc'] && !isROwner && !isOwners) return

            const fail = plugin.fail || global.dfail
            if ((plugin.rowner || plugin.owner) && !isOwner) { fail("owner", m, this); continue }
            if (plugin.premium && !isPrems) { fail("premium", m, this); continue }
            if (plugin.group && !m.isGroup) { fail("group", m, this); continue }
            if (plugin.botAdmin && !isBotAdmin) { fail("botAdmin", m, this); continue }
            if (plugin.admin && !isAdmin) { fail("admin", m, this); continue }
            if (plugin.private && m.isGroup) { fail("private", m, this); continue }

            m.isCommand = true
            m.exp += plugin.exp ? parseInt(plugin.exp) : 10
            const extra = { match, usedPrefix, noPrefix, args, command, text: args.join(" "), conn: this, participants, groupMetadata, userGroup, botGroup, isROwner, isOwner, isRAdmin, isAdmin, isBotAdmin, isPrems, chatUpdate, user, chat, settings }

            try {
                await plugin.call(this, m, extra)
                await delay(500)
            } catch (err) {
                console.error(err)
            } finally {
                if (typeof plugin.after === "function") {
                    try { await plugin.after.call(this, m, extra) } catch (e) {}
                }
            }
            break
        }
    } catch (err) {
        console.error(err)
    } finally {
        if (m?.sender && global.db.data.users[m.sender]) {
            global.db.data.users[m.sender].exp += m.exp || 0
        }
        if (!opts["noprint"]) {
            import("../lib/print.js").then(ptr => ptr.default(m, this)).catch(() => null)
        }
    }
}

global.dfail = (type, m, conn) => {
    const msg = global.msg[type]
    if (msg) return conn.reply(m.chat, msg.replace('${comando}', global.comando), m).then(_ => m.react('✖️'))
}