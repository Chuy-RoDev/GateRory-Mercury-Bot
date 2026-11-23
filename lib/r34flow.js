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

// FILTRO ANTI-IA: la negación en la query recorta volumen, pero en vivo se vio
// que igual llegaban posts IA con otros tags (ai_art, ai-created...), así que
// además se revisa el tag de CADA post. Comparación tag por tag para no dar
// falsos positivos con cosas como "anal_hair" (contienen "ai").
const PATRON_TAG_IA = /^(ai$|ai[-_]|aigenerated|novel[-_]?ai|stable[-_]?diffusion|midjourney|dall[-_]?e|artificial|generated)/i

const tieneIA = (post) => {
    const tags = Array.isArray(post?.tags) ? post.tags : String(post?.tags || '').split(/[\s,]+/).filter(Boolean)
    return tags.some(t => PATRON_TAG_IA.test(t))
}

// La API responde HTTP 200 con cuerpo vacío cuando el tag no existe:
// cuerpo vacío = sin resultados (no explotar el JSON.parse).
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

// Busca según el tipo y devuelve medias listas para sendSylphy (barajadas)
const buscar = async (tipo, tag, cantidad) => {
    const barajar = (arr) => arr.map(v => [Math.random(), v]).sort(([a], [b]) => a - b).map(([, v]) => v)
    const media = (post, t) => ({ type: t, data: { url: post.file_url || post.sample_url || post.preview_url } })
    if (tipo === 'video') {
        const posts = await fetchPosts(`${tag} video`)
        const vids = barajar(posts.filter(esVideo))
        return { medias: vids.slice(0, cantidad).map(p => media(p, 'video')), imagenes: 0, videos: Math.min(cantidad, vids.length) }
    }
    if (tipo === 'imagen') {
        const posts = await fetchPosts(tag)
        const imgs = barajar(posts.filter(esImagen))
        return { medias: imgs.slice(0, cantidad).map(p => media(p, 'image')), imagenes: Math.min(cantidad, imgs.length), videos: 0 }
    }
    const [generales, deVideo] = await Promise.all([fetchPosts(tag), fetchPosts(`${tag} video`)])
    const imgs = barajar(generales.filter(esImagen)).slice(0, cantidad)
    const vids = barajar(deVideo.filter(esVideo)).slice(0, cantidad)
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
    menu += `\n> Puedes elegir varios: *1,3* o *1 3*\n> Tienes *10 minutos* para responder\n> (*cancelar* para salir)`
    return menu
}

// El proceso corrió completo → en privado se pregunta a qué grupo enviar.
// Si el bot no está en ningún grupo, se manda aquí mismo y no hay paso 'grupo'.
const pedirGrupo = async (conn, m, medias, caption) => {
    if (!medias?.length) throw new Error('sin resultados')
    const grupos = listaGrupos(conn)
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
            const posts = await fetchPosts(elegido)
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
    fetchPosts, suggestTags, esVideo, esImagen, tieneIA,
    parseFormato, buscar, enviar,
    getSesion, setSesion, delSesion,
    getSesionFlexible, tieneSesionR34, delSesionFlexible,
    listaGrupos, textoGrupos, pedirGrupo,
    resumenTag, textoFormato, textoTags,
    manejarRespuesta,
    CAPS
}
