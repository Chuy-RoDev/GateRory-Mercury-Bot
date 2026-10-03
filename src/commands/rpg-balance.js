let handler = async (m, { conn, usedPrefix }) => {
    if (!db.data.chats[m.chat].economy && m.isGroup) {
        return m.reply(`ꕤ Los comandos de *Economía* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con el comando:\n» *${usedPrefix}economy on*`)
    }
    
    const userCurrency = global.getUserCurrency ? global.getUserCurrency(m.sender) : global.currency
    
    // Detección mejorada de menciones
    let mentionedJid = await m.mentionedJid
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

    let who = targetRaw || m.sender
    
    if (who.includes('@lid') || !who.includes('@s.whatsapp.net')) {
        try {
            const meta = await conn.groupMetadata(m.chat)
            const found = meta.participants.find(p =>
                p.lid === who ||
                p.jid === who ||
                p.id === who ||
                p.lid?.split('@')[0] === who.split('@')[0] ||
                p.jid?.split('@')[0] === who.split('@')[0]
            )
            if (found) who = found.jid || found.id || who
        } catch {
            who = who
        }
    }

    let name = await global.getProperName(conn, who)
    
    if (!(who in global.db.data.users)) return m.reply(`ꕤ El usuario no se encuentra en mi base de datos.`)
    
    let user = global.db.data.users[who]
    let coin = user.coin || 0
    let bank = user.bank || 0
    let total = (user.coin || 0) + (user.bank || 0)
    const texto = `ᥫ᭡ Informacion -  Balance ❀
 
ᰔᩚ Usuario » *${name}*   
⛀ Cartera » *$${coin.toLocaleString()} ${userCurrency}*
⚿ Banco » *$${bank.toLocaleString()} ${userCurrency}*
⛁ Total » *$${total.toLocaleString()} ${userCurrency}*

> *Para proteger tu dinero, ¡depósitalo en el banco usando *${usedPrefix}deposit*`
    await conn.reply(m.chat, texto, m, { mentions: [who] })
}

handler.help = ['bal']
handler.tags = ['rpg']
handler.command = ['bal', 'balance', 'bank'] 
handler.group = true 

export default handler