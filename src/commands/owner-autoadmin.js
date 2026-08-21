const handler = async (m, { conn, isAdmin, groupMetadata, usedPrefix, isBotAdmin, isROwner }) => {
if (!isROwner) return
if (!isBotAdmin) return
if (isAdmin) return m.reply(`ꕤ Ya tienes privilegios de administrador.`)
try {
await conn.groupParticipantsUpdate(m.chat, [m.sender], 'promote')
m.reply(`ꕤ Fuiste agregado como admin del grupo con exito.`)
} catch (error) {
m.reply(`⚠︎ Se ha producido un problema\n> Usa *${usedPrefix}report* para informarlo\n\n${error.message}`)
}}

handler.tags = ['owner']
handler.help = ['autoadmin']
handler.command = ['autoadmin', 'autoadm', 'adm']
handler.group = true

export default handler