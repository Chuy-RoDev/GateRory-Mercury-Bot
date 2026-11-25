const handler = async (m, { conn, text, usedPrefix, command, args, isROwner }) => {
if (!isROwner) return
const bot = conn.user.jid.split('@')[0]
const users = global.db.data.users
const chats = global.db.data.chats
function no(number) { return number.replace(/\s/g, '').replace(/([@+-])/g, '') }
try {
let mentionedJid = await m.mentionedJid
let who = mentionedJid[0] ? mentionedJid[0] : m.quoted ? await m.quoted.sender : text ? no(text.split(' ')[0]) + '@s.whatsapp.net' : false
switch (command) {
case 'banned': {
if (!who) return conn.reply(m.chat, 'ꕤ Por favor, etiqueta, cita o escribe el número del usuario que quieres banear del Bot.', m)
var reason = 'Sin Especificar'
if (mentionedJid && mentionedJid[0]) {
var mentionIdx = args.findIndex(arg => arg.startsWith('@'))
var reasonArgs = args.slice(mentionIdx + 1).join(' ')
if (reasonArgs.trim()) reason = reasonArgs.trim()
} else if (m.quoted) {
if (args.length) reason = args.join(' ')
} else if (text) {
var parts = text.trim().split(' ')
if (parts.length > 1) reason = parts.slice(1).join(' ')
}
if (who === conn.user.jid) return conn.reply(m.chat, `ꕤ @${bot} No puede ser baneado.`, m, { mentions: [who] })
if (global.esOwnerJid(who)) {
return conn.reply(m.chat, `ꕤ No puedo banear al propietario @${who.split('@')[0]} de *@${bot}*.`, m, { mentions: [who, bot] })
}
if (!users[who]) users[who] = {}
if (users[who].banned) return conn.reply(m.chat, `ꕤ @${who.split('@')[0]} ya está baneado.`, m, { mentions: [who] })
await m.react('🕒')
users[who].banned = true
users[who].bannedReason = reason
var nameBan = await conn.getName(who)
await m.react('✔️')
await conn.reply(m.chat, `ꕤ ${nameBan} ha sido baneado.\n> Razón: ${reason}`, m, { mentions: [who] })
await conn.reply(`${suittag}@s.whatsapp.net`, `ꕤ ${nameBan} fue baneado por ${await conn.getName(m.sender)}\n> ✦ Razón: ${reason}`, m)
break
}
case 'unban': {
if (!who) return conn.reply(m.chat, 'ꕤ Por favor, etiqueta o coloca el número del usuario que quieres desbanear del Bot.', m)
if (!users[who]) return m.reply('ꕤ El usuario no está registrado.', m)
if (!users[who].banned) return m.reply(`ꕤ @${who.split('@')[0]} no está baneado.`, m, { mentions: [who] })
await m.react('🕒')
users[who].banned = false
users[who].bannedReason = ''
await m.react('✔️')
let nameUnban = await conn.getName(who)
await conn.reply(m.chat, `ꕤ ${nameUnban} ha sido desbaneado.`, m, { mentions: [who] })
await conn.reply(`${suittag}@s.whatsapp.net`, `ꕤ ${nameUnban} fue desbaneado por ${await conn.getName(m.sender)}.`, m)
break
}
case 'block': {
if (!who) return conn.reply(m.chat, 'ꕤ Por favor, menciona al usuario que quieres bloquear del número de la Bot.', m)
await m.react('🕒')
await conn.updateBlockStatus(who, 'block')
await m.react('✔️')
conn.reply(m.chat, `ꕤ Bloqueado correctamente a @${who.split('@')[0]}`, m, { mentions: [who] })
break
}
case 'unblock': {
if (!who) return conn.reply(m.chat, 'ꕤ Por favor, menciona al usuario que quieres desbloquear del número de la Bot.', m)
await m.react('🕒')
await conn.updateBlockStatus(who, 'unblock')
await m.react('✔️')
conn.reply(m.chat, `ꕤ Desbloqueado correctamente a @${who.split('@')[0]}`, m, { mentions: [who] })
break
}
case 'banlist': {
await m.react('🕒')
const bannedUsers = Object.entries(users).filter(([_, data]) => data.banned)
const bannedChats = Object.entries(chats).filter(([_, data]) => data.isBanned)
const usersList = bannedUsers.map(([jid]) => {
const num = jid.split('@')[0]
return `▢ @${num}`
})
const chatsList = bannedChats.map(([jid]) => {
return `▢ ${jid}`
})
const bannedText = `✦ Usuarios Baneados • Total: ${bannedUsers.length}\n${usersList.join('\n')}\n\n✧ Chats Baneados • Total: ${bannedChats.length}\n${chatsList.join('\n')}`.trim()
const mentions = [...bannedUsers.map(([jid]) => jid), ...bannedChats.map(([jid]) => jid)]
await m.react('✔️')
conn.reply(m.chat, bannedText, m, { mentions })
break
}
case 'blocklist': {
await m.react('🕒')
const blocklist = await conn.fetchBlocklist()
let listText = `≡ *Lista de bloqueados*\n\n*Total :* ${blocklist.length}\n\n┌─⊷\n`
for (const i of blocklist) {
let num = i.split('@')[0]
listText += `▢ @${num}\n`
}
listText += '└───────────'
await m.react('✔️')
conn.reply(m.chat, listText, m, { mentions: blocklist })
break
}}} catch (e) {
await m.react('✖️')
return m.reply(`⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n` + (e.message || e))
}}

handler.help = ['banned', 'unban', 'block', 'unblock', 'banlist', 'blocklist']
handler.tags = ['mods']
handler.command = ['banned', 'unban', 'block', 'unblock', 'banlist', 'blocklist']

export default handler
