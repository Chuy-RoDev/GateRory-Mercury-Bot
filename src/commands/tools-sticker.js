// /s · /sticker · /stiker — UNIFICADO (antes había dos plugins que peleaban por
// el mismo comando). Combina: marca personalizada con • o | (de tools-sticker.js),
// soporte de URLs, alias 'stiker' y cadena de respaldo por subida web
// (de tools-stickers.js), ruta rápida webp con addExif y reacciones.
import { sticker, addExif } from '../../lib/sticker.js'
import uploadFile from '../../lib/uploadFile.js'
import uploadImage from '../../lib/uploadImage.js'
import { webp2png } from '../../lib/webp2mp4.js'

const isUrl = (text) => {
    return text.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)(jpe?g|gif|png)/, 'gi'))
}

let handler = async (m, { conn, args }) => {
    const userData = global.db.data.users[m.sender] || {}
    const packDefecto = userData.text1 || global.packsticker
    const authorDefecto = userData.text2 || global.packsticker2
    const txt = args.join(' ')

    try {
        const q = m.quoted ? m.quoted : m
        const mime = (q.msg || q).mimetype || q.mediaType || ''

        // Sin media: intentar URL; si el texto no es URL, explicar el uso
        if (!(/webp|image|video/g.test(mime)) || !q.download) {
            if (args[0] && isUrl(args[0])) {
                await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })
                const stiker = await sticker(false, args[0], packDefecto, authorDefecto).catch(() => null)
                if (!stiker) {
                    await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
                    return conn.reply(m.chat, 'ꕤ No se pudo bajar el sticker desde ese URL...', m)
                }
                await conn.sendMessage(m.chat, { sticker: stiker }, { quoted: m })
                return await conn.sendMessage(m.chat, { react: { text: '✔️', key: m.key } })
            }
            return conn.reply(m.chat, 'ꕤ Envía o cita una imagen, video o sticker para hacer sticker.\n> También acepta un *URL* de imagen: *' + (m.usedPrefix || '.') + 's https://...*.jpg\n> Y marca personalizada: *.s pack • autor*', m)
        }

        if (/video/.test(mime) && (q.msg || q).seconds > 15) {
            return conn.reply(m.chat, 'ꕤ El video no puede durar más de 15 segundos.', m)
        }

        await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

        const buffer = await q.download()
        if (!buffer) return conn.reply(m.chat, 'ꕤ No se pudo descargar el archivo.', m)

        const marca = txt
            ? txt.split(/[\u2022|]/).map(p => p.trim())
            : [packDefecto, authorDefecto]
        const pack = marca[0] || packDefecto
        const author = marca[1] || authorDefecto

        let stiker
        if (/webp/i.test(mime)) {
            // Ruta rápida: solo cambiar pack/autor sin re-encodar
            stiker = await addExif(buffer, pack, author).catch(() => null)
            // Si falla el Exif, re-encodar vía webp2png
            if (!stiker) {
                const out = await webp2png(buffer).catch(() => null)
                if (out) stiker = await sticker(false, out, pack, author).catch(() => null)
            }
        } else {
            // 1) Conversión local con ffmpeg
            stiker = await sticker(buffer, false, pack, author).catch(() => null)
            // 2) Respaldo: subir a servidor web y convertir allá
            if (!stiker) {
                const out = /image/g.test(mime)
                    ? await uploadImage(buffer).catch(() => null)
                    : await uploadFile(buffer).catch(() => null)
                if (out) stiker = await sticker(false, out, pack, author).catch(() => null)
            }
        }

        if (!stiker || !Buffer.isBuffer(stiker)) {
            await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
            return conn.reply(m.chat, 'ꕤ No se pudo crear el sticker.\n> Si el problema persiste, instala ffmpeg: *pkg install ffmpeg* (Termux) o *sudo apt install ffmpeg* (Linux).', m)
        }

        await conn.sendMessage(m.chat, { sticker: stiker }, { quoted: m })
        await conn.sendMessage(m.chat, { react: { text: '✔️', key: m.key } })

    } catch (e) {
        console.error('Error sticker:', e)
        conn.reply(m.chat, 'ꕤ Ocurrió un error al procesar el sticker.', m)
    }
}

handler.help = ['sticker <img|url>', 'stiker']
handler.tags = ['stickers']
handler.command = ['s', 'sticker', 'stiker']
handler.register = true

export default handler
