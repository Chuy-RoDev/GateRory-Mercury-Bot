import axios from 'axios'

const handler = async (m, { conn, text, usedPrefix }) => {
if (!text) return conn.reply(m.chat, `ꕤ Por favor, ingrese un texto para buscar una Imagen.`, m)
try {
await m.react('🕒')
const urls = await buscarImagenes(text)
if (urls.length < 2) { await m.react('✖️'); return conn.reply(m.chat, '✧ No se encontraron suficientes imágenes para un álbum.', m) }
const medias = urls.slice(0, 10).map(url => ({ type: 'image', data: { url } }))
const caption = `ꕤ Resultados de búsqueda para: ${text}`
await conn.sendSylphy(m.chat, medias, { caption, quoted: m })
await m.react('✔️')
} catch (error) {
await m.react('✖️')
conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`, m)
}}

handler.help = ['imagen']
handler.tags = ['descargas']
handler.command = ['imagen', 'image']

export default handler

// FIX: api.delirius.store esta MUERTA (sin registros DNS) y siputzx /api/images
// devuelve 404 (ruta eliminada) — por eso /imagen siempre tiraba error.
// Backend nuevo VERIFICADO: siputzx /api/s/pinterest (devuelve image_url directo
// a i.pinimg.com). Fallback VERIFICADO: busqueda de Wikimedia Commons (sin key).
async function buscarImagenes(query) {
const backends = [buscarPinterest, buscarWikimedia]
for (const backend of backends) {
try {
const urls = await backend(query)
if (urls.length >= 2) return urls
} catch {}
}
return []
}

async function buscarPinterest(query) {
const res = await axios.get(`${global.APIs.siputzx.url}/api/s/pinterest?query=${encodeURIComponent(query)}`, { timeout: 20000 })
const data = res.data?.data
if (!Array.isArray(data)) return []
// solo imagenes fijas (type "image"): evita videos/gifs que sendSylphy no manda bien
return data
.filter(d => d?.type === 'image' && typeof d.image_url === 'string' && /^https:\/\/i\.pinimg\.com\//.test(d.image_url))
.map(d => d.image_url)
}

async function buscarWikimedia(query) {
const params = new URLSearchParams({
action: 'query', generator: 'search', gsrsearch: query,
gsrnamespace: '6', gsrlimit: '10', prop: 'imageinfo',
iiprop: 'url', iiurlwidth: '900', format: 'json'
})
const res = await axios.get(`${global.wikimediaApiBase || 'https://commons.wikimedia.org'}/w/api.php?${params}`, { timeout: 20000, headers: { 'User-Agent': 'GateRoryBot/1.0' } })
const pages = res.data?.query?.pages
if (!pages || typeof pages !== 'object') return []
return Object.values(pages)
.map(p => p?.imageinfo?.[0]?.thumburl)
.filter(u => typeof u === 'string' && u.startsWith('http'))
}
