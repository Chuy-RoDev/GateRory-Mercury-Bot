let handler = async (m, { conn }) => {
    const chats = global.db.data.chats
    if (!chats) return conn.reply(m.chat, 'ꕤ No se encontró la base de datos de chats.', m)

    let count = 0

    // Recorre todos los grupos en la base de datos y elimina el prefijo personalizado
    for (const jid in chats) {
        if (chats[jid] && chats[jid].prefix) {
            delete chats[jid].prefix
            count++
        }
    }

    // Guarda los cambios inmediatamente en la base de datos
    if (global.db.write) await global.db.write().catch(() => null)

    return conn.reply(
        m.chat, 
        `ꕤ *Restablecimiento Global Completado*\n\n> Se eliminaron los prefijos personalizados de *${count}* grupo(s).\n> Todos los grupos volvieron al prefijo predeterminado del bot.`, 
        m
    )
}

handler.help = ['resetglobal']
handler.tags = ['owner']
handler.command = ['resetglobal', 'resetglobalprefix', 'resetallprefix', 'clearallprefix']
handler.rowner = true

export default handler