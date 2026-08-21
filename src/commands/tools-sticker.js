import { sticker, addExif } from '../../lib/sticker.js'

let handler = async (m, { conn, args }) => {
    const userId = m.sender
    const userData = global.db.data.users[userId] || {}
    const packName = userData.text1 || global.packsticker
    const authorName = userData.text2 || global.packsticker2

    try {
        const q = m.quoted ? m.quoted : m
        const mime = (q.msg || q).mimetype || q.mediaType || ''
        const txt = args.join(' ')

        if (!(/webp|image|video/g.test(mime)) || !q.download) {
            return conn.reply(m.chat, 'ꕤ Envía o cita una imagen, video o sticker para hacer sticker.', m)
        }

        if (/video/.test(mime) && (q.msg || q).seconds > 15) {
            return conn.reply(m.chat, 'ꕤ El video no puede durar más de 15 segundos.', m)
        }

        await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

        const buffer = await q.download()
        if (!buffer) return conn.reply(m.chat, 'ꕤ No se pudo descargar el archivo.', m)

        const marca = txt
            ? txt.split(/[\u2022|]/).map(p => p.trim())
            : [packName, authorName]
        const pack = marca[0] || packName
        const author = marca[1] || authorName

        let resultado

        if (/webp/i.test(mime)) {
            // Es un sticker — solo cambiar el pack/autor sin re-encodar
            resultado = await addExif(buffer, pack, author)
        } else {
            // Imagen o video — convertir a sticker
            resultado = await sticker(buffer, false, pack, author)
        }

        if (!resultado || !Buffer.isBuffer(resultado)) {
            await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
            return conn.reply(m.chat, 'ꕤ No se pudo crear el sticker.', m)
        }

        await conn.sendMessage(m.chat, { sticker: resultado }, { quoted: m })
        await conn.sendMessage(m.chat, { react: { text: '✔️', key: m.key } })

    } catch (e) {
        console.error('Error sticker:', e)
        conn.reply(m.chat, 'ꕤ Ocurrió un error al procesar el sticker.', m)
    }
}

handler.help = ['sticker']
handler.tags = ['stickers']
handler.command = ['s', 'sticker']

export default handler