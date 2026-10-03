let handler = async (m, { args, usedPrefix, command }) => {
    if (!db.data.chats[m.chat].economy && m.isGroup) {
        return m.reply(`ꕤ Los comandos de *Economía* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con el comando:\n» *${usedPrefix}economy on*`)
    }
    
    const userCurrency = global.getUserCurrency ? global.getUserCurrency(m.sender) : global.currency
    
    let user = global.db.data.users[m.sender]
    if (!args[0]) return m.reply(`ꕤ Ingresa la cantidad de *${userCurrency}* que deseas Depositar.`)
    if ((args[0]) < 1) return m.reply(`ꕤ Ingresa una cantidad válida de *${userCurrency}*.`)
    if (args[0] == 'all') {
        let count = parseInt(user.coin)
        user.coin -= count * 1
        user.bank += count * 1
        await m.reply(`ꕤ Depositaste *${count.toLocaleString()} ${userCurrency}* en el banco, ya no podran robartelo.`)
        return !0
    }
    if (!Number(args[0])) return m.reply(`ꕤ Debes depositar una cantidad válida.\n> Ejemplo 1 » *${usedPrefix}d 25000*\n> Ejemplo 2 » *${usedPrefix}d all*`)
    let count = parseInt(args[0])
    if (!user.coin) return m.reply(`ꕤ No tienes suficientes *${userCurrency}* la Cartera.`)
    if (user.coin < count) return m.reply(`✧ Solo tienes *$${user.coin.toLocaleString()} ${userCurrency}* en la Cartera.`)
    user.coin -= count * 1
    user.bank += count * 1
    await m.reply(`ꕤ Depositaste *$${count.toLocaleString()} ${userCurrency}* en el banco, ya no podran robartelo.`)
}

handler.help = ['depositar']
handler.tags = ['rpg']
handler.command = ['deposit', 'depositar', 'd', 'dep']
handler.group = true

export default handler