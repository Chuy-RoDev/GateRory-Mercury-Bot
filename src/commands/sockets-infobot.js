// Import fetch from 'node-fetch' <-- Eliminado, ya que se usará global.icono (Buffer)

let handler = async (m, { conn, args, usedPrefix }) => {
  try {
    let mentionedJid = await m.mentionedJid
    let userId = mentionedJid && mentionedJid[0] ? mentionedJid[0] : m.sender

    // Se usan las variables globales definidas. Se ASUME que global.icono es un Buffer.
    const nombreBot = global.botname || 'Rory Mercury'
    const moneda = global.currency || 'Soul-Coins 🖤'
    const textobot = global.textbot || 'Made with love by Arlette Xz'
    const canal = global.channel || 'https://whatsapp.com/channel/0029VbBj5it3LdQMIxu7zP1l'

    const tipoBot = (conn.user.jid == global.conn.user.jid ? 'Principal' : 'Sub-Bot')
    const host = tipoBot === 'Principal' ? 'Speed3xz VIP' : 'Speed3xz SUB'

    // Nota: Se usó ${botname} en el original, pero se corrige a ${nombreBot} o global.botname
    const botInfoText = `
✿  Información del Bot *${nombreBot}*

✿ *Nombre:* ${nombreBot}
✿ *Versión:* ${global.vs || 'Multi-Device'}
✦ *Moneda:* ${moneda} 

❒ *Host:* ${host}
❒ *Conectado a:* Sky
❒ *Tipo:* ${tipoBot}
❒ *Dueño:* Oculto por privacidad.

> *Canal* \`${canal}\`
`.trim()

    // Usando global.icono como thumbnail
    const thumbnailBuffer = global.icono || null

    await conn.sendMessage(
      m.chat,
      {
        text: botInfoText,
        contextInfo: {
          mentionedJid: [userId],
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: '120363403176894973@newsletter',
            serverMessageId: '',
            newsletterName: '【 ✰ 】𝗦𝗽𝗲𝗲𝗱𝟯𝘅𝘇 𝗖𝗹𝘂𝗯 - 𝗢𝗳𝗶𝗰𝗶𝗮𝗹 𝗖𝗵𝗮𝗻𝗻𝗲𝗹'
          },
          externalAdReply: {
            title: `${nombreBot} - Bot Information`,
            body: textobot,
            mediaType: 1,
            previewType: "PHOTO", // Cambiado a PHOTO para reflejar el uso de una imagen (icono)
            sourceUrl: global.web || canal,
            thumbnail: thumbnailBuffer, // Usando global.icono
            showAdAttribution: false,
            containsAutoReply: true,
            renderLargerThumbnail: true
          }
        }
      },
      { quoted: m }
    )

  } catch (e) {
    await conn.sendMessage(m.chat, { text: `❌ Error en el comando botinfo:\n${e}` }, { quoted: m })
  }
}

handler.help = ['botinfo']
handler.tags = ['socket']
handler.command = ['botinfo', 'infobot', 'info']

export default handler
