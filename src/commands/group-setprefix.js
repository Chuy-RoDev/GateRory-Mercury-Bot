let handler = async (m, { conn, usedPrefix, command, text, isAdmin, isOwner }) => {
    const ctxErr = (global.rcanalx || {});
    const ctxWarn = (global.rcanalw || {});
    const ctxOk = (global.rcanalr || {});

    if (!global.db.data.chats[m.chat]) global.db.data.chats[m.chat] = {}
    const chatData = global.db.data.chats[m.chat]

    if (!text) {
        const actual = chatData.prefix || null
        const predeterminados = Array.isArray(global.prefix)
            ? global.prefix.join(' | ')
            : global.prefix?.source || '/'
        const msg = actual
            ? `ꕤ El prefix actual de este grupo es: *${actual}*\n> Para resetear al predeterminado usa: *${usedPrefix}setprefix reset*`
            : `ꕤ Este grupo usa los prefijos predeterminados: *${predeterminados}*`
        return conn.reply(m.chat, msg, m, ctxWarn)
    }

    if (text.trim().toLowerCase() === 'reset') {
        delete chatData.prefix
        return conn.reply(m.chat, 'ꕤ Prefix restablecido al predeterminado.', m, ctxOk)
    }

    const nuevoPrefix = text.trim()
    if (nuevoPrefix.length > 5) {
        return conn.reply(m.chat, 'ꕤ El prefix no puede tener más de *5 caracteres*.', m, ctxErr)
    }
    if (/\s/.test(nuevoPrefix)) {
        return conn.reply(m.chat, 'ꕤ El prefix no puede contener espacios.', m, ctxErr)
    }

    chatData.prefix = nuevoPrefix

    return conn.reply(m.chat, `ꕤ Prefix cambiado a: *${nuevoPrefix}*\n> Ejemplo: *${nuevoPrefix}menu*\n> Para resetear: *${nuevoPrefix}setprefix reset*`, m, ctxOk)
}

handler.help = ['setprefix']
handler.tags = ['group']
handler.command = ['setprefix', 'prefix']
handler.group = true
handler.admin = true

export default handler