async function handler(m, { usedPrefix }) {
    await m.reply(`Tas bien pendejo o que hijo, usa ${usedPrefix}infobot`)
}

handler.help = ['owner', 'creador', 'creator']
handler.tags = ['main']
handler.command = ['owner', 'creador', 'creator']

export default handler