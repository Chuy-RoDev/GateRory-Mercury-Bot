let handler = async (m, { conn, args, usedPrefix, command, isAdmin, isBotAdmin }) => {
    if (!isBotAdmin) return conn.reply(m.chat, `ꕤ Necesito ser *administrador* para usar este comando.`, m)
    if (!isAdmin) return conn.reply(m.chat, `ꕤ Solo *administradores* pueden usar este comando.`, m)

    if (!global.db.data.mutedUsers) global.db.data.mutedUsers = {}
    const mutedUsers = global.db.data.mutedUsers

    const mentionedJid = await m.mentionedJid
    let targetRaw = (Array.isArray(mentionedJid) && mentionedJid.length)
        ? mentionedJid[0]
        : null

    if (targetRaw && targetRaw.includes('@lid')) {
        try {
            const meta = await conn.groupMetadata(m.chat)
            const found = meta.participants.find(p =>
                p.lid === targetRaw ||
                p.lid?.split('@')[0] === targetRaw.split('@')[0]
            )
            if (found) targetRaw = found.jid || found.id || targetRaw
        } catch {}
    }

    if (!targetRaw && m.quoted) {
        targetRaw = await Promise.resolve(m.quoted.sender)
        if (typeof targetRaw !== 'string') {
            targetRaw = targetRaw?.jid || targetRaw?.id || String(targetRaw)
        }
    }

    if (!targetRaw) {
        return conn.reply(m.chat, `ꕤ Menciona o cita al usuario.\n> *${usedPrefix}mute @usuario <minutos>*`, m)
    }

    let target = targetRaw
    if (targetRaw.includes('@lid') || !targetRaw.includes('@s.whatsapp.net')) {
        try {
            const meta = await conn.groupMetadata(m.chat)
            const found = meta.participants.find(p =>
                p.lid === targetRaw ||
                p.jid === targetRaw ||
                p.id === targetRaw ||
                p.lid?.split('@')[0] === targetRaw.split('@')[0] ||
                p.jid?.split('@')[0] === targetRaw.split('@')[0]
            )
            if (found) target = found.jid || found.id || targetRaw
        } catch {
            target = targetRaw
        }
    }

    const key = `${m.chat}:${target}`
    const isUnmute = /^(unmute|desmutear|desmute)$/i.test(command)

    if (isUnmute) {
        if (!mutedUsers[key]) {
            return conn.reply(m.chat, `ꕤ @${target.split('@')[0]} no está muteado.`, m, { mentions: [target] })
        }
        if (mutedUsers[key].timer) clearTimeout(mutedUsers[key].timer)
        delete mutedUsers[key]
        await global.db.write()
        return conn.reply(m.chat, `ꕤ @${target.split('@')[0]} puede hablar de nuevo. 🔊`, m, { mentions: [target] })
    }

    const minutosArg = args.find(a => !isNaN(a) && parseInt(a) > 0)
    const minutos = minutosArg ? parseInt(minutosArg) : null

    if (mutedUsers[key]?.timer) clearTimeout(mutedUsers[key].timer)

    mutedUsers[key] = {
        chat: m.chat,
        expire: minutos ? Date.now() + minutos * 60 * 1000 : -1,
        timer: null
    }

    if (minutos) {
        mutedUsers[key].timer = setTimeout(async () => {
            delete mutedUsers[key]
            await global.db.write()
            conn.reply(m.chat, `ꕤ El mute de @${target.split('@')[0]} ha terminado. 🔊`, null, { mentions: [target] })
        }, minutos * 60 * 1000)
    }

    await global.db.write()

    const duracion = minutos ? `*${minutos} minutos*` : '*indefinido*'
    conn.reply(
        m.chat,
        `ꕤ @${target.split('@')[0]} ha sido muteado. 🔇\n> *Duración:* ${duracion}\n> _Sus mensajes serán eliminados._`,
        m,
        { mentions: [target] }
    )
}

handler.help = ['mute', 'unmute']
handler.tags = ['grupo']
handler.command = ['mute', 'unmute', 'desmutear', 'desmute']
handler.group = true
handler.admin = true
handler.botAdmin = true

export default handler