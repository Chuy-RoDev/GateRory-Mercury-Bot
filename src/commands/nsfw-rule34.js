import fetch from 'node-fetch'

const API_KEY = "a4e807dd6d4c9e55768772996946e4074030ec02c49049d291e5edb8808a97b004190660b4b36c3d21699144c823ad93491d066e73682a632a38f9b6c3cf951b"
const USER_ID = "5753302"

// Función auxiliar para consultar la API
// FIX: la API responde HTTP 200 pero con CUERPO VACÍO cuando el tag no existe;
// JSON.parse('') lanzaba y el bot mostraba "Cero archivos" sin pista alguna.
// Ahora el cuerpo vacío se maneja explícitamente como "sin resultados".
const fetchPosts = async (tags) => {
    try {
        const url = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&limit=600&tags=${encodeURIComponent(tags)}&api_key=${API_KEY}&user_id=${USER_ID}`
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept': 'application/json' }
        })
        if (!res.ok) return []
        const text = await res.text()
        if (!text || !text.trim()) return []
        const json = JSON.parse(text)
        return Array.isArray(json) ? json : json?.post || json?.data || []
    } catch {
        return []
    }
}

// RESTAURADO: menú de tags adaptado. Cuando un tag no tiene resultados, el bot
// muestra tags parecidos con su número de posts (autocomplete de Rule34).
// El endpoint no acepta espacios: se normaliza con "_" y si nada coincide se
// reintenta con la primera palabra (ej: "mika misono" → "mika_misono" → "mika").
const suggestTags = async (q) => {
    const query = (q || '').trim().toLowerCase().replace(/\s+/g, '_')
    if (!query) return []
    const intentos = [query]
    const primera = query.split('_')[0]
    if (primera && primera !== query) intentos.push(primera)
    for (const intento of intentos) {
        try {
            const res = await fetch(`https://api.rule34.xxx/autocomplete.php?q=${encodeURIComponent(intento)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            })
            if (!res.ok) continue
            const text = await res.text()
            if (!text || !text.trim()) continue
            const json = JSON.parse(text)
            if (Array.isArray(json) && json.length) {
                return json.slice(0, 10).map(x => {
                    const match = /\((\d+)\)\s*$/.exec(x.label || '')
                    return {
                        tag: x.value || (x.label || '').replace(/\s*\(\d+\)\s*$/, ''),
                        count: match ? parseInt(match[1], 10) : 0
                    }
                }).filter(x => x.tag)
            }
        } catch { /* intenta el siguiente */ }
    }
    return []
}

