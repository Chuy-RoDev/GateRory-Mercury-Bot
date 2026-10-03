import { WAMessageStubType } from '@whiskeysockets/baileys'
import chalk from 'chalk'
import { watchFile } from 'fs'

const terminalImage = global.opts['img'] ? require('terminal-image') : ''
const urlRegex = (await import('url-regex-safe')).default({ strict: false })

const colors = {
    border: chalk.hex('#00FFFF'),
    title: chalk.hex('#FFFFFF').bold,
    label: chalk.hex('#00BFFF'),
    text: chalk.hex('#FFFFFF'),
    footer: chalk.hex('#00FFFF')
}

export default async function (m, conn = { user: {} }) {
    let _name = await conn.getName(m.sender)
    let sender = '+' + m.sender.replace('@s.whatsapp.net', '') + (_name ? ' ~ ' + _name : '')
    let chat = await conn.getName(m.chat)
    let img
    try {
        if (global.opts['img'])
            img = /sticker|image/gi.test(m.mtype) ? await terminalImage.buffer(await m.download()) : false
    } catch (e) {
        console.error(e)
    }
    
    let filesize = (m.msg ?
        m.msg.vcard ?
        m.msg.vcard.length :
        m.msg.fileLength ?
        m.msg.fileLength.low || m.msg.fileLength :
        m.msg.axolotlSenderKeyDistributionMessage ?
        m.msg.axolotlSenderKeyDistributionMessage.length :
        m.text ?
        m.text.length :
        0
        : m.text ? m.text.length : 0) || 0

    let user = global.db.data.users[m.sender]
    let me = '+' + (conn.user?.jid || '').replace('@s.whatsapp.net', '')
    const userName = conn.user.name || conn.user.verifiedName || "Desconocido"
    
    if (m.sender === conn.user?.jid) return

    console.log(`${colors.border('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓')}
${colors.border('┃')}${colors.title('       🖤 RORY-MERCURY             ')}${colors.border('┃')}
${colors.border('┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫')}
${colors.border('┃')} ${colors.label('» Bot:')} ${colors.text(me + ' ~ ' + userName)}
${colors.border('┃')} ${colors.label('» Fecha:')} ${colors.text(new Date(m.messageTimestamp ? 1000 * (m.messageTimestamp.low || m.messageTimestamp) : Date.now()).toLocaleDateString("es-ES", { timeZone: "America/Mexico_City", day: 'numeric', month: 'long', year: 'numeric' }))}
${colors.border('┃')} ${colors.label('» Evento:')} ${colors.text(m.messageStubType ? WAMessageStubType[m.messageStubType] : 'Ninguno')}
${colors.border('┃')} ${colors.label('» Remitente:')} ${colors.text(sender)}
${colors.border('┃')} ${colors.label('» Chat:')} ${colors.text(chat)}
${colors.border('┃')} ${colors.label('» Tipo:')} ${colors.text(m.mtype ? m.mtype.replace(/message$/i, '').replace('audio', m.msg?.ptt ? 'PTT' : 'audio').replace(/^./, v => v.toUpperCase()) : 'Desconocido')}
${colors.border('┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫')}
${colors.border('┃')}${colors.footer('      Powered by Arlette Xz     ')}${colors.border('┃')}
${colors.border('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛')}`.replace(/\n\s*/g, '\n'))

    if (img) console.log(img.trimEnd())
    
    if (typeof m.text === 'string' && m.text) {
        let log = m.text.replace(/\u200e+/g, '')
        let mdRegex = /(?<=(?:^|[\s\n])\S?)(?:([*_~`])(?!`)(.+?)\1|```((?:.|[\n\r])+?)```|`([^`]+?)`)(?=\S?(?:[\s\n]|$))/g
        let mdFormat = (depth = 4) => (_, type, text, monospace) => {
            let types = {
                '_': 'italic',
                '*': 'bold',
                '~': 'strikethrough',
                '`': 'bgGray'
            }
            text = text || monospace
            let formatted = !types[type] || depth < 1 ? text : chalk[types[type]](text.replace(/`/g, '').replace(mdRegex, mdFormat(depth - 1)))
            return formatted
        }
        log = log.replace(mdRegex, mdFormat(4))
        
        if (log.length < 1024)
            log = log.replace(urlRegex, (url, i, text) => {
                let end = url.length + i
                return i === 0 || end === text.length || (/^\s$/.test(text[end]) && /^\s$/.test(text[i - 1])) ? chalk.hex('#00FFFF')(url) : url
            })
        
        const testi = await m.mentionedJid
        if (testi) {
            for (let user of testi)
                log = log.replace('@' + user.split`@`[0], colors.text('@' + await conn.getName(user)))
        }
        console.log(m.error != null ? chalk.hex('#FF6B6B')(log) : m.isCommand ? chalk.hex('#FFD93D')(log) : log)
    }

    if (m.messageStubParameters) {
        console.log(m.messageStubParameters.map(jid => {
            jid = conn.decodeJid(jid)
            let name = conn.getName(jid)
            return chalk.hex('#00BFFF')('+' + jid.replace('@s.whatsapp.net', '') + (name ? ' ~' + name : ''))}).join(', '))
    }

    if (/document/i.test(m.mtype)) console.log(`${colors.border('🝮')} ${colors.text(m.msg.fileName || m.msg.displayName || 'Document')}`)
    else if (/ContactsArray/i.test(m.mtype)) console.log(`${colors.border('᯼')} ${colors.text(' ' || '')}`)
    else if (/contact/i.test(m.mtype)) console.log(`${colors.border('✎')} ${colors.text(m.msg.displayName || '')}`)
    else if (/audio/i.test(m.mtype)) {
        const duration = m.msg.seconds
        console.log(`${colors.border(m.msg.ptt ? '☄ (PTT ' : '𝄞 (')}${colors.text('AUDIO) ' + Math.floor(duration / 60).toString().padStart(2, 0) + ':' + (duration % 60).toString().padStart(2, 0))}`)
    }
    console.log()
}

let file = global.__filename(import.meta.url)
watchFile(file, () => {
    console.log(chalk.hex('#00FFFF')("Update 'lib/print.js'"))
})