import fetch from 'node-fetch'
import { lookup } from 'mime-types'

// ─────────────────────────────────────────────────────────────
// CADENA (reemplaza api-nexy, dominio muerto)
//  1. alyacore /dl/mediafire (la que usa el repo de Luffy)
//  2. scrape directo de la página de Mediafire (método del repo Ruby)
// ─────────────────────────────────────────────────────────────

const ALYACORE_KEY = 'LUFFY-FIX67'
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }

async function apiAlyacore(url) {
    const res = await fetch(`https://api.alyacore.xyz/dl/mediafire?url=${encodeURIComponent(url)}&key=${ALYACORE_KEY}`, {
        headers: UA, signal: AbortSignal.timeout(30000)
    })
    const json = await res.json().catch(() => null)
    const d = json?.data || json?.result || {}
    const dl = d.url || d.download || d.link
    if (!json?.status || !dl) throw new Error(json?.message || 'alyacore sin datos')
    return {
        filename: d.filename || d.name || dl.split('/').pop().split('?')[0],
        filesize: d.filesize || d.size || '',
        url: dl
    }
}

// scrape: la página del archivo contiene el enlace directo en el botón de descarga
async function scrapeMediafire(url) {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) })
    const html = await res.text()
    const dl = (html.match(/href="(https:\/\/download\d+\.mediafire\.com\/[^"]+)"/) || [])[1]
        || (html.match(/"downloadLink":"([^"]+)"/) || [])[1]?.replace(/\\/g, '')
    if (!dl) throw new Error('No pude leer la página de Mediafire.')
    const filename = decodeURIComponent(dl.split('/').pop().split('?')[0])
    return { filename, filesize: '', url: dl }
}

let handler = async (m, { conn, text, usedPrefix }) => {
    if (!text) return conn.reply(m.chat, 'ꕤ Te faltó el enlace de Mediafire.', m)
    if (!/^https:\/\/(www\.)?mediafire\.com\//i.test(text)) return conn.reply(m.chat, 'ꕤ Enlace inválido.', m)

    try {
        let file = null
        try { file = await apiAlyacore(text) } catch { file = null }
        if (!file) file = await scrapeMediafire(text)

        const extension = file.filename.split('.').pop()
        const mimetype = lookup(extension) || 'application/octet-stream'

        const caption = `乂  MEDIAFIRE - DESCARGA  乂\n\n✩ *Nombre »* ${file.filename}\n✩ *Peso »* ${file.filesize || '?'}\n✩ *MimeType »* ${mimetype}\n✩ *Enlace »* ${text}`

        await conn.sendMessage(m.chat, {
            document: { url: file.url },
            fileName: file.filename,
            mimetype,
            caption
        }, { quoted: m })

    } catch (e) {
        return conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n\n${e.message}`, m)
    }
}

handler.command = ['mf', 'mediafire']
handler.help = ['mediafire']
handler.tags = ['descargas']
handler.group = true
handler.premium = true

export default handler
