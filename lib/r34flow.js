// ─────────────────────────────────────────────────────────────
//  MOTOR /r34 — REHECHO DESDE 0 (v2, pedido del dueño)
//  La idea del dueño: /r34 <tag> pregunta QUÉ QUIERES VER (videos/imagenes/
//  mixto), corre TODO el proceso y al final (en privado) eliges a qué grupo
//  enviarlo. 0 resultados → lista de tags parecidos. ANTI-IA siempre.
//
//  Las respuestas del flujo tienen DOS rutas que comparten ESTE motor
//  (manejarRespuesta):
//    · RUTA 1 — número/respuesta suelta → _r34flow.js (before)
//    · RUTA 2 — /r34 <respuesta>        → nsfw-rule34.js (pasa por el mismo
//      camino que el comando, funciona aunque el before no se ejecute)
// ─────────────────────────────────────────────────────────────
import fetch from 'node-fetch'

const API_KEY = "a4e807dd6d4c9e55768772996946e4074030ec02c49049d291e5edb8808a97b004190660b4b36c3d21699144c823ad93491d066e73682a632a38f9b6c3cf951b"
const USER_ID = "5753302"

// FILTRO ANTI-IA: funciona como el toggle "Filter AI posts" de la web, pero
// DENTRO del bot y SIEMPRE activo — la query ya NO lleva tags negados
// (-ai_generated etc.): se busca limpio y cada post se revisa tag por tag.
// El patrón es por PREFIJO para no dar falsos positivos ("red_hair" contiene
// "ai" pero no empieza con él). Calibrado en vivo: el patrón viejo dejaba
// pasar variantes como "aianoart" (19 de 250 posts de un personaje).
const PATRON_TAG_IA = /^(ai$|ai[-_]|aiart|aigenerat|aianoart|generat|novelai|novel[-_]ai|stable[-_]diffusion|midjourney|dall[-_]?e|artificial|open[-_]?ai|comfyui|niji($|[-_.])|tensor[-_]?art|pixai|bing[-_]?ai|pony[-_]?diffusion)/i

const tieneIA = (post) => {
    const tags = Array.isArray(post?.tags) ? post.tags : String(post?.tags || '').split(/[\s,]+/).filter(Boolean)
    return tags.some(t => PATRON_TAG_IA.test(t))
}

