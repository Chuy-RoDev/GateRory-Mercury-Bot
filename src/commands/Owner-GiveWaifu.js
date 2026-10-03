import { join } from "path"
import { promises as fs } from 'fs'

let handler = async (m, { conn, text, args }) => {
    const miNumero = '584142921488@s.whatsapp.net'
    if (m.sender !== miNumero) return

    let mentionedJid = await m.mentionedJid
    let user = mentionedJid && mentionedJid.length ? mentionedJid[0] : m.quoted ? m.quoted.sender : null

    if (!user && args.length > 0) {
        let num = text.replace(/[^0-9]/g, '')
        if (num.length >= 10) user = num + (num.length > 15 ? '@lid' : '@s.whatsapp.net')
    }
    if (!user) user = m.sender

    let nombreBusqueda = text.replace(/@[0-9]+/g, '').replace(/[0-9]{10,}/g, '').trim().toLowerCase()
    if (!nombreBusqueda) return m.reply(`╭─「 ⚠︎ 𝗘𝗿𝗿𝗼𝗿 」\n│\n│ ✦ Escribe el nombre del personaje.\n│\n╰─────────────────`)

    try {
        const rutaJson = join(process.cwd(), 'src', 'json', 'characters.json')
        const data = JSON.parse(await fs.readFile(rutaJson, 'utf-8'))

        let personaje = null
        for (const s of Object.values(data)) {
            if (Array.isArray(s.characters)) {
                let p = s.characters.find(c => c.name.toLowerCase().includes(nombreBusqueda))
                if (p) { personaje = p; break }
            }
        }

        if (!personaje) return m.reply(`╭─「 ⚠︎ 𝗘𝗿𝗿𝗼𝗿 」\n│\n│ ✦ _"${nombreBusqueda}"_ no figura en registros.\n│\n╰─────────────────`)

        const id = String(personaje.id)
        if (!global.db.data.users[user]) global.db.data.users[user] = { characters: [] }
        if (!Array.isArray(global.db.data.users[user].characters)) global.db.data.users[user].characters = []

        global.db.data.characters[id] = {
            user,
            name: personaje.name,
            claimedAt: Date.now(),
            value: personaje.value || 100
        }
        if (!global.db.data.users[user].characters.includes(id)) {
            global.db.data.users[user].characters.push(id)
        }

        let nombreTarget = conn.getName(user)

        let txt = `╭─「 💾 𝗜𝗻𝘆𝗲𝗰𝗰𝗶ó𝗻 𝗖𝗼𝗺𝗽𝗹𝗲𝘁𝗮 」\n│\n`
        txt += `│ 👤 *Objetivo:* _${nombreTarget}_\n`
        txt += `│ 📦 *Personaje:* _${personaje.name}_\n`
        txt += `│ ✅ _Base de datos sincronizada._\n│\n`
        txt += `╰─────────────────`

        await conn.reply(m.chat, txt, m, { mentions: [user] })

    } catch (err) {
        m.reply(`╭─「 ⚠︎ 𝗘𝗿𝗿𝗼𝗿 」\n│\n│ ✦ _${err.message}_\n│\n╰─────────────────`)
    }
}

handler.command = ['ogw', 'dar']
export default handler