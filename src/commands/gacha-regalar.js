import { promises as fs } from 'fs'

let handler = async (m, { conn, args, usedPrefix, command, text }) => {
    // 1. EXTRAER EL USUARIO (Inspirado en tu /kick + Fix de número)
    let mentionedJid = await m.mentionedJid
    let user = mentionedJid && mentionedJid.length ? mentionedJid[0] : (m.quoted && m.quoted.sender ? m.quoted.sender : null)

    // Si no hay mención azul ni reply, buscamos el número con @ o solo
    if (!user && args.length > 0) {
        let num = text.replace(/[^0-9]/g, '')
        if (num.length >= 10) user = num + (num.length > 15 ? '@lid' : '@s.whatsapp.net')
    }

    if (!user) return m.reply(`ꕤ Debes mencionar a un usuario o escribir su número para regalarle algo. Pe.`)
    if (user === m.sender) return m.reply('ꕤ No te lo puedes regalar a ti mismo v:')

    // 2. EXTRAER EL NOMBRE DEL PERSONAJE
    // Limpiamos el texto de menciones y números para quedarnos solo con el nombre
    let characterName = text.replace(/@[0-9]+/g, '').replace(/[0-9]{10,}/g, '').trim().toLowerCase()
    if (!characterName) return m.reply('ꕤ Escribe el nombre de la waifu. Pe.')

    try {
        const characters = global.db?.data?.characters || {}
        const characterId = Object.keys(characters).find(id => {
            const char = characters[id]
            return char.user === m.sender && char.name.toLowerCase().includes(characterName)
        })

        if (!characterId) return m.reply(`ꕤ No encontré a *${characterName}* en tu inventario.`)

        // 3. TRANSFERENCIA
        const characterData = characters[characterId]
        characterData.user = user 

        // Actualizar base de datos de usuarios
        if (!global.db.data.users[user]) global.db.data.users[user] = { characters: [] }
        if (!global.db.data.users[user].characters.includes(characterId)) {
            global.db.data.users[user].characters.push(characterId)
        }
        
        if (global.db.data.users[m.sender]?.characters) {
            global.db.data.users[m.sender].characters = global.db.data.users[m.sender].characters.filter(id => id !== characterId)
        }

        // 4. CONFIRMACIÓN (Como en tu /kick)
        let target = user.split('@')[0]
        await conn.reply(m.chat, `ꕤ *${characterData.name}* ha sido enviado a @${target} con éxito.`, m, { mentions: [user] })

    } catch (e) {
        conn.reply(m.chat, `⚠︎ Error: ${e.message}`, m)
    }
}

handler.help = ['regalar']
handler.tags = ['gacha']
handler.command = ['regalar']
handler.group = true

export default handler