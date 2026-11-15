import fetch from 'node-fetch'
import axios from 'axios'

// ─────────────────────────────────────────────────────────────
// CADENA DE APIs (fallback en orden, la primera que responda gana)
//  1. FDL    (fdown.isuru.eu.org)  → SOLO Facebook (yt-dlp wrapper)
//  2. VKR    (vkrdownloader)       → Facebook + Instagram (multiplataforma)
//  3. Cobalt (api.cobalt.tools)    → FB + IG, pero exige API key
//     (configurable vía global.COBALT_API_KEY / global.COBALT_API_URL)
// ─────────────────────────────────────────────────────────────

const FDL_API = 'https://fdown.isuru.eu.org/download'
const VKR_API = 'https://vkrdownloader.org/server/'
const VKR_API_KEY = 'vkrdownloader' // clave pública documentada por VKrDownloader
const VKR_FALLBACKS = [
    'https://vkrdownloader.vercel.app/download?server=vkr&url=', // deployment viejo, por si vuelve
    'https://vkrdownloader.xyz/download?server=vkr&url='
]
const COBALT_API = 'https://api.cobalt.tools/'
const SIZE_LIMIT_MB = 100
const MAX_FOTOS = 10

const signal = ms => AbortSignal.timeout(ms)

// fb.watch no lo procesa FDL: seguimos el redirect y usamos la URL real de facebook.com
async function resolverUrl(link) {
    if (/fb\.watch\//i.test(link)) {
        try {
            const r = await fetch(link, { redirect: 'follow', signal: signal(15000) })
            if (r.url && /facebook\.com/i.test(r.url)) return r.url
        } catch { }
    }
    return link
}

// ── API 1: FDL ────────────────────────────────────────────────
// POST JSON {url, quality?} → { status:'success', video_info:{title,thumbnail,uploader,...},
//                               download_url, available_formats:[{quality,format_id,ext,url}] }
// OJO: los formatos de alta calidad de FB tienen format_id terminado en "v"
// (video SIN audio). Solo aceptamos formatos progressive (con audio) y mp4.
// El default trae progressive 720p; con rebajar=true se pide quality:'worst'
// → progressive 360p con audio (la única opción menor; el string '360p'
//   explícito está roto en el server, 'worst' es lo que funciona).
async function apiFDL(url, rebajar = false) {
    const body = { url }
    if (rebajar) body.quality = 'worst'

    const res = await fetch(FDL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: signal(60000)
    })
    const json = await res.json().catch(() => null)
    if (!json || json.status !== 'success') return null

    const fmts = Array.isArray(json.available_formats) ? json.available_formats : []
    let mejor = null, mejorQ = -1
    for (const f of fmts) {
        if (!f?.url) continue
        if (f.ext && f.ext !== 'mp4') continue
        if (/v$/i.test(String(f.format_id || ''))) continue // video-only → sin audio, descartado
        const q = parseInt(String(f.quality || '').replace(/\D/g, '')) || 0
        if (q > mejorQ) { mejorQ = q; mejor = f }
    }

    const mediaUrl = mejor?.url || json.download_url
    if (!mediaUrl) return null
    return {
        url: mediaUrl,
        tipo: 'video',
        titulo: json.video_info?.title || '',
        autor: json.video_info?.uploader || '',
        rebajado: rebajar
    }
}

// ── API 2: Alyacore (del repo de Luffy/Asta) ─────────────────
// GET ?url=<enlace>&key=LUFFY-FIX67 → FB: { resultados:[{quality,url}] }
// IG: { result|data: { hd|sd|url|medias:[...] } }
const ALYACORE_KEY = 'LUFFY-FIX67'

