import fs from 'fs'
import axios from 'axios'

// RUTA ESPECÍFICA EN LA CARPETA JSON
const jsonPath = '/home/ninegamer982/GateRory-Mercury-Bot/src/json/ppcp_data.json'

let handler = async (m, { conn, usedPrefix, command, text }) => {
    const admin = '584142921488@s.whatsapp.net'
    
    // Lista fija original
    const linksViejos = [
        "https://64.media.tumblr.com/36585de21d219d75fbd4e5b30ba4943b/3245258cd4fda95e-95/s400x600/80dae6703babad71638c72fe5f15d42246336afa.jpg", "https://64.media.tumblr.com/4254cb81f2c28e1de38d217a78ac286c/3245258cd4fda95e-1d/s400x600/9d3139824d01e64fd753fed4f23726c2b42d2aec.jpg",
        "https://64.media.tumblr.com/5d6afa09eec2902062640f526ffa4e41/3245258cd4fda95e-d9/s400x600/a641736698e5dbc057b06dad0fc8642a60befabe.jpg", "https://64.media.tumblr.com/e4ea7938a9f3df0321c5769ffe325ee8/3245258cd4fda95e-0b/s400x600/f037c3f6a6050540676e9d94f768841362ccd9d2.jpg",
        "https://64.media.tumblr.com/ac1f909d7e7d2864f94981483915f404/3245258cd4fda95e-f2/s400x600/37fca98c47d1b37fb49c992c02d7b42810c56c48.jpg", "https://64.media.tumblr.com/7243b3e590ad3c1fe0919530b2255fb1/3245258cd4fda95e-2a/s400x600/213ddd61439f6bf589ce1037be7f231edff3429d.jpg",
        "https://64.media.tumblr.com/bdbf47fa1d9c31a93278a9180395b5af/3245258cd4fda95e-cc/s400x600/d14498789205a3c6e3c53308732ee18efbfcfa8e.jpg", "https://64.media.tumblr.com/9b7b88ecaa7e4245f679ef91273575fe/3245258cd4fda95e-d4/s400x600/950e1100f0a41ed73325b212dda82e617e0b7714.jpg",
        "https://64.media.tumblr.com/220cdcd720aa137694d392976b06f7e4/3245258cd4fda95e-d8/s400x600/b70a234ad4a1524fa667cbd3f1b7c53deb65ecd1.jpg", "https://64.media.tumblr.com/334559f0b19c0f907b7c5c3e278d465e/3245258cd4fda95e-71/s400x600/3c131f599e010aa1170b89e51dfcaa3336ffc397.jpg",
        "https://64.media.tumblr.com/f491f391b4815b57e7b822aa0ef7b5a6/f90446d882b71a19-47/s400x600/9f6bfc4abe9818acb415eeee7039d17a5504b705.jpg", "https://64.media.tumblr.com/4df8b7e87869f2aaf3d824e1a3c61f06/f90446d882b71a19-95/s400x600/659bec4e02232e69deab884b518f49e7a1c55645.jpg",
        "https://64.media.tumblr.com/2b2241c7234d73301dfc156f50ce8202/eadc710a10c3db20-6f/s400x600/5a150648eb6d0422f2fc3c934c657e0fc39c8d10.jpg", "https://64.media.tumblr.com/69bd369dac4f63a4fa90ca0ff12c377e/eadc710a10c3db20-ed/s400x600/45c960a1a710fb4eb54a959df9c593ede12dcb8d.jpg",
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSsHY3zWMHWodzhDT3j8FL4uTXR7sbacR6lBQ&s", "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQOkWdHe_ku89SyOLl5DnWuH7t0eQN06azATQ&s"
    ];

    if (command === 'ppcp' || command === 'ppccpp') {
        let linksNuevos = []
        if (fs.existsSync(jsonPath)) {
            try {
                linksNuevos = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
            } catch (e) {
                console.error("Error leyendo JSON:", e)
            }
        }
        
        let todosLosLinks = [...linksViejos, ...linksNuevos]
        let index = Math.floor(Math.random() * (todosLosLinks.length / 2)) * 2
        
        // --- CAMBIO PARA ENVÍO GRUPAL ---
        const medias = [
            { type: 'image', data: { url: todosLosLinks[index] } },
            { type: 'image', data: { url: todosLosLinks[index + 1] } }
        ]
        const caption = '👤 *Fotos para Compartir*'
        await conn.sendSylphy(m.chat, medias, { caption, quoted: m })
        return
    }

    if (command === 'sugerirlink') {
        let link = text?.trim()
        if (!link || !link.includes('http')) return m.reply('Manda el enlace directo de la imagen.')

        try {
            let res = await axios.head(link)
            if (!res.headers['content-type']?.includes('image')) return m.reply('⚠️ No es una imagen directa.')
        } catch (e) {
            return m.reply('❌ Link roto.')
        }

        conn.sugerirpp = conn.sugerirpp || {}
        if (conn.sugerirpp[m.sender]) {
            let cap = `╭━━━[ 📥 REVISIÓN DE ENLACES ]━━━╮\n┃\n`
            cap += `┣ • *1:* ${conn.sugerirpp[m.sender]}\n`
            cap += `┣ • *2:* ${link}\n┃\n`
            cap += `┣ > _Responde "aceptar" para guardar._\n╰━━━━━━━━━━━━━━━━━━━━╯`
            await conn.sendMessage(admin, { text: cap })
            delete conn.sugerirpp[m.sender]
            return m.reply('✅ Enviado al admin.')
        }
        conn.sugerirpp[m.sender] = link
        m.reply('📸 Foto 1 lista. Pasa el segundo link.')
    }
}

handler.before = async (m, { conn }) => {
    const admin = '525656953441@s.whatsapp.net'
    if (m.sender !== admin || !m.quoted || !m.text || m.text.toLowerCase().trim() !== 'aceptar') return false
    if (!m.quoted.text.includes('REVISIÓN DE ENLACES')) return false

    let links = m.quoted.text.match(/https?:\/\/[^\s\n]+/g)
    if (!links || links.length < 2) return

    try {
        let data = []
        if (fs.existsSync(jsonPath)) {
            data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
        }
        
        data.push(links[0], links[1])
        fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2))
        
        m.reply('✅ Dúo guardado en /src/json/ppcp_data.json exitosamente. v:')
    } catch (e) {
        m.reply('❌ Error al guardar datos en el JSON.')
    }
}

handler.command = ['ppcp', 'ppccpp', 'sugerirlink']
export default handler