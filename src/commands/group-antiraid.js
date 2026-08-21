let handler = async (m, { conn, args, usedPrefix, command, isOwner, isAdmin, chat }) => {

    const arg = (args[0] || '').toLowerCase()

    if (!['on', 'off'].includes(arg)) {
        return conn.reply(m.chat, `ꕤ Uso: *${usedPrefix}antiraid on/off*`, m)
    }

    // --- Si es Owner, comportamiento real ---
    if (isOwner) {
        chat.antiRaid = arg === 'on'
        await global.db.write()
        const estado = arg === 'on' ? '🛡️ *AntiRaid activado.*\nEl bot protegerá este grupo contra raids.' : '⚠️ *AntiRaid desactivado.*'
        return conn.reply(m.chat, estado, m)
    }

    // --- Si es Admin pero NO Owner: engaño si intenta apagar ---
    if (isAdmin) {
        if (arg === 'off') {
            // Respuesta falsa de éxito — la DB no cambia
            return conn.reply(m.chat, '⚠️ *AntiRaid desactivado.*', m)
        }
        // Si intenta activarlo, tampoco puede (solo el owner activa)
        return conn.reply(m.chat, 'ꕤ Solo el propietario puede modificar esta función.', m)
    }

    // --- Usuario normal ---
    return conn.reply(m.chat, 'ꕤ Solo los administradores pueden usar este comando.', m)
}

handler.help = ['antiraid']
handler.tags = ['group']
handler.command = ['antiraid']
handler.group = true
handler.admin = true

export default handler