async function apiAlyacoreFB(url, rebajar = false) {
    const res = await fetch(`https://api.alyacore.xyz/dl/facebook?url=${encodeURIComponent(url)}&key=${ALYACORE_KEY}`, { signal: signal(30000) })
    const json = await res.json().catch(() => null)
    const lista = Array.isArray(json?.resultados) ? json.resultados : (Array.isArray(json?.data) && json.data[0]?.url ? json.data : [])
    const fmts = lista.filter(f => f?.url)
    if (!fmts.length) return null
    const cal = f => parseInt(String(f.quality || '').replace(/\D/g, '')) || 0
    const elegido = rebajar ? fmts.reduce((a, b) => (cal(b) < cal(a) ? b : a)) : fmts.reduce((a, b) => (cal(b) > cal(a) ? b : a))
    return { url: elegido.url, tipo: 'video', titulo: json?.title || json?.data?.title || '', autor: '', rebajado: rebajar }
}

async function apiAlyacoreIG(url, rebajar = false) {
    const res = await fetch(`https://api.alyacore.xyz/dl/instagram?url=${encodeURIComponent(url)}&key=${ALYACORE_KEY}`, { signal: signal(30000) })
    const json = await res.json().catch(() => null)
    const r = json?.result || json?.data || {}
    const medias = Array.isArray(r.medias) ? r.medias : Array.isArray(r.media) ? r.media : null
    if (medias?.length) {
        const items = medias.map(x => x.url || x).filter(u => /^https?:\/\//.test(String(u)))
        if (!items.length) return null
        const hayVideo = items.some(u => /mp4/i.test(u)) || medias.some(x => /video/i.test(x.type || ''))
        if (hayVideo) return { url: items.find(u => /mp4/i.test(u)) || items[0], tipo: 'video', titulo: r.title || r.caption || '', autor: r.author || r.username || '', rebajado: rebajar }
        return { tipo: 'fotos', items: items.slice(0, MAX_FOTOS), titulo: r.title || r.caption || '' }
    }
    const uno = r.hd || r.sd || r.url
    if (!uno) return null
    return { url: uno, tipo: 'video', titulo: r.title || r.caption || '', autor: r.author || r.username || '', rebajado: rebajar }
}

// ── API 3: VKR ────────────────────────────────────────────────
// GET ?api_key=vkrdownloader&vkr=<url> → { title, thumbnail, formats:[{url,format_id,ext,size}] }
// (algunas versiones envuelven todo en "data" o usan "medias": se cubren las 3 formas)
async function apiVKR(url, rebajar = false) {
    const endpoints = [
        `${VKR_API}?api_key=${VKR_API_KEY}&vkr=${encodeURIComponent(url)}`,
        ...VKR_FALLBACKS.map(b => `${b}${encodeURIComponent(url)}`)
    ]
    for (const ep of endpoints) {
        try {
            const res = await fetch(ep, {
                headers: { 'x-api-key': VKR_API_KEY },
                signal: signal(15000)
            })
            const json = await res.json().catch(() => null)
            if (!json) continue

            const data = json.data || json
            const lista = Array.isArray(data.formats) ? data.formats
                : Array.isArray(data.medias) ? data.medias
                : Array.isArray(data) ? data : []

            const videos = lista.filter(v => v?.url && (!v.ext || /mp4/i.test(v.ext)))
            const fotos = lista.filter(v => v?.url && /jpe?g|png|webp/i.test(v.ext || v.type || ''))

            if (videos.length) {
                const calidad = v => parseInt(String(v.format_id || v.quality || '').replace(/\D/g, '')) || 0
                const elegido = rebajar
                    ? videos.reduce((a, b) => (calidad(b) < calidad(a) ? b : a)) // el más liviano
                    : videos.reduce((a, b) => (calidad(b) > calidad(a) ? b : a)) // el mejor
                return { url: elegido.url, tipo: 'video', titulo: data.title || '', autor: '', rebajado: rebajar }
            }
            if (fotos.length) {
                return { tipo: 'fotos', items: fotos.slice(0, MAX_FOTOS).map(f => f.url), titulo: data.title || '' }
            }
        } catch { }
    }
    return null
}

// ── API 3: Cobalt ─────────────────────────────────────────────
// POST {url} → { status:'tunnel'|'redirect'|'stream', url, filename }
// Requiere API key: si global.COBALT_API_KEY está definido se usa; si no, intenta igual
// (api.cobalt.tools devolverá error de auth y el comando seguirá con la cadena).
async function apiCobalt(url, rebajar = false) {
    const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' }
    if (global.COBALT_API_KEY) headers.Authorization = `Api-Key ${global.COBALT_API_KEY}`
    const api = global.COBALT_API_URL || COBALT_API

    const res = await fetch(api, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url, videoQuality: rebajar ? '360' : '720', filenameStyle: 'basic' }),
        signal: signal(20000)
    })
    const json = await res.json().catch(() => null)
    if (!json || !json.url || ['error', 'picker'].includes(json.status)) return null
    return {
        url: json.url,
        tipo: 'video',
        titulo: String(json.filename || '').replace(/\.[a-z0-9]+$/i, ''),
        autor: '',
        rebajado: rebajar
    }
}

