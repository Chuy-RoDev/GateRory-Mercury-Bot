// ─────────────────────────────────────────────────────────────
//  MOTOR DEL FLUJO /r34 (busquedas, sesiones por chat, formatos)
//  Flujo pedido:
//   · /r34 <tag>            → búsqueda directa en modo MIXTO (máx 25 de cada)
//   · /r34 <tag> video [N]  → búsqueda directa de VIDEOS (máx 50)
//   · /r34 <tag> imagen|menu→ pasos: resumen → confirmar tag (Si/No)
//                             → Si: menú de formato / No: lista de tags
//   · 0 resultados (directo)→ lista de tags parecidos numerada
//   · Las IMÁGENES solas solo se buscan desde los pasos (menú)
//   · ANTI-IA: todos los resultados se filtran (negado en la query + revisión
//     tag por tag de cada post) — no se manda nada hecho/tocado por IA
//   · EN PRIVADO: el proceso corre completo ANTES de enviar y al final se elige
//     a qué grupo mandar (paso 'grupo' de la sesión; 0 = este chat privado)
// ─────────────────────────────────────────────────────────────
import fetch from 'node-fetch'

const API_KEY = "a4e807dd6d4c9e55768772996946e4074030ec02c49049d291e5edb8808a97b004190660b4b36c3d21699144c823ad93491d066e73682a632a38f9b6c3cf951b"
const USER_ID = "5753302"

// FILTRO ANTI-IA: fuera el contenido hecho o tocado por IA. La negación en la
// query solo recorta volumen (probado en vivo: "pony -ai_generated" seguía
// trayendo posts IA con otros tags como ai_art/ai-created), así que además se
// revisa el tag de CADA post uno por uno. Se compara tag por tag para no dar
// falsos positivos con cosas como "anal_hair" o "air_bubble" (contienen "ai").
const PATRON_TAG_IA = /^(ai$|ai[-_]|aigenerated|novel[-_]?ai|stable[-_]?diffusion|midjourney|dall[-_]?e|artificial|generated)/i

const tieneIA = (post) => {
    const tags = Array.isArray(post?.tags) ? post.tags : String(post?.tags || '').split(/[\s,]+/).filter(Boolean)
    return tags.some(t => PATRON_TAG_IA.test(t))
}

