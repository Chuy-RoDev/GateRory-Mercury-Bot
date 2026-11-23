// /r34 — flujo completo según lo pedido por el dueño:
//   · /r34 <tag>            → MENÚ: te pregunta ¿videos, imágenes o mixto?
//   · /r34 <tag> video [N]  → directo VIDEOS (máx 50; aliases r34vid/rule34vid/rulevid)
//   · /r34 <tag> imagen [N] → directo IMÁGENES (máx 50)
//   · /r34 <tag> mix [N]    → directo MIXTO con cantidad (máx 25 de cada)
//   · 0 resultados          → lista de tags parecidos numerada (sesión activa)
//   · ANTI-IA               → nada de resultados hechos/tocados por IA
//   · EN PRIVADO            → el proceso corre completo ANTES de enviar y al
//                             final eliges a qué grupo mandarlo (0 = este chat)
// Las respuestas (número de tag / formato / grupo) las atiende _r34flow.js
import {
    fetchPosts, suggestTags, buscar, enviar, pedirGrupo, setSesion, delSesionFlexible,
    resumenTag, textoFormato, textoTags, CAPS
} from '../../lib/r34flow.js'

const VIDEO_CMDS = ['r34vid', 'rule34vid', 'rulevid']

const handler = async (m, { conn, args, usedPrefix, command }) => {
    // Gate NSFW (igual que antes)
    const chat = global.db?.data?.chats?.[m.chat]
    if (m.isGroup && !chat?.nsfw) {
        return m.reply(`El NSFW está deshabilitado... ¿Realmente quieres hacer esto?..\n> Un administrador debe activarlo con: *${usedPrefix}nsfw on*`)
    }

    // El selector de grupo destino SOLO aplica en privado; en grupos todo igual
    const esPrivado = !/@g\.us$/.test(m.chat)

    // una búsqueda nueva siempre arranca de cero (borra sesiones bajo cualquier
    // variante de JID del chat: @s.whatsapp.net o @lid)
    delSesionFlexible(m)

    if (!args[0]) {
        return m.reply(`Esto... ¿Realmente quieres que haga esto?... *Pervertido.*\n\n> *Ejemplos:*\n*${usedPrefix + command} mika_misono* → te pregunto: ¿videos, imágenes o mixto?\n*${usedPrefix + command} mika_misono video 50* → directo solo vídeos\n*${usedPrefix + command} mika_misono imagen 20* → directo solo imágenes\n*${usedPrefix + command} mika_misono mix 10* → directo mixto\n\n> Tip: los tags van con _ en vez de espacios.`)
    }

    const rawInput = args.join(' ')
    const esVideoCmd = VIDEO_CMDS.includes(command)
    const pideVideo = esVideoCmd || /\b(video|vid|mp4)\b/i.test(rawInput) || /_video/i.test(rawInput)
    const pideImagen = /\b(imagen|img|image)\b/i.test(rawInput)
    const pideMixto = /\b(mix|mixto)\b/i.test(rawInput)
    // nº explícito en los args directos (video 50 / mix 10)
    const numDirecto = /\b(\d{1,3})\b/.exec(rawInput)
    const N = numDirecto ? parseInt(numDirecto[1], 10) : null
    // tag limpio: sin palabras de tipo ni números sueltos
    const cleanTag = rawInput
        .replace(/\b(video|vid|mp4|imagen|img|image|mix|mixto|menu|menú|pasos)\b/gi, ' ')
        .replace(/\b\d{1,3}\b/g, ' ')
        .trim().replace(/\s+/g, '_')
    const soloUnderscores = /^_+$/.test(cleanTag)

    // texto del "cero resultados" según el tipo pedido
    const ceroDe = (tipo) => tipo === 'video' ? 'vídeos' : tipo === 'imagen' ? 'imágenes' : 'archivos'

    try {
        await m.react('⏳')

        if (soloUnderscores || !cleanTag) {
            await m.react('❌')
            return m.reply(`Ese tag no me sirve... escribe algo con letras, *Pervertido.*`)
        }

        // ── DIRECTOS: /r34 tag video|imagen|mix [N] (o /r34vid tag) ──
        if (pideVideo || pideImagen || pideMixto) {
            const tipo = pideVideo ? 'video' : pideImagen ? 'imagen' : 'mixto'
            const tope = CAPS[tipo]
            const cantidad = Math.min(N ?? tope, tope)
            const r = await buscar(tipo, cleanTag, cantidad)
            if (!r.medias.length) {
                await m.react('❌')
                const sugerencias = await suggestTags(cleanTag)
                if (sugerencias.length) {
                    setSesion(m.chat, { paso: 'tags', tag: cleanTag, tags: sugerencias, count: 0, dueno: m.sender })
                    await m.react('✔️')
                    return m.reply(textoTags(cleanTag, sugerencias))
                }
                return m.reply(`*Cero ${ceroDe(tipo)} encontrados.* 🦈\nNo hay resultados para "${cleanTag}".\n\n> Tip: los tags usan _ en vez de espacios (ej: *mikasa_ackerman*) y suelen estar en inglés.`)
            }
            await m.react('✔️')
            const cap = tipo === 'video'
                ? `Encontré *${r.videos} vídeo(s)* de *${cleanTag}*... *Pervertido.*`
                : tipo === 'imagen'
                    ? `Encontré *${r.imagenes} imágenes* de *${cleanTag}*... *Pervertido.*`
                    : `Encontré *${r.imagenes} imágenes* y *${r.videos} vídeos* de *${cleanTag}*... *Pervertido.*`
            // EN PRIVADO: todo el proceso corre antes y al final se elige el grupo
            if (esPrivado) return await pedirGrupo(conn, m, r.medias, cap)
            return await enviar(conn, m, r.medias, cap)
        }

        // ── DEFAULT: /r34 tag → MENÚ de formato (videos / imagenes / mixto) ──
        const posts = await fetchPosts(cleanTag)
        if (!posts.length) {
            await m.react('❌')
            const sugerencias = await suggestTags(cleanTag)
            if (!sugerencias.length) {
                return m.reply(`*Cero archivos encontrados.* 🦈\nNo hay resultados ni tags parecidos para "${cleanTag}".\n\n> Tip: los tags usan _ en vez de espacios (ej: *mikasa_ackerman*) y suelen estar en inglés.`)
            }
            setSesion(m.chat, { paso: 'tags', tag: cleanTag, tags: sugerencias, count: 0, dueno: m.sender })
            await m.react('✔️')
            return m.reply(textoTags(cleanTag, sugerencias))
        }
        setSesion(m.chat, { paso: 'formato', tag: cleanTag, count: posts.length, dueno: m.sender })
        await m.react('✔️')
        return m.reply(`${resumenTag(cleanTag, posts.length)}\n\n${textoFormato(cleanTag)}`)

    } catch (e) {
        console.error('Error Rule34:', e)
        await m.react('❌')
        delSesionFlexible(m)
        return m.reply(`*Ugh, algo salió mal.* 🛠️\nLa base de datos no responde. Arréglatelas solo.`)
    }
}

handler.help = ['rule34 <tags>']
handler.tags = ['nsfw']
handler.command = ['r34', 'rule34', 'r34vid', 'rule34vid', 'rule', 'rulevid']

export default handler
export { fetchPosts, suggestTags }
