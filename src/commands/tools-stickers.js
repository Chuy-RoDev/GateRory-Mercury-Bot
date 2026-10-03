import { sticker } from '../../lib/sticker.js'
import uploadFile from '../../lib/uploadFile.js'
import uploadImage from '../../lib/uploadImage.js'
import { webp2png } from '../../lib/webp2mp4.js'

let handler = async (m, { conn, args, usedPrefix, command }) => {
  let stiker = false
  try {
    let q = m.quoted ? m.quoted : m
    let mime = (q.msg || q).mimetype || q.mediaType || ''
    
    if (/webp|image|video/g.test(mime)) {
      if (/video/g.test(mime) && (q.msg || q).seconds > 15) {
        return m.reply(`¡El video no puede durar más de 15 segundos!`)
      }
      
      let img = await q.download?.()
      if (!img) return m.reply(`Por favor, envía o responde a una imagen o video para hacer un sticker.`)

      const packstickers = global.db?.data?.users?.[m.sender]
      const texto1 = packstickers?.text1 || global.packsticker || 'Rory'
      const texto2 = packstickers?.text2 || global.packsticker2 || 'Bot'

      // 1. Intentar conversión directa con Buffer (FFmpeg local)
      try {
        stiker = await sticker(img, false, texto1, texto2)
      } catch (e) {
        console.error('Error en conversión directa:', e)
      }

      // 2. Si falla y es imagen/video, probar vía subida a servidor web
      if (!stiker) {
        let out
        if (/webp/g.test(mime)) {
          out = await webp2png(img).catch(() => null)
        } else if (/image/g.test(mime)) {
          out = await uploadImage(img).catch(() => null)
        } else if (/video/g.test(mime)) {
          out = await uploadFile(img).catch(() => null)
        }

        if (out) {
          stiker = await sticker(false, out, texto1, texto2).catch(() => null)
        }
      }
    } else if (args[0]) {
      if (isUrl(args[0])) {
        stiker = await sticker(false, args[0], global.packsticker, global.packsticker2).catch(() => null)
      } else {
        return m.reply(`El URL es incorrecto...`)
      }
    }
  } catch (e) {
    console.error('Error general en sticker:', e)
  } finally {
    if (stiker && Buffer.isBuffer(stiker)) {
      await conn.sendFile(m.chat, stiker, 'sticker.webp', '', m)
    } else {
      m.reply(`No se pudo crear el sticker. Si el problema persiste, instala ffmpeg en la terminal executando: pkg install ffmpeg (Termux) o sudo apt install ffmpeg (Linux).`)
    }
  }
}

handler.help = ['stiker <img>', 'sticker <url>']
handler.tags = ['sticker']
handler.command = ['s', 'sticker', 'stiker']
handler.register = true

export default handler

const isUrl = (text) => {
  return text.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)(jpe?g|gif|png)/, 'gi'))
}