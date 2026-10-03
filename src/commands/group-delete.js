let handler = async (m, { conn, command, isAdmin, isBotAdmin }) => {
    // 1. Verificamos si esta citando algo
    if (!m.quoted) {
        return conn.reply(m.chat, `ꕤ Por favor, cita el mensaje que deseas eliminar.`, m)
    }

    let isBotMessage = m.quoted.fromMe

    // 2. LOGICA DE PERMISOS
    if (!isBotMessage && !isAdmin) {
        return conn.reply(m.chat, `⚠️ Solo los administradores pueden eliminar mensajes de otros usuarios.`, m)
    }

    if (!isBotMessage && !isBotAdmin) {
        return conn.reply(m.chat, `❌ Necesito ser administrador para borrar mensajes de otros.`, m)
    }

    // 3. EJECUCION DE ELIMINACION
    try {
        let participant = m.message.extendedTextMessage.contextInfo.participant
        let stanzaId = m.message.extendedTextMessage.contextInfo.stanzaId
        
        return await conn.sendMessage(m.chat, {
            delete: {
                remoteJid: m.chat,
                fromMe: isBotMessage,
                id: stanzaId,
                participant: participant
            }
        })
    } catch (e) {
        return conn.reply(m.chat, `❌ Ocurrio un error al intentar borrar el mensaje.`, m)
    }
}

handler.help = ['del', 'delete']
handler.tags = ['grupo']
handler.command = ['del', 'delete']
handler.group = true
handler.botAdmin = false

export default handler