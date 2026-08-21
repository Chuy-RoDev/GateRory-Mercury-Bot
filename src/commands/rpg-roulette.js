const handler = async (m, { conn, text, command, usedPrefix }) => {
    if (!db.data.chats[m.chat].economy && m.isGroup) {
        return m.reply(`ꕤ Los comandos de *Economía* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con el comando:\n» *${usedPrefix}economy on*`)
    }
    
    const userCurrency = global.getUserCurrency ? global.getUserCurrency(m.sender) : global.currency
    
    const users = global.db.data.users[m.sender]
    if (!text) return conn.reply(m.chat, `ꕤ Debes ingresar una cantidad de *${userCurrency}* y apostar a un color.\n> ejemplo: *${usedPrefix + command} 2500 red*`, m)
    let args = text.trim().split(" ")
    if (args.length !== 2) return conn.reply(m.chat, `ꕤ Formato incorrecto. Debes ingresar una cantidad de *${userCurrency}* y apostar a un color.\n> ejemplo: *${usedPrefix + command} 2500 red*`, m)
    let coin = parseInt(args[0])
    let color = args[1].toLowerCase()
    if (isNaN(coin) || coin <= 0) return conn.reply(m.chat, `ꕤ Por favor, ingresa una cantidad válida para la apuesta.`, m)
    if (!(color === 'black' || color === 'red')) return conn.reply(m.chat, `ꕤ Debes apostar a un color válido: *black* o *red*.`, m)
    if (coin > users.coin) return conn.reply(m.chat, `ꕤ No tienes suficientes *${userCurrency}* para realizar esa apuesta.`, m)
    const resultColor = Math.random() < 0.5 ? 'black' : 'red'
    const win = color === resultColor
    if (win) {
        users.coin += coin
        conn.reply(m.chat, `「✿」La ruleta salió en *${resultColor}* y has ganado *$${coin.toLocaleString()} ${userCurrency}*!`, m)
    } else {
        users.coin -= coin
        conn.reply(m.chat, `「✿」La ruleta salió en *${resultColor}* y has perdido *$${coin.toLocaleString()} ${userCurrency}*!`, m)
    }
}

handler.tags = ['economy']
handler.help = ['ruleta']
handler.command = ['ruleta', 'roulette', 'rt']
handler.group = true

export default handler