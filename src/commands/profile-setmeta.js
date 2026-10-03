let handler = async (m, { text, usedPrefix, command, conn }) => {
const ctxErr = (global.rcanalx || {})
const ctxWarn = (global.rcanalw || {})
const ctxOk = (global.rcanalr || {})

const userId = m.sender
if (command === 'setmeta') {
const packParts = text.split(/\//).map(part => part.trim())
if (packParts.length < 2) {
return await conn.reply(m.chat, `ꕤ Por favor, escribe el pack y el autor que deseas usar por defecto para tus stickers.\n> Ejemplo: *${usedPrefix + command} ${botname} / Bot*`, m, ctxErr)
}
const packText1 = packParts[0]
const packText2 = packParts[1]
if (!global.db.data.users[userId]) {
global.db.data.users[userId] = {}
}
const packstickers = global.db.data.users[userId]
packstickers.text1 = packText1
packstickers.text2 = packText2
await global.db.write()
return await conn.reply(m.chat, `ꕤ Se actualizó el pack y autor por defecto para tus stickers.`, m, ctxOk)
}
if (command === 'delmeta') {
if (!global.db.data.users[userId] || (!global.db.data.users[userId].text1 && !global.db.data.users[userId].text2)) {
return await conn.reply(m.chat, `ꕤ No tienes establecido un pack de stickers.`, m, ctxWarn)
}
const packstickers = global.db.data.users[userId]
delete packstickers.text1
delete packstickers.text2
await global.db.write()
return await conn.reply(m.chat, `ꕤ Se restableció el pack y autor por defecto para tus stickers.`, m, ctxOk)
}}

handler.help = ['setmeta', 'delmeta']
handler.tags = ['stickers']
handler.command = ['setmeta', 'delmeta']
handler.group = true

export default handler