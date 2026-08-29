let handler = async (m, { conn, usedPrefix, command, text, isAdmin, isOwner }) => {
    const ctxErr = (global.rcanalx || {})
    const ctxWarn = (global.rcanalw || {})
    const ctxOk = (global.rcanalr || {})

    // Permite la ejecución a admins del grupo, Owners o la propia sesión del Socket (m.fromMe / Sub-bot)
    const isSocket = m.fromMe || isOwner || (conn.user?.id && m.sender.includes(conn.user.id.split(':')[0]))
    if (!isAdmin && !isSocket) {
        return conn.reply(m.chat, 'ꕤ Solo los administradores del grupo o la sesión del Bot pueden modificar el prefix.', m, ctxErr)
    }

    if (!global.db.data.chats[m.chat]) global.db.data.chats[m.chat] = {}
    const chatData = global.db.data.chats[m.chat]

    const resetTerms = ['reset', 'off', 'del', 'delete', 'clear', 'default', 'restablecer']

    if (!text) {
        const actual = chatData.prefix || null
        const predeterminados = Array.isArray(global.prefix)
            ? global.prefix.join(' | ')
            : global.prefix?.source || '/'
        const msg = actual
            ? `ꕤ El prefix actual de este grupo es: *${actual}*\n> Para resetear usa: *${actual}setprefix reset*`
            : `ꕤ Este grupo usa los prefijos predeterminados: *${predeterminados}*`
        return conn.reply(m.chat, msg, m, ctxWarn)
    }

    const input = text.trim()

    if (resetTerms.includes(input.toLowerCase())) {
        delete chatData.prefix
        return conn.reply(m.chat, 'ꕤ Prefix restablecido al predeterminado correctamente.', m, ctxOk)
    }

    if (input.length > 5) {
        return conn.reply(m.chat, 'ꕤ El prefix no puede tener más de *5 caracteres*.', m, ctxErr)
    }
    if (/\s/.test(input)) {
        return conn.reply(m.chat, 'ꕤ El prefix no puede contener espacios.', m, ctxErr)
    }

    chatData.prefix = input

    return conn.reply(m.chat, `ꕤ Prefix cambiado a: *${input}*\n> Ejemplo: *${input}menu*\n> Para resetear: *${input}setprefix reset*`, m, ctxOk)
}

handler.help = ['setprefix']
handler.tags = ['group']
handler.command = ['setprefix', 'prefix']
handler.group = true

export default handler