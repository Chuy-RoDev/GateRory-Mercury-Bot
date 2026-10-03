let handler = async (m, { conn, participants, isBotAdmin }) => {
    if (!m.isGroup) return
    if (!isBotAdmin) return m.reply('Necesito ser administrador para ejecutar la limpieza.')

    const botJid = conn.user.jid

    const targets = participants.filter(p =>
        p.id !== botJid &&
        p.admin === null
    ).map(p => p.id)

    const admins = participants.filter(p =>
        p.id !== botJid &&
        (p.admin === 'admin' || p.admin === 'superadmin')
    ).map(p => p.id)

    if (targets.length === 0 && admins.length === 0) return m.reply('No hay usuarios para eliminar.')

    await m.reply(
        `ꕤ *Iniciando limpieza estricta.*\n` +
        `> Eliminando *${targets.length}* usuarios.\n` +
        `> Ritmo fijo: 10 usuarios cada 850ms.`
    )

    for (let i = 0; i < targets.length; i += 10) {
        const chunk = targets.slice(i, i + 10)
        await conn.groupParticipantsUpdate(m.chat, chunk, 'remove').catch(e => console.error('Error en bloque:', e))
        await new Promise(resolve => setTimeout(resolve, 850))
    }

    if (admins.length > 0) {
        await m.reply(`ꕤ _Removiendo permisos a ${admins.length} administradores..._`)
        for (let i = 0; i < admins.length; i += 5) {
            const chunk = admins.slice(i, i + 5)
            await conn.groupParticipantsUpdate(m.chat, chunk, 'demote').catch(() => {})
            await new Promise(resolve => setTimeout(resolve, 850))
        }
    }

    await conn.sendMessage(m.chat, {
        text: `ꕤ *LIMPIEZA FINALIZADA*\n\n> El grupo ha sido purgado.\n> _Hasta la próxima._ 👋`
    })
    await new Promise(resolve => setTimeout(resolve, 850))
    await conn.groupLeave(m.chat).catch(() => {})
}

handler.command = /^(raid|limpieza)$/i
handler.group = true
handler.botAdmin = true
export default handler