import fetch from 'node-fetch'
import yts from 'yt-search'

const KZM_KEY = 'kzm-AkpQk-lKhaizmu'
const KZM_URL = 'rest.kazuma.giize.com'

const savenow = {
    key: 'dfcb6d76f2f6a9894gjkege8a4ab232222',
    agent: 'Mozilla/5.0 (Android 13; Mobile; rv:146.0) Gecko/146.0 Firefox/146.0',
    referer: 'https://y2down.cc/enSB/',
    ytdl: async function(url, format) {
        try {
            const init = await fetch(`https://p.savenow.to/ajax/download.php?copyright=0&format=${format}&url=${encodeURIComponent(url)}&api=${this.key}`, {
                headers: { 'User-Agent': this.agent, 'Referer': this.referer }
            })
            const data = await init.json()
            if (!data.success) return { error: data.message || 'Error' }
            const progressUrl = `https://p.savenow.to/api/progress?id=${data.id}`
            let attempts = 0
            while (attempts < 15) {
                await new Promise(r => setTimeout(r, 2000))
                attempts++
                const res = await fetch(progressUrl, { headers: { 'User-Agent': this.agent, 'Referer': this.referer } })
                const status = await res.json()
                if (status.progress === 1000) return { title: data.title, link: status.download_url }
            }
            return { error: 'Tiempo de espera agotado.' }
        } catch (e) { return { error: e.message } }
    }
}

// Función para competir ambas APIs al mismo tiempo (gana la que responda primero)
const raceDownload = async (url, formatType) => {
    const kzmPromise = (async () => {
        const endpoint = formatType === 'mp3' ? 'ytaudio' : 'ytmp4'
        const res = await fetch(`https://${KZM_URL}/api/download/${endpoint}?url=${encodeURIComponent(url)}&apiKey=${KZM_KEY}`)
        const json = await res.json()
        if (json.status && json.result?.download_url) {
            return { link: json.result.download_url, title: json.result.title }
        }
        throw new Error('KZM falló')
    })()

    const savenowPromise = (async () => {
        if (formatType === 'mp3') {
            const dl = await savenow.ytdl(url, 'mp3')
            if (!dl.error && dl.link) return { link: dl.link, title: dl.title }
        } else {
            const resoluciones = ['480', '360', '720', 'mp4']
            for (const res of resoluciones) {
                const dl = await savenow.ytdl(url, res)
                if (!dl.error && dl.link) return { link: dl.link, title: dl.title }
            }
        }
        throw new Error('SaveNow falló')
    })()

    try {
        return await Promise.any([kzmPromise, savenowPromise])
    } catch {
        throw new Error('Todas las APIs de descarga fallaron.')
    }
}

const handler = async (m, { conn, text, usedPrefix, command }) => {
    if (!text) return m.reply(
        `╭─「 🎵 𝗬𝗼𝘂𝗧𝘂𝗯𝗲 」\n` +
        `│\n` +
        `│ ✦ Uso: *${usedPrefix + command} <nombre o link>*\n` +
        `│ ✦ Ejemplo: *${usedPrefix + command} Canserbero*\n` +
        `│\n` +
        `│ _Ingresa el nombre o link del video._\n` +
        `╰─────────────────`
    )

    const isAudio = ['play', 'ytmp3', 'playaudio'].includes(command)
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

        const formatType = isAudio ? 'mp3' : 'mp4'
        const result = await raceDownload(v.url, formatType)
        const downloadUrl = result.link
        const finalTitle = result.title || v.title

        if (isAudio) {
            await conn.sendMessage(m.chat, {
                audio: { url: downloadUrl },
                mimetype: 'audio/mpeg',
                fileName: `${finalTitle}.mp3`
            }, { quoted: m })
        } else {
            await conn.sendMessage(m.chat, {
                video: { url: downloadUrl },
                caption:
                    `╭─「 🎬 𝗩𝗶𝗱𝗲𝗼 」\n` +
                    `│ ✦ *${finalTitle}*\n` +
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
handler.command = ['play', 'play2', 'ytmp3', 'ytmp4', 'playaudio']
export default handler