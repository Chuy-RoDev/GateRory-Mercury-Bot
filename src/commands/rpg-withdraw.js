let handler = async (m, { args, usedPrefix, command }) => {
    if (!db.data.chats[m.chat].economy && m.isGroup) {
        return m.reply(`ꕤ Los comandos de *Economía* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con el comando:\n» *${usedPrefix}economy on*`)
    }
    
    const userCurrency = global.getUserCurrency ? global.getUserCurrency(m.sender) : global.currency
    
    let user = global.db.data.users[m.sender]
    if (!args[0]) return m.reply(`ꕤ Ingresa la cantidad de *${userCurrency}* que deseas retirar.`)
    if (args[0] == 'all') {
        let count = parseInt(user.bank)
        user.bank -= count * 1
        user.coin += count * 1
        await m.reply(`ꕤ Retiraste *$${count.toLocaleString()} ${userCurrency}* del banco, ahora podras usarlo pero tambien podran robartelo.`)
        return !0
    }
    if (!Number(args[0])) return m.reply(`ꕤ Debes retirar una cantidad válida.\n > Ejemplo 1 » *${usedPrefix + command} $25000*\n> Ejemplo 2 » *${usedPrefix + command} all*`)
    let count = parseInt(args[0])
    if (!user.bank) return m.reply(`ꕤ No tienes suficientes *${userCurrency}* en el Banco.`)
    if (user.bank < count) return m.reply(`ꕤ Solo tienes *$${user.bank.toLocaleString()} ${userCurrency}* en el Banco.`)
    user.bank -= count * 1
    user.coin += count * 1
    await m.reply(`ꕤ Retiraste *$${count.toLocaleString()} ${userCurrency}* del banco, ahora podras usarlo pero tambien podran robartelo.`)
}

handler.help = ['retirar']
handler.tags = ['rpg']
handler.command = ['withdraw', 'retirar', 'with']
handler.group = true

export default handler