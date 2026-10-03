const handler = async (m, { conn, usedPrefix, command }) => {
    if (!db.data.chats[m.chat].economy && m.isGroup) {
        return m.reply(`ꕤ Los comandos de *Economía* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con el comando:\n» *${usedPrefix}economy on*`)
    }
    
    const userCurrency = global.getUserCurrency ? global.getUserCurrency(m.sender) : global.currency
    
    const user = global.db.data.users[m.sender]
    user.lastrob = user.lastrob || 0
    if (Date.now() < user.lastrob) {
        const restante = user.lastrob - Date.now()
        return conn.reply(m.chat, `ꕤ Debes esperar *${formatTime(restante)}* para usar *${usedPrefix + command}* de nuevo.`, m, (global.rcanalr || {}))
    }
    let mentionedJid = await m.mentionedJid
    let who = mentionedJid && mentionedJid.length ? mentionedJid[0] : m.quoted && await m.quoted.sender ? await m.quoted.sender : null
    if (!who) return conn.reply(m.chat, `ꕤ Debes mencionar a alguien para intentar robarle.`, m, (global.rcanalr || {}))
    if (!(who in global.db.data.users)) {
        return conn.reply(m.chat, `ꕤ El usuario no se encuentra en mi base de datos.`, m, (global.rcanalr || {}))
    }
    let name = await (async () => global.db.data.users[who].name || (async () => { try { const n = await conn.getName(who); return typeof n === 'string' && n.trim() ? n : who.split('@')[0] } catch { return who.split('@')[0] } })())()
    const target = global.db.data.users[who]
    const tiempoInactivo = Date.now() - (target.lastwork || 0)
    if (tiempoInactivo < 3600000) {
        return conn.reply(m.chat, `ꕤ Solo puedes robarle *${userCurrency}* a un usuario si estuvo más de 1 hora inactivo.`, m, (global.rcanalr || {}))
    }
    const rob = Math.floor(Math.random() * 1001) + 2000
    if (target.coin < rob) {
        return conn.reply(m.chat, `ꕤ *${name}* no tiene suficientes *${userCurrency}* fuera del banco como para que valga la pena intentar robar.`, m, { mentions: [who] })
    }
    user.coin += rob
    target.coin -= rob
    user.lastrob = Date.now() + 7200000
    conn.reply(m.chat, `ꕤ Le robaste *$${rob.toLocaleString()} ${userCurrency}* a *${name}*`, m, { mentions: [who] })
}

handler.help = ['rob']
handler.tags = ['rpg']
handler.command = ['robar', 'steal', 'rob']
handler.group = true

export default handler

function formatTime(ms) {
    const totalSec = Math.ceil(ms / 1000)
    const hours = Math.floor(totalSec / 3600)
    const minutes = Math.floor((totalSec % 3600) / 60)
    const seconds = totalSec % 60
    const parts = []
    if (hours) parts.push(`${hours} hora${hours !== 1 ? 's' : ''}`)
    if (minutes) parts.push(`${minutes} minuto${minutes !== 1 ? 's' : ''}`)
    parts.push(`${seconds} segundo${seconds !== 1 ? 's' : ''}`)
    return parts.join(' ')
}