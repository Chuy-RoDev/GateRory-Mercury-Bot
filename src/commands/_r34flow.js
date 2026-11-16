// _r34flow.js — atiende las respuestas del flujo /r34 (módulo before).
// Sesión por chat creada por nsfw-rule34.js en lib/r34flow.js:
//   confirm  → responde Si/No al "este tag ya existe, ¿es correcto?"
//   tags     → responde con el NÚMERO del tag de la lista
//   formato  → responde videos / imagenes / mixto (+ cantidad personalizada)
// Nunca devuelve true: no corta el procesamiento de otros plugins.
import {
    getSesion, setSesion, delSesion, fetchPosts, suggestTags,
    parseFormato, buscar, enviar, resumenTag, textoFormato, textoTags
} from '../../lib/r34flow.js'

export async function before(m, { conn }) {
    if (!m?.text || m.fromMe || !m.chat) return
    const ses = getSesion(m.chat)
    if (!ses) return

    const texto = m.text.trim()
    const bajo = texto.toLowerCase()
    const pref = Array.isArray(global.prefix) ? global.prefix[0] : (global.prefix || '.')
    if (bajo.startsWith(pref)) { delSesion(m.chat); return }
    if (/^(cancelar|cancel|stop|salir)$/.test(bajo)) {
        delSesion(m.chat)
        return m.reply(`ꕤ Búsqueda cancelada.\n> Vuelve cuando quieras: *${pref}r34 <tag>*`)
    }

    try {
        if (ses.paso === 'confirm') {
            if (/^(si|sí|yes|s)\b/.test(bajo)) {
                setSesion(m.chat, { ...ses, paso: 'formato' })
                return m.reply(textoFormato(ses.tag))
            }
            if (/^(no|n)\b/.test(bajo)) {
                const sugerencias = await suggestTags(ses.tag)
                if (!sugerencias.length) {
                    delSesion(m.chat)
                    return m.reply(`ꕤ Está bien, no es ese tag... pero no encontré parecidos para *${ses.tag}*.\n> Prueba con otro: *${pref}r34 <tag>*`)
                }
                setSesion(m.chat, { ...ses, paso: 'tags', tags: sugerencias })
                return m.reply(textoTags(ses.tag, sugerencias, `ꕤ ¿No era el tag correcto? Elige uno de estos:\n\n`))
            }
            return m.reply(`ꕤ Responde *Si* o *No*\n> (*cancelar* para salir)`)
        }

        if (ses.paso === 'tags') {
            const n = parseInt(bajo, 10)
            if (isNaN(n) || n < 1 || n > ses.tags.length) {
                return m.reply(`ꕤ Responde con un *número* del *1* al *${ses.tags.length}*\n> (*cancelar* para salir)`)
            }
            const elegido = ses.tags[n - 1].tag
            const posts = await fetchPosts(elegido)
            if (!posts.length) {
                const nuevas = await suggestTags(elegido)
                if (!nuevas.length) {
                    delSesion(m.chat)
                    return m.reply(`ꕤ *${elegido}* no tiene resultados y no encontré parecidos.\n> Prueba con otro: *${pref}r34 <tag>*`)
                }
                setSesion(m.chat, { ...ses, tag: elegido, tags: nuevas })
                return m.reply(textoTags(elegido, nuevas))
            }
            setSesion(m.chat, { ...ses, paso: 'formato', tag: elegido, count: posts.length })
            return m.reply(`${resumenTag(elegido, posts.length)}\n\n${textoFormato(elegido)}`)
        }

        if (ses.paso === 'formato') {
            const f = parseFormato(bajo)
            if (!f) return m.reply(textoFormato(ses.tag))
            await m.react('⏳')
            const r = await buscar(f.tipo, ses.tag, f.cantidad)
            if (!r.medias.length) {
                delSesion(m.chat)
                await m.react('❌')
                return m.reply(`ꕤ No conseguí *${f.tipo}* para *${ses.tag}*... prueba otro formato o tag.`)
            }
            delSesion(m.chat)
            await m.react('✔️')
            const avisoExceso = f.exceso ? `\n\n> Pediste más de lo permitido, te bajé al tope: *${f.cantidad}*.` : ''
            const caption = f.tipo === 'video'
                ? `Encontré *${r.videos} vídeo(s)* de *${ses.tag}*... *Pervertido.*${avisoExceso}`
                : f.tipo === 'imagen'
                    ? `Encontré *${r.imagenes} imágenes* de *${ses.tag}*... *Pervertido.*${avisoExceso}`
                    : `Encontré *${r.imagenes} imágenes* y *${r.videos} vídeos* de *${ses.tag}*... *Pervertido.*${avisoExceso}`
            return await enviar(conn, m, r.medias, caption)
        }
    } catch (e) {
        console.error('Error _r34flow:', e)
        delSesion(m.chat)
        try { await m.reply(`*Ugh, algo salió mal con la búsqueda.* 🛠️`) } catch {}
    }
}
