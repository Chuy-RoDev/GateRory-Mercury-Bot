import fetch from 'node-fetch'
import { exec } from 'child_process'
import { writeFileSync, readFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

let handler = async (m, { conn }) => {
    const doc = `> *─── [ 🐈‍⬛ RORY MERCURY BOT ] ───*\n\n` +
        `❀ *𝗖𝗥𝗘𝗔𝗗𝗢𝗥𝗔 & 𝗠𝗢𝗗𝗘𝗔𝗗𝗢*\n` +
        `» Arlette-Xz, Modeado por Pérez/Chuy\n` +
        `» https://github.com/Arlette-Xz/Shiroko-Bot/\n\n` +
        `🛠️ *𝗖𝗢𝗟𝗔𝗕𝗢𝗥𝗔𝗖𝗜𝗢𝗡𝗘𝗦*\n` +
        `» Midnight Sociecity\n\n` +
        `📜 *𝗗𝗘𝗖𝗟𝗔𝗥𝗔𝗖𝗜𝗢𝗡*\n` +
        `_Todos los créditos van a sus respectivos modders y devs. Este proyecto está usando la base del Shiroko-Bot cuyo enlace está arriba. Esta es una versión mejorada y personalizada. Si algún dev me pide que lo borre, con gusto lo haré._ 🖤\n\n` +
        `© _Powered by Arlette Xz, Pérez/Chuy & Midnight Sociecity_`

    try {
        const gifUrl = 'https://c.tenor.com/JhjlD_2l5D8AAAAd/tenor.gif'
        const gifPath = join(tmpdir(), `credits_${Date.now()}.gif`)
        const mp4Path = join(tmpdir(), `credits_${Date.now()}.mp4`)

        // Descargar gif
        const res = await fetch(gifUrl)
        const buffer = await res.buffer()
        writeFileSync(gifPath, buffer)

        // Convertir a mp4 con ffmpeg
        await new Promise((resolve, reject) => {
            exec(`ffmpeg -i ${gifPath} -movflags faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" ${mp4Path} -y`, (err) => {
                if (err) reject(err)
                else resolve()
            })
        })

        const mp4Buffer = readFileSync(mp4Path)

        await conn.sendMessage(m.chat, {
            video: mp4Buffer,
            caption: doc,
            gifPlayback: true,
            mimetype: 'video/mp4'
        }, { quoted: m })

        // Limpiar archivos temporales
        unlinkSync(gifPath)
        unlinkSync(mp4Path)

    } catch (e) {
        console.error(e)
        // Fallback sin gif
        m.reply(doc)
    }
}

handler.help = ['creditos']
handler.tags = ['main']
handler.command = ['creditos', 'credits', 'cresitos']
export default handler