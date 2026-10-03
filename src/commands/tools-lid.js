let handler = async function (m, { conn, participants, groupMetadata }) {
    const participantList = participants || groupMetadata.participants || []
    
    // Obtener el usuario mencionado o citado
    let userId
    if (m.mentionedJid && m.mentionedJid.length > 0) {
        userId = m.mentionedJid[0]
    } else if (m.quoted) {
        userId = m.quoted.sender
    } else {
        userId = m.sender
    }
    
    // Buscar el participante
    const participant = participantList.find(p => p.id === userId)
    
    if (participant && participant.lid) {
        const username = userId.split('@')[0]
        conn.reply(m.chat, `ꕤ @${username}, tu LID es: ${participant.lid}`, m, { mentions: [userId] })
    } else {
        conn.reply(m.chat, 'ꕤ No se pudo encontrar tu LID.', m)
    }
}

handler.command = ['lid', 'mylid']
handler.help = ['mylid', 'lid']
handler.tags = ['tools']
handler.group = true

export default handler