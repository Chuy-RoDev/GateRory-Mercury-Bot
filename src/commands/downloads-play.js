import fetch from 'node-fetch'
import yts from 'yt-search'
import axios from 'axios'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import path from 'path'

// ─────────────────────────────────────────────────────────────
// DESCARGA DE YOUTUBE (reemplaza savenow/kazuma, muertos)
//  1. InnerTube (API interna de YouTube, cliente ANDROID_VR) — sin terceros,
//     devuelve el mp4 progressive 360p con audio (itag 18). El mp3 se extrae
//     con ffmpeg de ese mismo mp4. Los enlaces googlevideo van ligados a la IP
//     que los pidió, por eso se descarga en buffer desde el propio servidor.
//  2. Cobalt (solo si se configura global.COBALT_API_KEY, opcional)
// ─────────────────────────────────────────────────────────────

const VRC = {
    client: { clientName: 'ANDROID_VR', clientVersion: '1.60.19', androidSdkVersion: 32, hl: 'es', osName: 'Android', osVersion: '12' },
    ua: 'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12; eureka-user Build/SQ3A.220605.009.A1) gzip'
}

async function innertube(videoId) {
    const pedir = async () => {
        const r = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': VRC.ua,
                'X-Youtube-Client-Name': '3',
                'X-Youtube-Client-Version': '1.60.19'
            },
            body: JSON.stringify({ context: { client: VRC.client }, videoId, contentCheckOk: true, racyCheckOk: true }),
            signal: AbortSignal.timeout(25000)
        })
        return await r.json().catch(() => null)
    }

    let d = await pedir()
    // YouTube a veces marca la IP como bot en ráfagas de peticiones: un reintento
    // tras una pequeña espera suele resolverlo
    if (!d || d?.playabilityStatus?.status !== 'OK') {
        await new Promise(r => setTimeout(r, 2500))
        d = await pedir()
    }
    if (!d || d?.playabilityStatus?.status !== 'OK') {
        throw new Error(d?.playabilityStatus?.reason || 'YouTube no dejó ver ese video.')
    }
    const muxed = (d.streamingData?.formats || []).filter(f => f.url).sort((a, b) => (b.height || 0) - (a.height || 0))[0]
    if (!muxed?.url) throw new Error('YouTube no devolvió el formato descargable.')
    return { url: muxed.url, titulo: d.videoDetails?.title || '', bytes: muxed.contentLength || 0 }
}

async function cobalt(url) {
    if (!global.COBALT_API_KEY) return null
    const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json', Authorization: `Api-Key ${global.COBALT_API_KEY}` }
    const api = global.COBALT_API_URL || 'https://api.cobalt.tools/'
    const r = await fetch(api, {
        method: 'POST', headers,
        body: JSON.stringify({ url, videoQuality: '360', filenameStyle: 'basic' }),
        signal: AbortSignal.timeout(25000)
    })
    const j = await r.json().catch(() => null)
    if (!j?.url || ['error', 'picker'].includes(j?.status)) return null
    return { url: j.url, titulo: String(j.filename || '').replace(/\.[a-z0-9]+$/i, '') }
}

function bufferAMp3(buffer, titulo) {
    const tmp = path.join(process.cwd(), 'tmp')
    if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true })
    const entrada = path.join(tmp, `yt_${Date.now()}.mp4`)
    const salida = path.join(tmp, `yt_${Date.now()}.mp3`)
    fs.writeFileSync(entrada, buffer)
    return new Promise((resolve, reject) => {
        ffmpeg(entrada).audioCodec('libmp3lame').audioBitrate(128).toFormat('mp3')
            .on('end', () => {
                const mp3 = fs.readFileSync(salida)
                for (const f of [entrada, salida]) { try { fs.unlinkSync(f) } catch { } }
                resolve(mp3)
            })
            .on('error', (e) => {
                for (const f of [entrada, salida]) { try { fs.unlinkSync(f) } catch { } }
                reject(new Error('No pude convertir el audio: ' + e.message))
            })
            .save(salida)
    })
}

