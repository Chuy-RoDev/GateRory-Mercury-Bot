import { promises as fs } from 'fs'
import path from 'path'
import cp from 'child_process'
import { promisify } from 'util'
import moment from 'moment-timezone'

const exec = promisify(cp.exec).bind(cp)
const linkRegex = /https:\/\/chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/i

const handler = async (m, { conn, text, command }) => {
   
const receptor = Array.isArray(global.suittag) 
    ? global.suittag[0].replace(/[^0-9]/g, '') 
    : String(global.suittag || '').replace(/[^0-9]/g, '') || conn.user.jid.split('@')[0]

    try {
        const nombre = m.pushName || 'Anónimo'
        const tag = '@' + m.sender.split('@')[0]
        const horario = moment.tz('America/Caracas').format('DD/MM/YYYY hh:mm:ss A')
        const chatLabel = m.isGroup ? (conn.chats[m.chat]?.name || 'Grupal') : 'Privado'

        switch (command) {
            case 'suggest':
            case 'sug': {
                if (!text || text.length < 10) {
                    return m.reply(!text ? 
                        'ꕤ Escribe la sugerencia que quieres enviar al propietario del Bot.' : 
                        'ꕤ La sugerencia debe tener más de 10 caracteres.')
                }
                
                const sug = `❏ *SUGERENCIA RECIBIDA*\n──────────────────\n> ꕤ *Usuario:* ${nombre}\n> ✩ *Tag:* ${tag}\n> ✿ *Sugerencia:* _${text}_\n> ✦ *Chat:* ${chatLabel}\n> ✰ *Fecha:* ${horario}`
                
                await conn.sendMessage(`${receptor}@s.whatsapp.net`, { 
                    text: sug, 
                    mentions: [m.sender] 
                }, { quoted: m })
                
                m.reply('ꕤ La sugerencia ha sido enviada al desarrollador. Gracias por contribuir.')
                break
            }

            case 'report':
            case 'reportar': {
                if (!text || text.length < 10) {
                    return m.reply(!text ? 
                        'ꕤ Por favor, ingresa el error que deseas reportar.' : 
                        'ꕤ Especifique mejor el error, mínimo 10 caracteres.')
                }
                
                const rep = `❏ *REPORTE RECIBIDO*\n──────────────────\n> ꕤ *Usuario:* ${nombre}\n> ✩ *Tag:* ${tag}\n> ✿ *Reporte:* _${text}_\n> ✦ *Chat:* ${chatLabel}\n> ✰ *Fecha:* ${horario}`
                
                await conn.sendMessage(`${receptor}@s.whatsapp.net`, { 
                    text: rep, 
                    mentions: [m.sender] 
                }, { quoted: m })
                
                m.reply('ꕤ El informe ha sido enviado al desarrollador.')
                break
            }

            case 'invite': {
                if (!text) return m.reply(`ꕤ Debes enviar un enlace para invitar el Bot a tu grupo.`)
                
                const match = text.match(linkRegex)
                if (!match) return m.reply('ꕤ El enlace de invitación no es válido.')
                
                const invite = `❏ *INVITACION A UN GRUPO*\n──────────────────\n> ꕤ *Usuario:* ${nombre}\n> ✩ *Tag:* ${tag}\n> ✿ *Chat:* ${chatLabel}\n> ✰ *Fecha:* ${horario}\n> ✦ *Link:* _${text}_`
                
                await conn.sendMessage(`${receptor}@s.whatsapp.net`, { 
                    text: invite, 
                    mentions: [m.sender] 
                }, { quoted: m })
                
                m.reply('ꕤ El enlace fue enviado correctamente. ¡Gracias por tu invitación!')
                break
            }

            case 'speedtest':
            case 'stest': {
                const o = await exec('python3 ./lib/ookla-speedtest.py --secure --share')
                const result = o.stdout.trim() || o.stderr.trim()
                const url = result.match(/http[^"]+\.png/)?.[0]
                
                if (url) {
                    await conn.sendMessage(m.chat, { 
                        image: { url }, 
                        caption: result
                    }, { quoted: m })
                } else {
                    m.reply(result)
                }
                break
            }

            case 'fixmsg':
            case 'ds': {
                if (global.conn.user.jid !== conn.user.jid) {
                    return m.reply('ꕤ Usa este comando en el número principal del Bot.')
                }
                
                const chatIds = m.isGroup ? [m.chat, m.sender] : [m.sender]
                const sessionPath = './Sessions/'
                
                let files
                try {
                    files = await fs.readdir(sessionPath)
                } catch {
                    files = []
                }
                
                let count = 0
                for (let file of files) {
                    for (let id of chatIds) {
                        if (file.includes(id.split('@')[0])) {
                            await fs.unlink(path.join(sessionPath, file))
                            count++
                            break
                        }
                    }
                }
                
                m.reply(count === 0 ? 
                    'ꕤ No se encontraron archivos relacionados con tu ID.' : 
                    `ꕤ Se eliminaron ${count} archivos de sesión.`)
                break
            }
        }
    } catch (err) {
        m.reply(`⚠︎ Se ha producido un problema.\n\n${err.message}`)
    }
}

handler.help = ['suggest', 'report', 'invite', 'speedtest', 'fixmsg']
handler.tags = ['main']
handler.command = ['suggest', 'sug', 'report', 'reportar', 'invite', 'speedtest', 'stest', 'fixmsg', 'ds']

export default handler
