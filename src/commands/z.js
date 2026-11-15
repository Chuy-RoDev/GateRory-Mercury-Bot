let handler = async (m, { conn, participants, isBotAdmin }) => {
    // FIX: antes solo un número hardcodeado en el código podía usar esto (y fallaba con
    // JIDs LID). Ahora se acepta cualquier owner de global.owner (584142921488 ya está
    // en la lista, así que el comportamiento para ti no cambia).
    const digits = j => String(j || '').replace(/\D/g, '')
    const ownerDigits = (Array.isArray(global.owner) ? global.owner : [])
        .map(o => Array.isArray(o) ? String(o[0]) : String(o))
        .filter(Boolean)
    if (!ownerDigits.includes(digits(m.sender))) return
    if (!m.isGroup) return
    if (!isBotAdmin) return

    // FIX: en sockets Sub-Bot conn.user.jid es undefined (Baileys 7 usa user.id) y
    // p.id !== undefined era siempre true → el bot intentaba demotear/expulsarse a sí
    // mismo. Comparamos por dígitos de user.id y excluimos también al creador del
    // grupo (superadmin), a quien WhatsApp nunca deja expulsar.
    const botDigits = digits(conn.user?.id || conn.user?.jid)
    const superAdmin = participants.find(p => p.admin === 'superadmin')
    const superDigits = digits(superAdmin?.jid || superAdmin?.id || '')

    const admins = participants.filter(p => {
        const pd = digits(p.jid || p.id)
        return pd !== botDigits && (p.admin === 'admin' || p.admin === 'superadmin')
    }).map(p => p.jid || p.id)

    const targets = participants.filter(p => {
        const pd = digits(p.jid || p.id)
        return pd !== botDigits && pd !== superDigits
    }).map(p => p.jid || p.id)

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