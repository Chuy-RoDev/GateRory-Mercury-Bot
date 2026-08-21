const handler = async (m, { isOwner, isAdmin, conn, text, participants, args, command }) => {
const pesan = args.join` `
const oi = `*» INFO :* ${pesan}`
let teks = `╭─〔 𝐈𝐍𝐕𝐎𝐂𝐀𝐂𝐈Ó𝐍 𝐆𝐄𝐍𝐄𝐑𝐀𝐋 🦇 〕─⬣\n│ ✨ 𝐌𝐢𝐞𝐦𝐛𝐫𝐨𝐬: ${participants.length}\n│ 💫 ${oi}}\n├─〔 🩸 𝐄𝐓𝐈𝐐𝐔𝐄𝐓𝐀𝐃𝐎𝐒 〕\n`
for (const mem of participants) {
teks += `│@${mem.id.split('@')[0]}\n`
}
teks += `╰─〔 🌑 𝐍𝐎 𝐇𝐀𝐘 𝐄𝐒𝐂𝐀𝐏𝐄 〕─⬣`
conn.sendMessage(m.chat, { text: teks, mentions: participants.map((a) => a.id) })
}

handler.help = ['todos']
handler.tags = ['group']
handler.command = ['todos', 'invocar', 'tagall']
handler.admin = true
handler.group = true

export default handler