const handler = async (m, { conn, text, usedPrefix, command }) => {
    if (!text) return m.reply(
        `╭─「 🎵 𝗬𝗼𝘂𝗧𝘂𝗯𝗲 」\n` +
        `│\n` +
        `│ ✦ Uso: *${usedPrefix + command} <nombre o link>*\n` +
        `│ ✦ Ejemplo: *${usedPrefix + command} Menea tu chapa osiosi*\n` +
        `│\n` +
        `│ _Ingresa el nombre o link del video._\n` +
        `╰─────────────────`
    )

    const isAudio = ['play', 'ytmp3', 'playaudio', 'ytaudio', 'mp3'].includes(command)
    await m.react('⏳')

    try {
        const search = await yts(text)
        const v = search.videos[0]
        if (!v) throw 'No encontré resultados.'

        const mins = v.seconds / 60
        if (mins > 45) return m.reply(
            `╭─「 ⚠️ 𝗟í𝗺𝗶𝘁𝗲 」\n` +
            `│ ꕤ El video es demasiado largo.\n` +
            `│ ✦ Límite: *45 minutos*\n` +
            `│ ✦ Duración: *${v.timestamp}*\n` +
            `╰─────────────────`
        )

        await conn.sendMessage(m.chat, {
            image: { url: v.thumbnail },
            caption:
                `╭─「 ⬇️ 𝗗𝗲𝘀𝗰𝗮𝗿𝗴𝗮𝗻𝗱𝗼 ${isAudio ? 'Audio 🎵' : 'Video 🎬'} 」\n` +
                `│\n` +
                `│ ✦ *${v.title}*\n` +
                `│ ✦ Duración: _${v.timestamp}_\n` +
                `│ ✦ Canal: _${v.author.name}_\n` +
                `│\n` +
                `│ _Procesando, espera un momento..._\n` +
                `╰─────────────────`
        }, { quoted: m })

        // cadena: InnerTube → Cobalt (si hay key)
        let fuente = null, titulo = v.title
        try {
            fuente = await innertube(v.videoId)
            titulo = fuente.titulo || titulo
        } catch (e1) {
            fuente = await cobalt(v.url)
            if (!fuente) throw e1
            titulo = fuente.titulo || titulo
        }

        const r = await axios.get(fuente.url, { responseType: 'arraybuffer', timeout: 300000, maxContentLength: Infinity, headers: { 'User-Agent': VRC.ua } })
        const buffer = Buffer.from(r.data)

        if (isAudio) {
            const mp3 = await bufferAMp3(buffer, titulo)
            await conn.sendMessage(m.chat, {
                audio: mp3,
                mimetype: 'audio/mpeg',
                fileName: `${titulo.slice(0, 50)}.mp3`
            }, { quoted: m })
        } else {
            await conn.sendMessage(m.chat, {
                video: buffer,
                caption:
                    `╭─「 🎬 𝗩𝗶𝗱𝗲𝗼 」\n` +
                    `│ ✦ *${titulo}*\n` +
                    `│ _Descarga completada._ ✅\n` +
                    `╰─────────────────`,
                mimetype: 'video/mp4',
                fileName: 'video.mp4'
            }, { quoted: m })
        }

        await m.react('✔️')

    } catch (e) {
        await m.react('❌')
        console.error(e)
        m.reply(
            `╭─「 ⚠︎ 𝗘𝗿𝗿𝗼𝗿 」\n` +
            `│ _${typeof e === 'string' ? e : e.message}_\n` +
            `╰─────────────────`
        )
    }
}

handler.help = ['play <nombre o link>', 'ytmp4 <nombre o link>']
handler.tags = ['descargas']
handler.command = ['play', 'play2', 'ytmp3', 'ytmp4', 'playaudio', 'ytaudio', 'mp3', 'mp4']
export default handler
