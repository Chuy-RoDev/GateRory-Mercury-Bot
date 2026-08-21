const handler = async (m, { conn, usedPrefix, command, args, isOwner, isAdmin }) => {
    const chat = global.db.data.chats[m.chat] = global.db.data.chats[m.chat] || {}
    const primaryBot = chat.primaryBot
    if (primaryBot && conn.user.jid !== primaryBot) return

    const type = command.toLowerCase()
    const nombreBot = 'Shiroko'
    
    const configMap = {
        welcome: ['welcome', 'bienvenida'],
        antiLink: ['antilink', 'antienlace', 'antilinks'],
        nsfw: ['nsfw', 'modohorny'],
        detect: ['detect', 'alertas'],
        modoadmin: ['modoadmin', 'onlyadmin'],
        economy: ['economy', 'economia'],
        gacha: ['rpg', 'gacha']
    }

    let propName = type
    for (const [property, commands] of Object.entries(configMap)) {
        if (commands.includes(type)) {
            propName = property
            break
        }
    }

    const currentState = chat[propName] || false

    if (args[0] === 'on' || args[0] === 'enable') {
        if (currentState === true) return conn.reply(m.chat, `ꕤ *${type}* ya estaba *activado*.`, m)
        chat[propName] = true
    } else if (args[0] === 'off' || args[0] === 'disable') {
        if (currentState === false) return conn.reply(m.chat, `ꕤ *${type}* ya estaba *desactivado*.`, m)
        chat[propName] = false
    } else {
        const getExplanation = (cmd) => {
            switch (cmd) {
                case 'welcome': case 'bienvenida': return `Si la *bienvenida* está activada, *${nombreBot}* recibirá con un mensaje a los nuevos usuarios.`
                case 'antilink': case 'antienlace': return `Si el *antienlace* está activado, *${nombreBot}* eliminará a quienes envíen links de otros grupos.`
                case 'modoadmin': case 'onlyadmin': return `Si el *Modo Admin* está activado, *solo los administradores* podrán usar los comandos de *${nombreBot}*.`
                case 'nsfw': case 'modohorny': return `Si el *modo nsfw* está activado, los comandos para adultos de *${nombreBot}* serán accesibles.`
                default: return `Configura las funciones de *${nombreBot}* en este grupo.`
            }
        }

        const message = `❒ Un administrador puede activar o desactivar el *${command}* utilizando:

✐ _Activar_ » *${usedPrefix}${command} enable*
✐ _Desactivar_ » *${usedPrefix}${command} disable*

✰ Estado actual: *${currentState ? '✓ Activado' : '✗ Desactivado'}*
> ${getExplanation(type)}`

        return conn.reply(m.chat, message, m)
    }

    if (m.isGroup && !isAdmin && !isOwner) return global.dfail('admin', m, conn)
    conn.reply(m.chat, `ꕤ Has *${chat[propName] ? 'activado' : 'desactivado'}* el *${type}* para *${nombreBot}* en este grupo.`, m)
}

handler.help = ['welcome', 'antilink', 'nsfw', 'detect', 'modoadmin']
handler.tags = ['nable']
handler.command = ['welcome', 'bienvenida', 'antilink', 'antienlace', 'nsfw', 'modohorny', 'detect', 'alertas', 'modoadmin', 'onlyadmin', 'economy', 'economia', 'rpg', 'gacha']
handler.group = true

export default handler