// La API responde HTTP 200 con cuerpo vacío cuando el tag no existe:
// cuerpo vacío = sin resultados (no explotar el JSON.parse).
// QUERY LIMPIA (pedido del dueño): sin tags negados — el anti-IA es el
// filtro local tieneIA() que corre sobre cada resultado.
// PAGINACIÓN: por defecto solo 1 página (rápido, para resolver/verificar un
// tag). La búsqueda real pide más páginas con { paginas, objetivo } porque el
// PRIMER bloque de 600 de un tag grande trae pocos posts sin IA (el flood de
// IA es lo más nuevo): en mavuika la página 0 daba 99 sin IA — el origen del
// conteo pobre que reportó el dueño — y la biblioteca sigue (página 1: +84,
// página 2: +158). Se corta al agotar el tag o al llegar al objetivo.
const PAGINA = 600
const fetchPosts = async (tags, opts = {}) => {
    const { paginas = 1, objetivo = 300 } = opts
    const vistos = new Set()
    const out = []
    for (let pid = 0; pid < paginas; pid++) {
        try {
            const url = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&limit=${PAGINA}&pid=${pid}&tags=${encodeURIComponent(tags)}&api_key=${API_KEY}&user_id=${USER_ID}`
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept': 'application/json' },
                signal: AbortSignal.timeout(30000)
            })
            if (!res.ok) break
            const text = await res.text()
            if (!text || !text.trim()) break
            const json = JSON.parse(text)
            const posts = Array.isArray(json) ? json : json?.post || json?.data || []
            for (const p of posts) {
                if (vistos.has(p.id)) continue
                vistos.add(p.id)
                if (!tieneIA(p)) out.push(p)
            }
            if (posts.length < PAGINA) break   // el tag se agotó
            if (out.length >= objetivo) break  // ya hay suficiente sin IA
        } catch { break }
    }
    return out
}

// AUTORESOLVE: convierte lo que escribió el usuario en el tag REAL de Rule34.
// "mavuika" a secas tiene ~50 posts y TODOS son IA → 0 resultados útiles, y el
// personaje real vive en "mavuika_(genshin_impact)" (5880 posts). Primero se
// prueba el tag tal cual (directo: true — no hay nada que decidir); si no da
// nada, se pregunta al autocomplete y se prueban sus mejores candidatos
// (ordenados por nº de posts) hasta que uno tenga resultados sin IA.
// Devuelve { tag, posts, directo, candidatos }: con directo=false el comando
// muestra el MENÚ DE TAGS CON CONTEOS para que el dueño elija (el #1 es el
// que más tiene). null si nada tiene resultados.
const resolverTag = async (entrada) => {
    const limpia = (entrada || '').trim().toLowerCase().replace(/\s+/g, '_')
    if (!limpia) return null
    const directos = await fetchPosts(limpia)
    if (directos.length) return { tag: limpia, posts: directos, directo: true, candidatos: [] }
    const candidatos = await suggestTags(limpia)
    const ordenados = [...candidatos].sort((a, b) => (b.count || 0) - (a.count || 0))
    const preferidos = ordenados.filter(c => c.tag.startsWith(limpia))
    const probados = new Set([limpia])
    for (const c of [...preferidos, ...ordenados]) {
        if (probados.has(c.tag)) continue
        probados.add(c.tag)
        if (probados.size > 4) break
        const posts = await fetchPosts(c.tag)
        if (posts.length) return { tag: c.tag, posts, directo: false, candidatos: ordenados }
    }
    return null
}

// Autocomplete de Rule34 para "tags parecidos". El endpoint devuelve basura:
// valores con "\r\n" LITERALES (texto, no saltos), tags que no existen y
// duplicados → se corta en la primera línea, se valida, se deduplica y se
// excluyen tags de IA (elegirlos solo lleva a un menú vacío).
const suggestTags = async (q) => {
    const query = (q || '').trim().toLowerCase().replace(/\s+/g, '_')
    if (!query) return []
    const intentos = [query]
    const primera = query.split('_')[0]
    if (primera && primera !== query) intentos.push(primera)
    const vistos = new Set()
    const out = []
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
            if (!Array.isArray(json) || !json.length) continue
            for (const x of json) {
                const match = /\((\d+)\)\s*$/.exec(x.label || '')
                const count = match ? parseInt(match[1], 10) : 0
                const tag = String(x.value || x.label || '').split(/\\r|\\n|\r|\n/)[0].trim()
                if (!tag || /\s/.test(tag) || /\\/.test(tag) || tag.length > 64) continue
                if (PATRON_TAG_IA.test(tag)) continue
                if (vistos.has(tag)) continue
                vistos.add(tag)
                out.push({ tag, count })
                if (out.length >= 10) break
            }
            if (out.length) return out
        } catch { /* intenta el siguiente intento */ }
    }
    return out
}

// ── límites del dueño ──
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

// ── regla del dueño: NADA de videos de menos de 10 segundos ──
// El dapi NO devuelve duration (ni file_ext), así que se lee del propio
// archivo: petición por rango (256KB al inicio; si el moov no está ahí,
// 256KB al final) y parseo del átomo mvhd. Probado en vivo: 40/40 videos
// parseados, ~0.15s por video. Duración desconocida (webm, servidor que
// ignora rangos...) → el video SE QUEDA, no se pierde contenido.
const MIN_SEGUNDOS_VIDEO = 10

const duracionMP4 = async (url) => {
    const leer = async (rango) => {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Range: rango }, signal: AbortSignal.timeout(15000) })
        if (res.status !== 206) { try { res.body?.destroy?.() } catch {} return null }
        return Buffer.from(await res.arrayBuffer())
    }
    const parsea = (buf) => {
        const idx = buf.indexOf('mvhd', 0, 'ascii')
        if (idx < 0 || idx + 40 > buf.length) return null
        const version = buf[idx + 4]
        if (version === 1) {
            const ts = buf.readUInt32BE(idx + 24), dur = Number(buf.readBigUInt64BE(idx + 28))
            return ts > 0 ? dur / ts : null
        }
        const ts = buf.readUInt32BE(idx + 16), dur = buf.readUInt32BE(idx + 20)
        return ts > 0 ? dur / ts : null
    }
    const valida = (s) => (s && s > 0.3 && s < 21600) ? s : null
    try {
        const front = await leer('bytes=0-262143')
        if (front) { const d = valida(parsea(front)); if (d) return d }
        const tail = await leer('bytes=-262144')
        if (tail) { const d = valida(parsea(tail)); if (d) return d }
        return null
    } catch { return null }
}

const duracionDe = (post) => {
    const url = post?.file_url || post?.sample_url || ''
    return /\.(mp4|m4v|mov)(\?|$)/i.test(String(url)) ? duracionMP4(url) : Promise.resolve(null)
}

const barajar = (arr) => arr.map(v => [Math.random(), v]).sort(([a], [b]) => a - b).map(([, v]) => v)

// Baraja el pool de videos y comprueba duraciones en lotes hasta llenar la
// cantidad pedida: los <10s se descartan (regla del dueño) y los de duración
// desconocida se quedan. Devuelve los posts listos para enviar.
const videosFinales = async (pool, cantidad) => {
    const barajados = barajar(pool)
    const out = []
    const LOTE = 6
    for (let i = 0; i < barajados.length && out.length < cantidad; i += LOTE) {
        const lote = barajados.slice(i, i + LOTE)
        const conDur = await Promise.all(lote.map(async (p) => ({ p, d: await duracionDe(p) })))
        for (const { p, d } of conDur) {
            if (out.length >= cantidad) break
            if (d !== null && d < MIN_SEGUNDOS_VIDEO) continue
            out.push(p)
        }
    }
    return out
}

// Respuesta de formato: acepta NÚMEROS del menú (1/2/3, cuenta por defecto) y
// palabras con cantidad opcional ("videos", "imagenes 35", "mix 10"...)
const parseFormato = (texto) => {
    const t = (texto || '').trim().toLowerCase()
    if (t === '1') return { tipo: 'video', cantidad: CAPS.video, exceso: false }
    if (t === '2') return { tipo: 'imagen', cantidad: CAPS.imagen, exceso: false }
    if (t === '3') return { tipo: 'mixto', cantidad: CAPS.mixto, exceso: false }
    const m = /^(videos?|vid|imagenes|imagen|img|mixto|mix)\s*(\d+)?$/i.exec(t)
    if (!m) return null
    const tipoRaw = m[1].toLowerCase()
    const tipo = /^(videos?|vid)$/.test(tipoRaw) ? 'video' : /^(imagenes|imagen|img)$/.test(tipoRaw) ? 'imagen' : 'mixto'
    const n = m[2] ? parseInt(m[2], 10) : null
    const cap = CAPS[tipo]
    if (n !== null && n > cap) return { tipo, cantidad: cap, exceso: true }
    return { tipo, cantidad: n ?? cap, exceso: false }
}

// Busca según el tipo y devuelve medias listas para sendSylphy (barajadas).
// PAGINACIÓN PROFUNDA (3 páginas / objetivo 300 sin IA): con 1 página el pool
// se quedaba en la ventana más nueva del tag (99 de mavuika) y faltaba TODO el
// contenido viejo. En VIDEOS se aplica además la regla <10s (videosFinales).
const buscar = async (tipo, tag, cantidad) => {
    const media = (post, t) => ({ type: t, data: { url: post.file_url || post.sample_url || post.preview_url } })
    if (tipo === 'video') {
        const posts = await fetchPosts(`${tag} video`, { paginas: 3, objetivo: 300 })
        const vids = await videosFinales(posts.filter(esVideo), cantidad)
        return { medias: vids.map(p => media(p, 'video')), imagenes: 0, videos: vids.length }
    }
    if (tipo === 'imagen') {
        const posts = await fetchPosts(tag, { paginas: 3, objetivo: 300 })
        const imgs = barajar(posts.filter(esImagen)).slice(0, cantidad)
        return { medias: imgs.map(p => media(p, 'image')), imagenes: imgs.length, videos: 0 }
    }
    const [generales, deVideo] = await Promise.all([
        fetchPosts(tag, { paginas: 3, objetivo: 300 }),
        fetchPosts(`${tag} video`, { paginas: 3, objetivo: 300 })
    ])
    const imgs = barajar(generales.filter(esImagen)).slice(0, cantidad)
    const vids = await videosFinales(deVideo.filter(esVideo), cantidad)
    const medias = [...imgs.map(p => media(p, 'image')), ...vids.map(p => media(p, 'video'))]
    return { medias, imagenes: imgs.length, videos: vids.length }
}

// Envío: sendSylphy para álbumes (2+), sendMessage para 1. jid opcional para
// mandar a otro destino (el selector de grupos en privado).
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

// ── selector de grupo destino (SOLO privado) ──
// Grupos a los que el bot puede enviar. Primero lo que ya está en memoria
// (conn.chats, sin red); si no hay NADA — en producción conn.chats suele venir
// vacío y por eso el selector de grupo nunca aparecía en privado — se le
// pregunta a Baileys con groupFetchAllParticipating (igual que owner-grupos.js).
const listaGrupos = async (conn) => {
    const vistos = new Set()
    const out = []
    const empuja = (id, subject) => {
        if (!id?.endsWith('@g.us') || vistos.has(id)) return
        vistos.add(id)
        out.push({ id, nombre: subject || id.split('@')[0] })
    }
    for (const c of Object.values(conn?.chats || {})) empuja(c?.id, c?.subject)
    if (!out.length && typeof conn?.groupFetchAllParticipating === 'function') {
        try {
            const todos = await conn.groupFetchAllParticipating()
            for (const [id, meta] of Object.entries(todos || {})) empuja(meta?.id || id, meta?.subject)
        } catch { /* sin grupos conocidos → se manda al chat actual */ }
    }
    return out
}

const textoGrupos = (grupos) => {
    let menu = `❀ *0.* Aquí (este chat)\n`
    grupos.forEach((g, i) => { menu += `❀ *${i + 1}.* ${g.nombre}\n` })
    menu += `\n> Puedes elegir varios: *1,3* o *1 3*\n> Tienes *10 minutos* para responder\n> (*cancelar* para salir)`
    return menu
}

// El proceso corrió completo → en privado se pregunta a qué grupo enviar.
// Si el bot no está en ningún grupo, se manda aquí mismo y no hay paso 'grupo'.
const pedirGrupo = async (conn, m, medias, caption) => {
    if (!medias?.length) throw new Error('sin resultados')
    const grupos = await listaGrupos(conn)
    if (!grupos.length) return enviar(conn, m, medias, caption)
    setSesion(m.chat, { paso: 'grupo', medias, caption, grupos, dueno: m.sender })
    return m.reply(`ꕤ Todo listo: *${medias.length} archivo(s)* preparados... *Pervertido.*\n\n¿Y a qué grupo los envío?\n\n${textoGrupos(grupos)}`)
}

// ── sesiones (pasos interactivos), TTL 10 minutos ──
// La sesión SOLO se entrega a su dueño: clave exacta del chat o el mismo
// usuario que la creó. Está PROHIBIDO el fallback de "única sesión privada"
// (v1): con una búsqueda activa, CUALQUIER persona que le escribiera al bot
// era tomada como respuesta del flujo y recibía los menús — e incluso el
// álbum si mandaba un número (le llegó contenido NSFW a un tercero).
// El dueño siempre tiene la RUTA 2: /r34 <respuesta> por el comando.
const SESIONES = new Map()
const TTL = 10 * 60 * 1000

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

const mismoUsuario = (a, b) => {
    if (!a || !b) return false
    return a === b || String(a).split('@')[0] === String(b).split('@')[0]
}
const esPrivado = (jid) => !/@g\.us$/.test(String(jid || ''))

const getSesionFlexible = (m) => {
    const chat = m?.chat
    if (!chat) return null
    const directo = getSesion(chat)
    if (directo) return { ses: directo, clave: chat }
    if (!esPrivado(chat)) return null
    const privadas = [...SESIONES.entries()].filter(([k, s]) => esPrivado(k))
    const porDueno = privadas.find(([, s]) => s.dueno && mismoUsuario(s.dueno, m?.sender))
    if (porDueno) return { ses: porDueno[1], clave: porDueno[0] }
    return null // sin dueño que coincida → NO responder nada a este chat
}

// Chequeo barato para el gate de Rory-Mercury.js: solo se salta el bloqueo
// privado si el mensaje viene del CHAT de la sesión o de su MISMO dueño.
// Un tercero (normal o @lid) nunca pasa.
const tieneSesionR34 = (chat, sender) => {
    if (getSesion(chat)) return true
    if (!esPrivado(chat)) return false
    const privadas = [...SESIONES.entries()].filter(([k, s]) => esPrivado(k))
    return privadas.some(([, s]) => s.dueno && mismoUsuario(s.dueno, sender))
}

// Borra la sesión pase lo que pase con el JID (clave exacta + privadas del dueño)
const delSesionFlexible = (m) => {
    delSesion(m?.chat)
    const chat = String(m?.chat || '')
    if (!esPrivado(chat)) return
    for (const [k, s] of [...SESIONES.entries()]) {
        if (!esPrivado(k)) continue
        if (mismoUsuario(s.dueno, m?.sender) || mismoUsuario(k, chat)) SESIONES.delete(k)
    }
}

// ── textos ──
const resumenTag = (tag, count) =>
    `ꕤ Busqué *${tag}* en Rule34...\n» Encontré *${count} posts* sin IA.`

const textoFormato = (tag) =>
    `ꕤ ¿Qué quieres ver de *${tag}*?\n\n❀ *1* o *videos* — hasta *50*\n❀ *2* o *imagenes* — hasta *50*\n❀ *3* o *mixto* — hasta *25* de cada una\n\n> Con cantidad: *videos 20*, *imagenes 35*, *mixto 10*\n> Responde aquí mismo, o con */r34 videos 20*\n> (*cancelar* para salir)`

const textoTags = (tag, sugerencias, nota = '') => {
    let menu = nota || `ꕤ No hay resultados para *${tag}*.\n\nPero encontré estos tags en *Rule34*:\n\n`
    sugerencias.forEach((s, i) => {
        menu += `❀ *${i + 1}.* ${s.tag}${s.count ? ` _(${s.count.toLocaleString('es')} posts)_` : ''}\n`
    })
    menu += `\n> Responde con el *número* aquí mismo, o con */r34 <número>*\n> (*cancelar* para salir)`
    return menu
}

// ─────────────────────────────────────────────────────────────
//  MOTOR DE PASOS — compartido por las dos rutas de respuesta.
//  Devuelve true si CONSUMIÓ el mensaje (era respuesta del flujo activo).
//  Nunca lanza: todo el cuerpo va en try/catch.
// ─────────────────────────────────────────────────────────────
const manejarRespuesta = async (conn, m, texto) => {
    const flex = getSesionFlexible(m)
    if (!flex) return false
    const { ses, clave } = flex
    const bajo = String(texto || '').trim().toLowerCase()

    // mensajes con prefijo = otros comandos → no se consumen aquí (la ruta
    // comando los atiende; /r34 nuevo ya borra la sesión por su cuenta)
    const prefList = Array.isArray(global.prefix) ? global.prefix : [global.prefix || '.']
    const esComando = prefList.some(p => p instanceof RegExp ? p.test(String(texto || '')) : bajo.startsWith(String(p)))
    if (esComando) return false

    try {
        // cancelar en cualquier paso
        if (/^(cancelar?|stop|salir)$/.test(bajo)) {
            delSesion(clave)
            await m.reply(`ꕤ Búsqueda cancelada.\n> Vuelve cuando quieras: */r34 <tag>*`)
            return true
        }

        // PASO tags: elegir de la lista de parecidos
        if (ses.paso === 'tags') {
            const n = /^\d{1,2}$/.test(bajo) ? parseInt(bajo, 10) : NaN
            if (isNaN(n) || n < 1 || n > ses.tags.length) {
                await m.reply(`ꕤ Responde con un *número* del *1* al *${ses.tags.length}* (aquí mismo o */r34 <número>*).\n> (*cancelar* para salir)`)
                return true
            }
            const elegido = ses.tags[n - 1].tag
            // anti-trabado: los tags ya probados no vuelven a aparecer
            const probados = [...new Set([...(ses.probados || []), ses.tag, elegido])]
            await m.react('⏳')
            // conteo PROFUNDO del tag elegido (3 páginas): el primer bloque de
            // 600 de un tag grande trae pocos posts sin IA (99 de mavuika)
            const posts = await fetchPosts(elegido, { paginas: 3, objetivo: 300 })
            if (!posts.length) {
                const nuevas = (await suggestTags(elegido)).filter(s => !probados.includes(s.tag))
                if (!nuevas.length) {
                    delSesion(clave)
                    await m.react('❌')
                    await m.reply(`ꕤ *${elegido}* no tiene nada sin IA en Rule34 (o no existe)...\n> Prueba con otro: */r34 <tag>*`)
                    return true
                }
                setSesion(clave, { ...ses, tag: elegido, tags: nuevas, probados })
                await m.react('✔️')
                await m.reply(textoTags(elegido, nuevas, `ꕤ *${elegido}* no tiene resultados sin IA... ¿No será uno de estos?\n\n`))
                return true
            }
            setSesion(clave, { ...ses, paso: 'formato', tag: elegido, count: posts.length, probados })
            await m.react('✔️')
            await m.reply(`${resumenTag(elegido, posts.length)}\n\n${textoFormato(elegido)}`)
            return true
        }

        // PASO formato: 1/2/3 o videos/imagenes/mixto (+ cantidad)
        if (ses.paso === 'formato') {
            const f = parseFormato(bajo)
            if (!f) {
                await m.reply(textoFormato(ses.tag))
                return true
            }
            await m.react('⏳')
            const r = await buscar(f.tipo, ses.tag, f.cantidad)
            if (!r.medias.length) {
                delSesion(clave)
                await m.react('❌')
                await m.reply(`ꕤ No conseguí *${f.tipo}* para *${ses.tag}*... prueba otro formato o tag.`)
                return true
            }
            delSesion(clave)
            await m.react('✔️')
            const aviso = f.exceso ? `\n\n> Pediste de más, te bajé al tope: *${f.cantidad}*.` : ''
            const cap = f.tipo === 'video'
                ? `Encontré *${r.videos} vídeo(s)* de *${ses.tag}*... *Pervertido.*${aviso}`
                : f.tipo === 'imagen'
                    ? `Encontré *${r.imagenes} imágenes* de *${ses.tag}*... *Pervertido.*${aviso}`
                    : `Encontré *${r.imagenes} imágenes* y *${r.videos} vídeos* de *${ses.tag}*... *Pervertido.*${aviso}`
            // privado: el proceso corrió completo → elegir grupo destino
            if (esPrivado(m.chat)) {
                await pedirGrupo(conn, m, r.medias, cap)
                return true
            }
            await enviar(conn, m, r.medias, cap)
            return true
        }

        // PASO grupo (solo privado): 0 = aquí, "1", "1,3", "1 3"...
        if (ses.paso === 'grupo') {
            if (!/^\d[\d\s,]*$/.test(bajo)) {
                await m.reply(`ꕤ Responde con el *número* del grupo (o *0* para este chat), aquí mismo o */r34 <número>*\n\n${textoGrupos(ses.grupos)}`)
                return true
            }
            const nums = [...new Set(bajo.match(/\d+/g).map(Number))]
            const max = ses.grupos.length
            if (nums.some(n => n > max)) {
                await m.reply(`ꕤ Solo hay *${max}* grupo(s) en mi lista...\n> Responde del *0* al *${max}*\n\n${textoGrupos(ses.grupos)}`)
                return true
            }
            const aqui = nums.includes(0)
            const elegidos = nums.filter(n => n >= 1).map(n => ses.grupos[n - 1])
            delSesion(clave)
            await m.react('⏳')
            const ok = []
            const fallo = []
            for (const g of elegidos) {
                try { await enviar(conn, m, ses.medias, ses.caption, g.id); ok.push(g.nombre) } catch { fallo.push(g.nombre) }
            }
            if (aqui) {
                try { await enviar(conn, m, ses.medias, ses.caption); ok.push('este chat') } catch { fallo.push('este chat') }
            }
            await m.react(ok.length ? '✔️' : '❌')
            if (ok.length) {
                await m.reply(`ꕤ Enviado a: *${ok.join('*, *')}*${fallo.length ? `\n> Falló con: *${fallo.join('*, *')}*` : ''}`)
            } else {
                await m.reply(`*Ugh, no pude enviar a ningún grupo.* 🛠️\n> Intenta de nuevo: */r34 <tag>*`)
            }
            return true
        }

        return true // sesión activa de un paso desconocido → consumida
    } catch (e) {
        console.error('Error flujo r34:', e)
        delSesion(clave)
        try {
            await m.react('❌')
            await m.reply(`*Ugh, algo salió mal con la búsqueda.* 🛠️`)
        } catch {}
        return true
    }
}

export {
    fetchPosts, suggestTags, resolverTag, esVideo, esImagen, tieneIA,
    parseFormato, buscar, enviar,
    getSesion, setSesion, delSesion,
    getSesionFlexible, tieneSesionR34, delSesionFlexible,
    listaGrupos, textoGrupos, pedirGrupo,
    resumenTag, textoFormato, textoTags,
    manejarRespuesta,
    CAPS, PAGINA
}
