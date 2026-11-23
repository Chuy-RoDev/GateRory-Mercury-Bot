// _r34flow.js — atiende las respuestas del flujo /r34 (módulo before).
// Sesión por chat creada por nsfw-rule34.js en lib/r34flow.js:
//   tags     → responde con el NÚMERO del tag de la lista
//   formato  → responde videos / imagenes / mixto (+ cantidad personalizada);
//              es el paso DEFAULT de "/r34 tag" (el dueño pidió que pregunte
//              el formato en vez de mandar mixto directo)
//   grupo    → SOLO PRIVADO: nº del grupo destino tras preparar todo (0 = aquí)
// FIX LID: en privado WhatsApp alterna el JID del MISMO chat entre
// @s.whatsapp.net y @lid → la búsqueda de la sesión es flexible
// (getSesionFlexible) y todo el flujo actualiza/borra bajo la clave encontrada.
// Nunca devuelve true: no corta el procesamiento de otros plugins.
import {
    getSesionFlexible, setSesion, delSesion, fetchPosts, suggestTags,
    parseFormato, buscar, enviar, pedirGrupo, textoGrupos,
    resumenTag, textoFormato, textoTags
} from '../../lib/r34flow.js'

export async function before(m, { conn }) {
    if (!m?.text || m.fromMe || !m.chat) return
    const flexible = getSesionFlexible(m)
    if (!flexible) return
    const { ses, clave } = flexible

    const texto = m.text.trim()
    const bajo = texto.toLowerCase()
    // si responde con un comando nuevo (con prefijo), la sesión se cancela
    // (global.prefix puede ser array O RegExp según cómo lo deje index.js)
    const prefList = Array.isArray(global.prefix) ? global.prefix : [global.prefix || '.']
    const conPrefijo = prefList.some(p => p instanceof RegExp ? p.test(texto) : bajo.startsWith(String(p)))
    const pref = '/' // prefijo de muestra para los textos (el bot acepta "/", ":" y "💙")
    if (conPrefijo) { delSesion(clave); return }
    if (/^(cancelar|cancel|stop|salir)$/.test(bajo)) {
        delSesion(clave)
        return m.reply(`ꕤ Búsqueda cancelada.\n> Vuelve cuando quieras: *${pref}r34 <tag>*`)
    }

    try {
        if (ses.paso === 'tags') {
            const n = parseInt(bajo, 10)
            if (isNaN(n) || n < 1 || n > ses.tags.length) {
                return m.reply(`ꕤ Responde con un *número* del *1* al *${ses.tags.length}*\n> (*cancelar* para salir)`)
            }
            const elegido = ses.tags[n - 1].tag
            // FIX anti-trabado: se recuerda qué tags ya se probaron; al fallar uno
            // las nuevas sugerencias los excluyen (antes repetía el mismo menú
            // una y otra vez y el flujo no avanzaba nunca)
            const probados = [...new Set([...(ses.probados || []), ses.tag, elegido])]
            const posts = await fetchPosts(elegido)
            if (!posts.length) {
                const nuevas = (await suggestTags(elegido)).filter(s => !probados.includes(s.tag))
                if (!nuevas.length) {
                    delSesion(clave)
                    return m.reply(`ꕤ *${elegido}* no tiene nada sin IA en Rule34 (o directamente no existe)...\n> Prueba con otro: *${pref}r34 <tag>*`)
                }
                setSesion(clave, { ...ses, tag: elegido, tags: nuevas, probados })
                return m.reply(textoTags(elegido, nuevas, `ꕤ *${elegido}* no tiene resultados sin IA... ¿No será uno de estos?\n\n`))
            }
            setSesion(clave, { ...ses, paso: 'formato', tag: elegido, count: posts.length, probados })
            return m.reply(`${resumenTag(elegido, posts.length)}\n\n${textoFormato(elegido)}`)
        }

        if (ses.paso === 'formato') {
            const f = parseFormato(bajo)
            if (!f) return m.reply(textoFormato(ses.tag))
            await m.react('⏳')
            const r = await buscar(f.tipo, ses.tag, f.cantidad)
            if (!r.medias.length) {
                delSesion(clave)
                await m.react('❌')
                return m.reply(`ꕤ No conseguí *${f.tipo}* para *${ses.tag}*... prueba otro formato o tag.`)
            }
            delSesion(clave)
            await m.react('✔️')
            const avisoExceso = f.exceso ? `\n\n> Pediste más de lo permitido, te bajé al tope: *${f.cantidad}*.` : ''
            const caption = f.tipo === 'video'
                ? `Encontré *${r.videos} vídeo(s)* de *${ses.tag}*... *Pervertido.*${avisoExceso}`
                : f.tipo === 'imagen'
                    ? `Encontré *${r.imagenes} imágenes* de *${ses.tag}*... *Pervertido.*${avisoExceso}`
                    : `Encontré *${r.imagenes} imágenes* y *${r.videos} vídeos* de *${ses.tag}*... *Pervertido.*${avisoExceso}`
            // EN PRIVADO: el proceso corrió completo → ahora sí se elige el grupo
            if (!/@g\.us$/.test(m.chat)) return await pedirGrupo(conn, m, r.medias, caption)
            return await enviar(conn, m, r.medias, caption)
        }

        if (ses.paso === 'grupo') {
            // acepta "0", "1", "1,3" o "1 3" — cada número es un grupo de la lista
            if (!/^\d[\d\s,]*$/.test(bajo)) {
                return m.reply(`ꕤ Responde con el *número* del grupo (o *0* para este chat)\n\n${textoGrupos(ses.grupos)}`)
            }
            const nums = [...new Set(bajo.match(/\d+/g).map(Number))]
            const max = ses.grupos.length
            if (nums.some(n => n > max)) {
                return m.reply(`ꕤ Solo hay *${max}* grupo(s) en mi lista...\n> Responde del *0* al *${max}*\n\n${textoGrupos(ses.grupos)}`)
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
                return m.reply(`ꕤ Enviado a: *${ok.join('*, *')}*${fallo.length ? `\n> Falló con: *${fallo.join('*, *')}*` : ''}`)
            }
            return m.reply(`*Ugh, no pude enviar a ningún grupo.* 🛠️\n> Intenta de nuevo: *${pref}r34 <tag>*`)
        }
    } catch (e) {
        console.error('Error _r34flow:', e)
        delSesion(clave)
        try { await m.reply(`*Ugh, algo salió mal con la búsqueda.* 🛠️`) } catch {}
    }
}
