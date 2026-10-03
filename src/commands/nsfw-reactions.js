import { readFileSync } from 'fs'
import { join } from 'path'

const nsfwData = JSON.parse(readFileSync(join(process.cwd(), 'src/json', 'nsfw.json')))

let handler = async (m, { conn, command, usedPrefix }) => {
    const pref = Array.isArray(global.prefix) ? global.prefix[0] : (global.prefix || usedPrefix || '/')

    if (!global.db?.data?.chats?.[m.chat]?.nsfw && m.isGroup) {
        return m.reply(`ꕤ El contenido *NSFW* está desactivado en este grupo.\n» Un administrador puede activarlo con: *${pref}nsfw on*`)
    }

    // Extracción limpia de JIDs y soporte para contexto de menciones
    const contextInfo = m.message?.extendedTextMessage?.contextInfo || m.msg?.contextInfo
    let senderJid = typeof m.sender === 'string' ? m.sender : String(m.sender || '')
    
    let quotedSender = m.quoted ? (typeof m.quoted.sender === 'string' ? m.quoted.sender : String(m.quoted.sender || '')) : null
    let mentionedJid = (m.mentionedJid && m.mentionedJid.length > 0) ? m.mentionedJid[0] : contextInfo?.mentionedJid?.[0]

    let userId = quotedSender || mentionedJid || senderJid
    if (typeof userId !== 'string' || !userId.includes('@')) userId = senderJid

    // Formato de etiqueta directo (@número) para que WhatsApp lo reconozca
    let getTag = (jid) => `@${jid.split('@')[0]}`

    let fromName = getTag(senderJid)
    let whoName = getTag(userId)

    const commandMap = {
        'cum': 'cum', 'leche': 'cum', 'fuck': 'fuck', 'coger': 'fuck',
        'grabboobs': 'grabboobs', 'agarrartetas': 'grabboobs',
        'suckboobs': 'suckboobs', 'chupartetas': 'suckboobs',
        'blowjob': 'blowjob', 'bj': 'blowjob', 'mamada': 'blowjob',
        'fuck2': 'fuck2', 'coger2': 'fuck2', 'yuri': 'yuri',
        'lesbianas': 'yuri', 'tijeras': 'yuri', 'sixnine': 'sixnine',
        '69': 'sixnine', 'sexo': 'sexo', 'sex': 'sexo', 'violar': 'violar',
        'perra': 'violar', 'boobjob': 'boobjob', 'rusa': 'boobjob',
        'spank': 'spank', 'nalgada': 'spank', 'anal': 'anal',
        'culiar': 'anal', 'lickpussy': 'lickpussy', 'coño': 'lickpussy',
        'fap': 'fap', 'paja': 'fap', 'follar': 'follar',
        'footjob': 'footjob', 'pies': 'footjob', 'grop': 'grop',
        'grope': 'grop', 'manosear': 'grop'
    }

    const messagesMap = {
        'cum': {
            mentioned: `${fromName} *se vino dentro de* ${whoName}.`,
            quoted: `${fromName} *se vino dentro de* ${whoName}.`,
            solo: `${fromName} *se vino solo/a... Omitiremos eso.*`
        },
        'fuck': {
            mentioned: `${fromName} *se lo metió sabrosamente a* ${whoName}.`,
            quoted: `${fromName} *cogió fuertemente a* ${whoName}.`,
            solo: `${fromName} *está cogiendo! >.<*`
        },
        'grabboobs': {
            mentioned: `${fromName} *le está agarrando las tetas a* ${whoName}.`,
            quoted: `${fromName} *está agarrando las tetas de* ${whoName}.`,
            solo: `${fromName} *está agarrando unas ricas tetas >.<*`
        },
        'suckboobs': {
            mentioned: `${fromName} *le chupó las tetas a* ${whoName}.`,
            quoted: `${fromName} *está chupando las tetas de* ${whoName}.`,
            solo: `${fromName} *está chupando tetas! >.<*`
        },
        'blowjob': {
            mentioned: `${fromName} *le dio una mamada a* ${whoName}.`,
            quoted: `${fromName} *le está dando una mamada a* ${whoName}.`,
            solo: `${fromName} *está dando una mamada >.<*`
        },
        'fuck2': {
            mentioned: `${fromName} *se la metió ricamente a* ${whoName}.`,
            quoted: `${fromName} *cogió ricamente a* ${whoName}.`,
            solo: `${fromName} *está cogiendo salvajemente.*`
        },
        'yuri': {
            mentioned: `${fromName} *hizo tijeras con* ${whoName}.`,
            quoted: `${fromName} *está haciendo tijeras con* ${whoName}.`,
            solo: `${fromName} *está haciendo tijeras! >.<*`
        },
        'sixnine': {
            mentioned: `${fromName} *está haciendo un 69 con* ${whoName}.`,
            quoted: `${fromName} *hizo un 69 con* ${whoName}.`,
            solo: `${fromName} *está haciendo un 69! >.<*`
        },
        'sexo': {
            mentioned: `${fromName} *tiene sexo fuertemente con* ${whoName}.`,
            quoted: `${fromName} *tiene sexo con* ${whoName}.`,
            solo: `${fromName} *tiene sexo apasionadamente.*`
        },
        'violar': {
            mentioned: `${fromName} *acabas de violar a* ${whoName}...`,
            quoted: `${fromName} *violaste a* ${whoName}...`,
            solo: `${fromName} *violó a alguien random del grupo.*`
        },
        'boobjob': {
            mentioned: `${fromName} *le hizo una rusa a* ${whoName}.`,
            quoted: `${fromName} *le hizo una rusa a* ${whoName}.`,
            solo: `${fromName} *está haciendo una rusa.*`
        },
        'spank': {
            mentioned: `${fromName} *le dio una nalgada a* ${whoName}.`,
            quoted: `${fromName} *nalgueó a* ${whoName}.`,
            solo: `${fromName} *está repartiendo nalgadas! >.<*`
        },
        'anal': {
            mentioned: `${fromName} *le partió el culo a* ${whoName}.`,
            quoted: `${fromName} *se la metió en el ano a* ${whoName}.`,
            solo: `${fromName} *está haciendo un anal.*`
        },
        'lickpussy': {
            mentioned: `${fromName} *le está lamiendo el coño a* ${whoName}.`,
            quoted: `${fromName} *le chupó el coño a* ${whoName}.`,
            solo: `${fromName} *está lamiendo coños! >.<*`
        },
        'fap': {
            mentioned: `${fromName} *se pajea pensando en* ${whoName}.`,
            quoted: `${fromName} *está pajeando a* ${whoName}.`,
            solo: `${fromName} *se pajea tranquilamente.*`
        },
        'follar': {
            mentioned: `${fromName} *folló fuertemente a* ${whoName}.`,
            quoted: `${fromName} *se la metió durísimo a* ${whoName}.`,
            solo: `${fromName} *está follando ricamente.*`
        },
        'footjob': {
            mentioned: `${fromName} *le hizo una paja con los pies a* ${whoName}.`,
            quoted: `${fromName} *está haciendo una paja con los pies a* ${whoName}.`,
            solo: `${fromName} *está haciendo una paja con los pies!*`
        },
        'grop': {
            mentioned: `${fromName} *está manoseando a* ${whoName}.`,
            quoted: `${fromName} *está manoseando a* ${whoName}.`,
            solo: `${fromName} *está manoseando! >.<*`
        }
    }

    const baseCommand = commandMap[command.toLowerCase()]
    
    if (!baseCommand || !nsfwData[baseCommand]) {
        return m.reply(`ꕤ Comando no reconocido.\n» Usa *${pref}help nsfw* para ver la lista.`)
    }

    const commandData = nsfwData[baseCommand]
    const videos = commandData.videos
    const reactEmoji = commandData.reactEmoji
    const messages = messagesMap[baseCommand]

    // Evaluación lógica del mensaje
    let str = (userId === senderJid) 
        ? messages.solo 
        : (m.quoted ? messages.quoted : messages.mentioned)

    if (reactEmoji) await m.react(reactEmoji)
    
    if (m.isGroup) {
        try {
            const video = videos[Math.floor(Math.random() * videos.length)]
            // Menciones activas para ambos involucrados
            const mentions = [senderJid, userId].filter(j => typeof j === 'string' && j.includes('@'))
            
            await conn.sendMessage(m.chat, { 
                video: { url: video }, 
                gifPlayback: true, 
                caption: String(str), 
                mentions 
            }, { quoted: m })
            
        } catch (e) {
            console.error(e)
            return m.reply(`ꕤ Error al enviar el video.\n» Usa *${pref}report* para informar.\n\n${e.message}`)
        }
    }
}

handler.help = [
    'cum/leche', 'fuck/coger', 'grabboobs/agarrartetas', 'suckboobs/chupartetas',
    'blowjob/bj/mamada', 'fuck2/coger2', 'yuri/lesbianas/tijeras', 'sixnine/69',
    'sexo/sex', 'violar/perra', 'boobjob/rusa', 'spank/nalgada',
    'anal/culiar', 'lickpussy/coño', 'fap/paja', 'follar',
    'footjob/pies', 'grop/grope/manosear'
]

handler.tags = ['nsfw']
handler.command = [
    'cum', 'leche', 'fuck', 'coger', 'grabboobs', 'agarrartetas',
    'suckboobs', 'chupartetas', 'blowjob', 'bj', 'mamada',
    'fuck2', 'coger2', 'yuri', 'lesbianas', 'tijeras',
    'sixnine', '69', 'sexo', 'sex', 'violar', 'perra',
    'boobjob', 'rusa', 'spank', 'nalgada', 'anal', 'culiar',
    'lickpussy', 'coño', 'fap', 'paja', 'follar',
    'footjob', 'pies', 'grop', 'grope', 'manosear'
]

handler.group = true

export default handler