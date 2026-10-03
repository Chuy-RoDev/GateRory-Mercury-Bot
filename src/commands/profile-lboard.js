import { xpRange } from '../../lib/levelling.js'

let handler = async (m, { conn, args }) => {
let users = Object.entries(global.db.data.users).map(([key, value]) => ({ ...value, jid: key }))
let sorted = users.sort((a, b) => (b.exp || 0) - (a.exp || 0))
const page = Math.max(1, Math.min(parseInt(args[0]) || 1, Math.ceil(sorted.length / 10)))
const startIndex = (page - 1) * 10
const endIndex = startIndex + 10
let text = `◢✿ Top de usuarios con más experiencia ✿◤\n\n`
const slice = sorted.slice(startIndex, endIndex)
for (let i = 0; i < slice.length; i++) {
const { jid, exp, level } = slice[i]
let name = await global.getProperName(conn, jid)
text += `✰ ${startIndex + i + 1} » *${name}*\n`
text += `\t\t❖ XP » *${exp.toLocaleString()}*  ❖ LVL » *${level}*\n`
}
text += `\n> • Página *${page}* de *${Math.ceil(sorted.length / 10)}*`
if (page < Math.ceil(sorted.length / 10)) text += `\n> Para ver la siguiente página » */leaderboard ${page + 1}*`
await conn.reply(m.chat, text.trim(), m, { mentions: conn.parseMention(text) })
}

handler.help = ['lboard']
handler.tags = ['rpg']
handler.command = ['lboard', 'topexp', 'lb']
handler.group = true

export default handler