const handler = async (m, { conn, args, usedPrefix, command }) => {
    // 1. Verificación de NSFW
    const chat = global.db?.data?.chats?.[m.chat]
    if (m.isGroup && !chat?.nsfw) {
        return m.reply(`El NSFW está deshabilitado... ¿Realmente quieres hacer esto?..\n> Un administrador debe activarlo con: *${usedPrefix}nsfw on*`)
    }

    // 2. Validación de Argumentos
    if (!args[0]) {
        return m.reply(`Esto... ¿Realmente quieres que haga esto?... *Pervertido.*\n\n> *Ejemplo:*\n*${usedPrefix + command} mika_misono*\n\n> Tip: los tags van con _ en vez de espacios. Si un tag no existe, te muestro los parecidos.`)
    }

    // 3. Detección de Modo Solo Video y Limpieza de Tags
    const isVideoCmd = ['r34vid', 'rule34vid', 'rulevid'].includes(command)
    const rawInput = args.join(' ')
    let onlyVideo = isVideoCmd || /(\bvideo\b|\bvid\b|\bmp4\b|_video)/i.test(rawInput)

    let cleanTag = rawInput
    if (!/_video/i.test(rawInput)) {
        const filteredArgs = args.filter(a => !/^(video|vid|mp4)$/i.test(a))
        cleanTag = filteredArgs.length ? filteredArgs.join(' ') : rawInput
    }

    try {
        await m.react('⏳')

        const images = []
        const videos = []

        if (onlyVideo) {
            // SI PIDIÓ VIDEO: Hace una única búsqueda agregando la etiqueta 'video' a R34
            const queryTag = /_video/i.test(rawInput) ? cleanTag : `${cleanTag} video`
            const posts = await fetchPosts(queryTag)
            const shuffled = posts.sort(() => Math.random() - 0.5)

            for (const post of shuffled) {
                const fileUrl = post?.file_url || post?.sample_url || post?.preview_url
                if (!fileUrl || typeof fileUrl !== 'string') continue
                const cleanUrl = fileUrl.split('?')[0]
                const ext = (post?.file_ext || cleanUrl.split('.').pop() || '').toLowerCase()

                if (['mp4', 'webm', 'mov', 'm4v'].includes(ext) || /\.mp4$/i.test(cleanUrl)) {
                    videos.push({
                        type: 'video',
                        video: { url: fileUrl },
                        data: { url: fileUrl }
                    })
                }
                if (videos.length === 5) break
            }
        } else {
            // BÚSQUEDA MIXTA: Realiza 2 búsquedas simultáneas (Imágenes generales + Vídeos dedicados)
            const [generalPosts, videoPosts] = await Promise.all([
                fetchPosts(cleanTag),
                fetchPosts(`${cleanTag} video`)
            ])

            // Capturar 5 imágenes de la búsqueda general
            const shuffledGeneral = generalPosts.sort(() => Math.random() - 0.5)
            for (const post of shuffledGeneral) {
                const fileUrl = post?.file_url || post?.sample_url || post?.preview_url
                if (!fileUrl || typeof fileUrl !== 'string') continue
                const cleanUrl = fileUrl.split('?')[0]
                const ext = (post?.file_ext || cleanUrl.split('.').pop() || '').toLowerCase()

                if (['jpg', 'jpeg', 'png', 'gif'].includes(ext) || /\.(jpe?g|png|gif)$/i.test(cleanUrl)) {
                    images.push({
                        type: 'image',
                        image: { url: fileUrl },
                        data: { url: fileUrl }
                    })
                }
                if (images.length === 5) break
            }

            // Capturar 5 vídeos de la búsqueda de vídeos
            const shuffledVideos = videoPosts.sort(() => Math.random() - 0.5)
            for (const post of shuffledVideos) {
                const fileUrl = post?.file_url || post?.sample_url || post?.preview_url
                if (!fileUrl || typeof fileUrl !== 'string') continue
                const cleanUrl = fileUrl.split('?')[0]
                const ext = (post?.file_ext || cleanUrl.split('.').pop() || '').toLowerCase()

                if (['mp4', 'webm', 'mov', 'm4v'].includes(ext) || /\.mp4$/i.test(cleanUrl)) {
                    videos.push({
                        type: 'video',
                        video: { url: fileUrl },
                        data: { url: fileUrl }
                    })
                }
                if (videos.length === 5) break
            }
        }

        const medias = onlyVideo ? videos : [...images, ...videos]

        if (!medias.length) {
            await m.react('❌')
            // RESTAURADO: menú de tags parecidos en vez del "Cero archivos" seco.
            // Así el usuario descubre el tag correcto (suele faltar el "_").
            const sugerencias = await suggestTags(cleanTag)
            if (sugerencias.length) {
                let menu = `ꕤ No hay resultados para *${cleanTag}*.\n\nPero encontré estos tags en *Rule34*:\n\n`
                sugerencias.forEach((s, i) => {
                    menu += `❀ *${i + 1}.* ${s.tag}${s.count ? ` _(${s.count.toLocaleString('es')} posts)_` : ''}\n`
                })
                menu += `\n> Copia el tag y úsalo así: *${usedPrefix || ''}${command} ${sugerencias[0].tag}*`
                return m.reply(menu)
            }
            return m.reply(`*Cero ${onlyVideo ? 'vídeos' : 'archivos válidos'} encontrados.* 🦈\nNo hay resultados para "${cleanTag}".\n\n> Tip: los tags usan _ en vez de espacios (ej: *mikasa_ackerman*) y suelen estar en inglés.`)
        }

        const caption = onlyVideo
            ? `Encontré *${videos.length} vídeo(s)* para: *${cleanTag}*... *Pervertido.*`
            : `Encontré *${images.length} imágenes* y *${videos.length} vídeos* para: *${cleanTag}*... *Pervertido.*`

        await conn.sendSylphy(m.chat, medias, { caption, quoted: m })
        await m.react('✔️')

    } catch (e) {
        console.error('Error Rule34:', e)
        await m.react('❌')
        await m.reply(`*Ugh, algo salió mal.* 🛠️\nLa base de datos no responde. Arréglatelas solo.`)
    }
}

handler.help = ['rule34 <tags>']
handler.tags = ['nsfw']
handler.command = ['r34', 'rule34', 'r34vid', 'rule34vid', 'rule', 'rulevid']

export default handler
export { fetchPosts, suggestTags }
