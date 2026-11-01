import fetch from 'node-fetch'
import axios from 'axios'
import cheerio from 'cheerio'

// [ CONFIG DEL LOTE ACUMULATIVO ]
// El usuario responde con números (1, 3, 5...) y las elecciones se acumulan.
// El lote se envía cuando: elige MAX_VIDEOS, pasan IDLE_MS sin elegir más,
// o se agota TOTAL_MS desde la búsqueda. Descarga en paralelo y manda:
// 1 video  → mensaje normal de video
// 2 o más  → álbum nativo de WhatsApp (mismo método que /pin, sendSylphy)
const MAX_VIDEOS = 5
const IDLE_MS = 20_000
const TOTAL_MS = 180_000
const DL_TIMEOUT = 15_000

// Base del sitio (hook para tests deterministas: en producción es siempre xvideos.com)
const XV_BASE = global.xvideosBaseUrl || 'https://www.xvideos.com'

const fixUrl = (u) => (u && u.startsWith('/') ? XV_BASE + u : u)

const handler = async (m, { text, conn, usedPrefix }) => {
if (!db.data.chats[m.chat].nsfw && m.isGroup) {
return m.reply(`ꕥ El contenido *NSFW* está desactivado en este grupo.\n\nUn *administrador* puede activarlo con el comando:\n» *${usedPrefix}nsfw on*`)
}
if (!text) {
return m.reply('❀ Por favor, ingresa el título o URL del video de *(xvideos)*.\n\n» Puedes acumular hasta *' + MAX_VIDEOS + '* respondiendo con números y se envían juntos.')
}
conn.xvideos = conn.xvideos || {}
const query = text.trim()
const isUrl = query.startsWith(XV_BASE) || /xvideos\.com/i.test(query)

// [ RUTA 1: URL DIRECTA ]
if (isUrl) {
try {
await m.react('🕒')
const res = await xvideosdl(query)
const dll = fixUrl(res.result?.url)
if (!dll) throw new Error('No se encontró el enlace de descarga del video.')
await conn.sendFile(m.chat, dll, 'xvideos.mp4', '*乂 ¡XVIDEOS - DOWNLOAD! 乂*', m)
await m.react('✔️')
} catch (e) {
await m.react('✖️')
await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n` + e, m)
}
return
}

// [ RUTA 2: BÚSQUEDA + LOTE ]
const res = await search(query)
await m.react('🕒')
if (!res.length) {
return m.reply('ꕥ No se encontraron resultados.')
}
const list = res.slice(0, 10).map((v, i) => `*${i + 1}*\n≡ Título : *${v.title}*\n≡ Link : ${v.url}`).join('\n\n')
const caption = `*乂 ¡XVIDEOS - SEARCH! 乂*

${list}

> » Responde con el *número* para acumular videos (máx *${MAX_VIDEOS}*).
> » Se envían *juntos en un álbum* cuando termines de elegir.`

// Si tenía una sesión previa activa, se limpia antes de crear la nueva
const previa = conn.xvideos[m.sender]
if (previa) {
clearTimeout(previa.idleTimer)
clearTimeout(previa.totalTimer)
delete conn.xvideos[m.sender]
}

const { key } = await conn.sendMessage(m.chat, { text: caption }, { quoted: m })
conn.xvideos[m.sender] = {
result: res.slice(0, 10),
key,
picks: [],
idleTimer: null,
totalTimer: setTimeout(() => flushBatch(conn, m.sender), TOTAL_MS),
}
programarIdle(conn, m.sender)
await m.react('✔️')
}

handler.before = async (m, { conn }) => {
conn.xvideos = conn.xvideos || {}
const session = conn.xvideos[m.sender]
if (!session || !m.quoted || m.quoted.id !== session.key.id) return
const n = parseInt(m.text.trim())
if (isNaN(n) || n < 1 || n > session.result.length) {
await m.reply('ꕥ Por favor, responde con un número válido (1-' + session.result.length + ').')
return
}
const pick = session.result[n - 1]
if (session.picks.some(p => p.url === pick.url)) {
await m.react('ℹ️')
await m.reply(`ꕥ Ese video ya está en tu lote (*${session.picks.length}/${MAX_VIDEOS}*).`)
return
}
session.picks.push(pick)
await m.react('✅')

if (session.picks.length >= MAX_VIDEOS) {
return flushBatch(conn, m.sender)
}
programarIdle(conn, m.sender)
await m.reply(`ꕥ Agregado *${session.picks.length}/${MAX_VIDEOS}*. Sigue respondiendo con números, o espera *${Math.round(IDLE_MS / 1000)}s* sin elegir para que se envíen juntos.`)
}

// [ ENVÍO DEL LOTE ]
// Descarga en paralelo (cada fallo queda en null y se descarta) y envía:
// 1 video → sendFile normal | 2+ → álbum nativo con caption en el primer medio.
async function flushBatch(conn, sender) {
const session = conn.xvideos[sender]
if (!session) return
delete conn.xvideos[sender]
clearTimeout(session.idleTimer)
clearTimeout(session.totalTimer)

const { key, picks } = session
const chat = key.remoteJid
if (!picks.length) return

await conn.sendMessage(chat, { react: { text: '🕒', key } })

const urls = await Promise.all(picks.map(async (p) => {
try {
const r = await xvideosdl(p.url)
return fixUrl(r?.result?.url)
} catch {
return null
}
}))
const valid = urls.filter(Boolean)

if (!valid.length) {
await conn.reply(chat, '⚠︎ Ninguno de los videos se pudo descargar, intenta de nuevo.', key)
return
}

const faltaron = picks.length !== valid.length ? ` de *${picks.length}*` : ''
const caption = `*乂 ¡XVIDEOS - TUS ELECCIONES! 乂*\n\n≡ Videos: *${valid.length}*${faltaron}`

if (valid.length === 1) {
await conn.sendFile(chat, valid[0], 'xvideos.mp4', caption, key)
} else {
const medias = valid.map(u => ({ type: 'video', data: { url: u } }))
medias[0].caption = caption
await conn.sendSylphy(chat, medias, { quoted: key })
}
await conn.sendMessage(chat, { react: { text: '✔️', key } })
}

function programarIdle(conn, sender) {
const session = conn.xvideos[sender]
if (!session) return
clearTimeout(session.idleTimer)
session.idleTimer = setTimeout(() => flushBatch(conn, sender), IDLE_MS)
}

handler.help = ['xvideos']
handler.tags = ['nsfw']
handler.command = ['xvideos', 'xvsearch', 'xvideosdl', 'xvid']
handler.group = true

export default handler

async function search(query) {
try {
const url = `${XV_BASE}/?k=${encodeURIComponent(query)}`
const response = await axios.get(url, { signal: AbortSignal.timeout(DL_TIMEOUT) })
const $ = cheerio.load(response.data)
const results = []
$("div.mozaique > div").each((index, element) => {
const title = $(element).find("p.title a").attr("title")
const videoUrl = XV_BASE + $(element).find("p.title a").attr("href")
const quality = $(element).find("span.video-hd-mark").text().trim()
results.push({ title, url: videoUrl, quality })
})
return results
} catch (error) {
return []
}
}

async function xvideosdl(url) {
const res = await fetch(url, { signal: AbortSignal.timeout(DL_TIMEOUT) })
const html = await res.text()
const $ = cheerio.load(html, { xmlMode: false })
const title = $("meta[property='og:title']").attr("content")
const videoUrl = $("#html5video > #html5video_base > div > a").attr("href")
return { status: 200, result: { title, url: videoUrl } }
}