// peso real del archivo (los CDN de FB a veces rechazan HEAD → devuelve 0 y se envía igual)
async function obtenerPesoMB(url) {
    try {
        const r = await axios.head(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } })
        return (parseInt(r.headers['content-length']) || 0) / 1048576
    } catch { return 0 }
}

const handler = async (m, { args, conn, command, usedPrefix }) => {
    if (!args[0]) {
        return m.reply(`ꕤ Necesito un enlace.\n\n🎧 ᥱȷᥱm⍴ᥣ᥆:\n${usedPrefix}${command} https://www.facebook.com/watch/?v=123456789`)
    }

    const isIg = ['instagram', 'ig'].includes(command)
    let link = args[0]
    await m.react('🔎')

    try {
        link = await resolverUrl(link)

        // cadena de APIs según la plataforma
        // cadena según plataforma: las 2 mejores + cobalt con key como último recurso
        const cadena = isIg ? [apiAlyacoreIG, apiVKR, apiCobalt] : [apiFDL, apiAlyacoreFB, apiCobalt]
        let media = null, apiUsada = null
        for (const api of cadena) {
            try {
                media = await api(link)
                if (media) { apiUsada = api; break }
            } catch { media = null }
        }

        if (!media) {
            await m.react('❌')
            return m.reply('ꕥ No se encontraron archivos en este enlace, es privado o las APIs están caídas. Intenta con la URL completa de facebook.com.')
        }

        if (media.tipo === 'fotos') {
            for (const foto of media.items) {
                await conn.sendFile(m.chat, foto, 'foto.jpg', `ꕤ ${media.titulo || 'Aquí tienes'}`, m)
            }
        } else {
            let peso = await obtenerPesoMB(media.url)
            let caption = media.titulo ? `ꕤ ${media.titulo}${media.autor ? `\n> 👤 ${media.autor}` : ''}` : `ꕤ Aquí tienes`

            if (peso > SIZE_LIMIT_MB && apiUsada) {
                // muy pesado para el chat: se pide la versión liviana (360p con audio)
                // y se envía como video igual, nunca como documento
                try {
                    const alternativa = await apiUsada(link, true)
                    if (alternativa?.url && alternativa.url !== media.url) {
                        const pesoAlt = await obtenerPesoMB(alternativa.url)
                        if (!pesoAlt || pesoAlt < peso) {
                            media = alternativa
                            peso = pesoAlt > 0 ? pesoAlt : peso
                        }
                    }
                } catch { }
            }

            if (media.rebajado) {
                caption = `⚠️ El original pasaba de ${SIZE_LIMIT_MB} MB, se envió en calidad reducida para que pudiera mandarse.\n\n${caption}`
            }

            await conn.sendFile(m.chat, media.url, 'video.mp4', caption, m)
        }

        await m.react('✅')
    } catch (error) {
        console.error('[IGFB]', error)
        await m.react('❌')
        await m.reply(`⚠︎ Error al procesar la descarga:\n${error.message}`)
    }
}

handler.command = ['instagram', 'ig', 'facebook', 'fb']
handler.tags = ['descargas']
handler.help = ['instagram', 'ig', 'facebook', 'fb']
// sin handler.group: ahora funciona también en privado

// helpers exportados para pruebas fuera del bot
export { apiFDL, apiVKR, apiCobalt, obtenerPesoMB, resolverUrl }

export default handler
