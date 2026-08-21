import { downloadContentFromMessage } from '@whiskeysockets/baileys'

let handler = async (m, { conn }) => {
    if (!m.quoted) return conn.reply(m.chat, 'ꕤ Debes citar un sticker para convertir a imagen.', m, (global.rcanalr || {}))
    
    try {
        let quoted = m.quoted
        let imgBuffer
        
        if (quoted.viewOnce) {
            const viewOnceMessage = quoted.viewOnce ? quoted : quoted.mediaMessage?.imageMessage
            const stream = await downloadContentFromMessage(viewOnceMessage, 'image')
            let buffer = Buffer.from([])
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk])
            }
            imgBuffer = buffer
        } else {
            imgBuffer = await quoted.download()
        }
        
        if (!imgBuffer) return conn.reply(m.chat, 'ꕤ No se pudo descargar el sticker.', m, (global.rcanalr || {}))
        
        await conn.sendMessage(m.chat, { image: imgBuffer, caption: 'ꕤ *Aquí tienes*' }, { quoted: m })
        
    } catch {
        conn.reply(m.chat, 'ꕤ Ocurrió un error al procesar.', m, (global.rcanalr || {}))
    }
}

handler.help = ['toimg']
handler.tags = ['tools']
handler.command = ['toimg', 'jpg', 'img']

export default handler