// FIX heredado: la API responde HTTP 200 con cuerpo vacío cuando el tag no existe;
// JSON.parse('') lanzaba. Cuerpo vacío = sin resultados.
const fetchPosts = async (tags, limit = 600) => {
    try {
        const query = `${tags} -ai_generated -novelai -stable_diffusion`
        const url = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&limit=${limit}&tags=${encodeURIComponent(query)}&api_key=${API_KEY}&user_id=${USER_ID}`
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept': 'application/json' },
            signal: AbortSignal.timeout(30000)
        })
        if (!res.ok) return []
        const text = await res.text()
        if (!text || !text.trim()) return []
        const json = JSON.parse(text)
        const posts = Array.isArray(json) ? json : json?.post || json?.data || []
        return posts.filter(p => !tieneIA(p))
    } catch {
        return []
    }
}

// Tags parecidos (autocomplete de Rule34). El endpoint no acepta espacios:
// se normaliza con "_" y se reintenta con la primera palabra.
const suggestTags = async (q) => {
    const query = (q || '').trim().toLowerCase().replace(/\s+/g, '_')
    if (!query) return []
    const intentos = [query]
    const primera = query.split('_')[0]
    if (primera && primera !== query) intentos.push(primera)
    for (const intento of intentos) {
        try {
            const res = await fetch(`https://api.rule34.xxx/autocomplete.php?q=${encodeURIComponent(intento)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                signal: AbortSignal.timeout(30000)
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

// ── límites pedidos por el dueño ──
const CAPS = { video: 50, imagen: 50, mixto: 25 }
const EXT_VIDEO = ['mp4', 'webm', 'mov', 'm4v']
const EXT_IMAGEN = ['jpg', 'jpeg', 'png', 'gif']

const esVideo = (post) => {
    const fileUrl = post?.file_url || post?.sample_url || post?.preview_url
    if (!fileUrl || typeof fileUrl !== 'string') return false
    const cleanUrl = fileUrl.split('?')[0]
    const ext = (post?.file_ext || cleanUrl.split('.').pop() || '').toLowerCase()
    return EXT_VIDEO.includes(ext) || /\.mp4$/i.test(cleanUrl)
}

const esImagen = (post) => {
    const fileUrl = post?.file_url || post?.sample_url || post?.preview_url
    if (!fileUrl || typeof fileUrl !== 'string') return false
    const cleanUrl = fileUrl.split('?')[0]
    const ext = (post?.file_ext || cleanUrl.split('.').pop() || '').toLowerCase()
    return EXT_IMAGEN.includes(ext) || /\.(jpe?g|png|gif)$/i.test(cleanUrl)
}

// parseo de la respuesta de formato: "videos", "imagenes 35", "mixto 10"...
// devuelve null si no es un formato; {error} si se pasa del tope;
// {tipo, cantidad, exceso} cuando es válido (exceso avisa que recortó)
const parseFormato = (texto) => {
    const m = /^(videos?|vid|imagenes|imagen|img|mixto|mix)\s*(\d+)?$/i.exec((texto || '').trim())
    if (!m) return null
    const tipoRaw = m[1].toLowerCase()
    const tipo = /^(videos?|vid)$/.test(tipoRaw) ? 'video' : /^(imagenes|imagen|img)$/.test(tipoRaw) ? 'imagen' : 'mixto'
    const n = m[2] ? parseInt(m[2], 10) : null
    const cap = CAPS[tipo]
    if (n !== null && n > cap) {
        return { tipo, cantidad: cap, exceso: true }
    }
    return { tipo, cantidad: n ?? cap, exceso: false }
}

// busca según el tipo y devuelve medias listas para sendSylphy
const buscar = async (tipo, tag, cantidad) => {
    const barajar = (arr) => arr.map(v => [Math.random(), v]).sort(([a], [b]) => a - b).map(([, v]) => v)
    const media = (post, tipo_) => {
        const fileUrl = post.file_url || post.sample_url || post.preview_url
        return { type: tipo_, data: { url: fileUrl } }
    }
    if (tipo === 'video') {
        const posts = await fetchPosts(`${tag} video`)
        return { medias: barajar(posts.filter(esVideo)).slice(0, cantidad).map(p => media(p, 'video')), imagenes: 0, videos: Math.min(cantidad, posts.filter(esVideo).length) }
    }
    if (tipo === 'imagen') {
        const posts = await fetchPosts(tag)
        const imgs = barajar(posts.filter(esImagen))
        return { medias: imgs.slice(0, cantidad).map(p => media(p, 'image')), imagenes: Math.min(cantidad, imgs.length), videos: 0 }
    }
    // mixto: búsqueda general (imágenes) + búsqueda 'tag video' (vídeos)
    const [generales, deVideo] = await Promise.all([fetchPosts(tag), fetchPosts(`${tag} video`)])
    const imgs = barajar(generales.filter(esImagen)).slice(0, cantidad)
    const vids = barajar(deVideo.filter(esVideo)).slice(0, cantidad)
    const medias = [...imgs.map(p => media(p, 'image')), ...vids.map(p => media(p, 'video'))]
    return { medias, imagenes: imgs.length, videos: vids.length }
}

// envío: sendSylphy para álbumes (2+), sendMessage para single.
// jid opcional: permite mandar a otro destino (el selector de grupos en privado)
const enviar = async (conn, m, medias, caption, jid = m.chat) => {
    if (!medias?.length) throw new Error('sin resultados')
    if (medias.length === 1) {
        const md = medias[0]
        const payload = md.type === 'video'
            ? { video: { url: md.data.url }, caption }
            : { image: { url: md.data.url }, caption }
        return conn.sendMessage(jid, payload, { quoted: m })
    }
    return conn.sendSylphy(jid, medias, { caption, quoted: m, delay: 900 })
}

// ── flujo PRIVADO: selector de grupo destino (solo funciona en privado) ──
// El proceso de /r34 corre entero antes de enviar nada; al final se elige
// a qué grupo van los archivos. En grupos el flujo sigue siendo el de siempre.
const listaGrupos = (conn) => {
    const vistos = new Set()
    const out = []
    for (const c of Object.values(conn?.chats || {})) {
        if (!c?.id?.endsWith('@g.us') || vistos.has(c.id)) continue
        vistos.add(c.id)
        out.push({ id: c.id, nombre: c.subject || c.id.split('@')[0] })
    }
    return out
}

const textoGrupos = (grupos) => {
    let menu = `❀ *0.* Aquí (este chat)\n`
    grupos.forEach((g, i) => { menu += `❀ *${i + 1}.* ${g.nombre}\n` })
    menu += `\n> Puedes elegir varios: *1,3* o *1 3*\n> Tienes *5 minutos* para responder\n> (*cancelar* para salir)`
    return menu
}

// todo el proceso ya corre (búsqueda, formato, confirmación) → en privado se
// pregunta a qué grupo enviar; si el bot no está en ningún grupo, va aquí mismo
const pedirGrupo = async (conn, m, medias, caption) => {
    if (!medias?.length) throw new Error('sin resultados')
    const grupos = listaGrupos(conn)
    if (!grupos.length) return enviar(conn, m, medias, caption)
    setSesion(m.chat, { paso: 'grupo', medias, caption, grupos })
    return m.reply(`ꕤ Todo listo: *${medias.length} archivo(s)* preparados... *Pervertido.*\n\n¿Y a qué grupo los envío?\n\n${textoGrupos(grupos)}`)
}

// ── sesiones por chat (pasos interactivos), TTL 5 minutos ──
const SESIONES = new Map()
const TTL = 5 * 60 * 1000

const getSesion = (chat) => {
    const s = SESIONES.get(chat)
    if (!s) return null
    if (Date.now() > s.expira) {
        SESIONES.delete(chat)
        return null
    }
    return s
}
const setSesion = (chat, data) => {
    SESIONES.set(chat, { ...data, expira: Date.now() + TTL })
}
const delSesion = (chat) => SESIONES.delete(chat)

// ── textos de los pasos ──
const resumenTag = (tag, count) =>
    `ꕤ Busqué *${tag}* en Rule34...\n» Encontré *${count} posts*.`

const textoConfirm = (tag, count) =>
    `ꕤ Este tag ya existe (*${count} posts*). ¿Es correcto?\n\n> Responde *Si* o *No*\n> (*cancelar* para salir)`

const textoFormato = (tag) =>
    `ꕤ ¿Qué quieres ver de *${tag}*?\n\n❀ *videos* — hasta *50*\n❀ *imagenes* — hasta *50*\n❀ *mixto* — hasta *25* de cada una\n\n> También con cantidad personalizada: *videos 20*, *imagenes 35*, *mixto 10*\n> (no se puede pasar de los topes)\n> Responde *cancelar* para salir.`

const textoTags = (tag, sugerencias, nota = '') => {
    let menu = nota || `ꕤ No hay resultados para *${tag}*.\n\nPero encontré estos tags en *Rule34*:\n\n`
    sugerencias.forEach((s, i) => {
        menu += `❀ *${i + 1}.* ${s.tag}${s.count ? ` _(${s.count.toLocaleString('es')} posts)_` : ''}\n`
    })
    menu += `\n> Responde con el *número* del tag que quieres\n> (*cancelar* para salir)`
    return menu
}

export {
    fetchPosts, suggestTags, esVideo, esImagen, tieneIA,
    parseFormato, buscar, enviar,
    getSesion, setSesion, delSesion,
    listaGrupos, textoGrupos, pedirGrupo,
    resumenTag, textoConfirm, textoFormato, textoTags,
    CAPS
}
