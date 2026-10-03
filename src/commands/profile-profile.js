import { xpRange } from '../../lib/levelling.js'
import moment from 'moment-timezone'
import fetch from 'node-fetch'

let handler = async (m, { conn, usedPrefix, args }) => {
try {
// Detección mejorada de menciones
let mentionedJid = await m.mentionedJid
let targetRaw = (Array.isArray(mentionedJid) && mentionedJid.length)
    ? mentionedJid[0]
    : null

if (targetRaw && targetRaw.includes('@lid')) {
    try {
        const meta = await conn.groupMetadata(m.chat)
        const found = meta.participants.find(p =>
            p.lid === targetRaw ||
            p.lid?.split('@')[0] === targetRaw.split('@')[0]
        )
        if (found) targetRaw = found.jid || found.id || targetRaw
    } catch {}
}

if (!targetRaw && m.quoted) {
    targetRaw = await Promise.resolve(m.quoted.sender)
    if (typeof targetRaw !== 'string') {
        targetRaw = targetRaw?.jid || targetRaw?.id || String(targetRaw)
    }
}

let userId = targetRaw || m.sender

if (userId.includes('@lid') || !userId.includes('@s.whatsapp.net')) {
    try {
        const meta = await conn.groupMetadata(m.chat)
        const found = meta.participants.find(p =>
            p.lid === userId ||
            p.jid === userId ||
            p.id === userId ||
            p.lid?.split('@')[0] === userId.split('@')[0] ||
            p.jid?.split('@')[0] === userId.split('@')[0]
        )
        if (found) userId = found.jid || found.id || userId
    } catch {
        userId = userId
    }
}

let name = await global.getProperName(conn, userId)
if (!global.db.data.users) global.db.data.users = {}
if (!global.db.data.characters) global.db.data.characters = {}
if (!global.db.data.users[userId]) global.db.data.users[userId] = {}
const user = global.db.data.users[userId]
const cumpleanos = user.birth || `Sin especificar :< (${usedPrefix}setbirth)`
const genero = user.genre || 'Sin especificar'
const pareja = user.marry
const casado = pareja ? (await global.getProperName(conn, pareja)) : ''
const description = user.description || ''
const exp = user.exp || 0
const nivel = user.level || 0
const coin = user.coin || 0
const bank = user.bank || 0
const total = coin + bank
const sorted = Object.entries(global.db.data.users).map(([k, v]) => ({ ...v, jid: k })).sort((a, b) => (b.level || 0) - (a.level || 0))
const rank = sorted.findIndex(u => u.jid === userId) + 1
const progreso = (() => {
let datos = xpRange(nivel, global.multiplier)
return `${exp - datos.min} => ${datos.xp} _(${Math.floor(((exp - datos.min) / datos.xp) * 100)}%)_` })()
const premium = user.premium || global.prems.map(v => v.replace(/\D+/g, '') + '@s.whatsapp.net').includes(userId)
const isLeft = premium ? (global.prems.includes(userId.split('@')[0]) ? 'Permanente' : (user.premiumTime ? await formatTime(user.premiumTime - Date.now()) : '—')) : '—'
const favId = user.favorite
const favLine = favId && global.db.data.characters?.[favId] ? `\n• ❀ Claim favorito » *${global.db.data.characters[favId].name || '???'}*` : ''
const ownedIDs = Object.entries(global.db.data.characters).filter(([, c]) => c.user === userId).map(([id]) => id)
const haremCount = ownedIDs.length
const haremValue = ownedIDs.reduce((acc, id) => {
const char = global.db.data.characters[id] || {}
const value = typeof char.value === 'number' ? char.value : 0
return acc + value }, 0)

const pp = await conn.profilePictureUrl(userId, 'image').catch(_ => 'https://raw.githubusercontent.com/speed3xz/Storage/refs/heads/main/Arlette-Bot/b75b29441bbd967deda4365441497221.jpg')

let textoCasado
if (genero.toLowerCase() === 'mujer') {
    textoCasado = '• ✧ Casada con: *'
} else if (genero.toLowerCase() === 'hombre') {
    textoCasado = '• ✧ Casado con: *'
} else {
    textoCasado = '• ✧ Casado/a con: *'
}
const textoMatrimonio = casado ? `${textoCasado}${casado}*\n` : ''

let parentesco = '• ❒ Hijo/a de: *'
if (genero.toLowerCase() === 'mujer') parentesco = '• ❒ Hija de: *'
if (genero.toLowerCase() === 'hombre') parentesco = '• ❒ Hijo de: *'

const padres = user.padres && user.padres.length > 0
    ? user.padres.map(v => global.db.data.users[v]?.name || v.split('@')[0]).join(' y ')
    : ''
const hijos = user.hijos && user.hijos.length > 0
    ? user.hijos.map(v => global.db.data.users[v]?.name || v.split('@')[0]).join(', ')
    : ''

const textoPadres = padres ? `${parentesco}${padres}*\n` : ''
const textoHijos = hijos ? `• ✰ Hijos: *${hijos}*\n` : ''

const text = `
\`P E R F I L   〤   U S U A R I O\`

${description ? `${description}\n\n` : ''}✰ *INFORMACIÓN PERSONAL*
- ꕤ Nombre: *${name}*
- ❀ Cumpleaños: *${cumpleanos}*
- ❒ Género: *${genero}*
${textoMatrimonio}${textoPadres}${textoHijos}
❒ *PROGRESO Y NIVEL*
- ✰ Experiencia: *${exp.toLocaleString()}*
- ꕤ Nivel: *${nivel}*
- ❀ Rango: *#${rank}*
- ✧ Progreso: *${progreso}*

✧ *ECONOMÍA Y HEREM*
- ❀ Harem: *${haremCount}*
- ✰ Valor Total: *${haremValue.toLocaleString()}*
${favLine}• ❒ Monedas: *${total.toLocaleString()} ${global.currency || 'Coins'}*
- ꕤ Comandos: *${user.commands || 0}*

ꕤ Usa ${usedPrefix}profile para ver tu perfil.`

await conn.sendMessage(m.chat, { image: { url: pp }, caption: text, mentions: [...(user.padres || []), ...(user.hijos || []), userId] })
} catch (error) {
await m.reply(`⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`)
}}

handler.help = ['profile']
handler.tags = ['rg']
handler.command = ['profile', 'perfil', 'perfíl']
handler.group = true
export default handler

async function formatTime(ms) {
let s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24)
let months = Math.floor(d / 30), weeks = Math.floor((d % 30) / 7)
s %= 60; m %= 60; h %= 24; d %= 7
let t = months ? [`${months} mes${months > 1 ? 'es' : ''}`] :
weeks ? [`${weeks} semana${weeks > 1 ? 's' : ''}`] :
d ? [`${d} día${d > 1 ? 's' : ''}`] : []
if (h) t.push(`${h} hora${h > 1 ? 's' : ''}`)
if (m) t.push(`${m} minuto${m > 1 ? 's' : ''}`)
if (s) t.push(`${s} segundo${s > 1 ? 's' : ''}`)
return t.length > 1 ? t.slice(0, -1).join(' ') + ' y ' + t.slice(-1) : t[0]
}