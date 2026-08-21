import fetch from 'node-fetch'

const API_KEY = 'Zyzz-1234'
const API_CAUSAS = 'https://rest.apicausas.xyz/api/v1/anime'

const COMMAND_MAP = {
    'cum': 'cum', 'leche': 'cum',
    'fuck': 'fuck', 'coger': 'fuck',
    'grabboobs': 'grabboobs', 'agarrartetas': 'grabboobs',
    'suckboobs': 'suckboobs', 'chupartetas': 'suckboobs',
    'blowjob': 'blowjob', 'bj': 'blowjob', 'mamada': 'blowjob',
    'fuck2': 'fuck2', 'coger2': 'fuck2',
    'yuri': 'yuri', 'lesbianas': 'yuri', 'tijeras': 'yuri',
    'sixnine': 'sixnine', '69': 'sixnine',
    'sexo': 'sexo', 'sex': 'sexo',
    'violar': 'violar', 'perra': 'violar',
    'boobjob': 'boobjob', 'rusa': 'boobjob',
    'spank': 'spank', 'nalgada': 'spank',
    'anal': 'anal', 'culiar': 'anal',
    'lickpussy': 'lickpussy', 'coño': 'lickpussy',
    'fap': 'fap', 'paja': 'fap',
    'follar': 'follar',
    'footjob': 'footjob', 'pies': 'footjob',
    'grop': 'grop', 'grope': 'grop', 'manosear': 'grop'
}

const EMOJIS = {
    cum: '💦', fuck: '🥵', grabboobs: '🔥', suckboobs: '🔥',
    blowjob: '😮', fuck2: '🥵', yuri: '🥵', sixnine: '🥵',
    sexo: '🥵', violar: '🥵', boobjob: '🥵', spank: '🔥',
    anal: '🥵', lickpussy: '🤪', fap: '🔥', follar: '🥵',
    footjob: '🥵', grop: '😏'
}

const FRASES = (from, who) => ({
    cum:        { self: `\`${from}\` *se vino... omitiremos los detalles.*`,                    other: `\`${from}\` *se vino dentro de* \`${who}\`. 💦` },
    fuck:       { self: `\`${from}\` *está cogiendo. >.<*`,                                     other: `\`${from}\` *se lo metió sabrosamente a* \`${who}\`. 🥵` },
    grabboobs:  { self: `\`${from}\` *está agarrando unas ricas tetas. >.<*`,                  other: `\`${from}\` *le está agarrando las tetas a* \`${who}\`. 🔥` },
    suckboobs:  { self: `\`${from}\` *está chupando tetas. >.<*`,                              other: `\`${from}\` *le chupó las tetas a* \`${who}\`. 🔥` },
    blowjob:    { self: `\`${from}\` *está dando una mamada. >.<*`,                            other: `\`${from}\` *le dio una mamada a* \`${who}\`. 😮` },
    fuck2:      { self: `\`${from}\` *está cogiendo salvajemente.*`,                           other: `\`${from}\` *se la metió ricamente a* \`${who}\`. 🥵` },
    yuri:       { self: `\`${from}\` *está haciendo tijeras. >.<*`,                            other: `\`${from}\` *hizo tijeras con* \`${who}\`. 🥵` },
    sixnine:    { self: `\`${from}\` *está haciendo un 69. >.<*`,                              other: `\`${from}\` *está haciendo un 69 con* \`${who}\`. 🥵` },
    sexo:       { self: `\`${from}\` *tiene sexo apasionadamente.*`,                           other: `\`${from}\` *tiene sexo fuertemente con* \`${who}\`. 🥵` },
    violar:     { self: `\`${from}\` *violó a alguien random del grupo.*`,                     other: `\`${from}\` *violó a* \`${who}\` *mientras le decía "más duro...". 🥵*` },
    boobjob:    { self: `\`${from}\` *está haciendo una rusa.*`,                               other: `\`${from}\` *le hizo una rusa a* \`${who}\`. 🥵` },
    spank:      { self: `\`${from}\` *está repartiendo nalgadas. >.<*`,                        other: `\`${from}\` *le dio una nalgada a* \`${who}\`. 🔥` },
    anal:       { self: `\`${from}\` *está haciendo un anal.*`,                                other: `\`${from}\` *le partió el culo a* \`${who}\`. 🥵` },
    lickpussy:  { self: `\`${from}\` *está lamiendo un coño. >.<*`,                            other: `\`${from}\` *le está lamiendo el coño a* \`${who}\`. 🤪` },
    fap:        { self: `\`${from}\` *se está pajeando intensamente.*`,                        other: `\`${from}\` *se pajea pensando en* \`${who}\`. 🔥` },
    follar:     { self: `\`${from}\` *está follando ricamente.*`,                              other: `\`${from}\` *folló fuertemente a* \`${who}\`. 🥵` },
    footjob:    { self: `\`${from}\` *está haciendo una paja con los pies.*`,                  other: `\`${from}\` *le hizo una paja con los pies a* \`${who}\`. 🥵` },
    grop:       { self: `\`${from}\` *está manoseando. >.<*`,                                  other: `\`${from}\` *está manoseando a* \`${who}\`. 😏` },
})

let handler = async (m, { conn, command, usedPrefix }) => {
    if (!db.data.chats[m.chat].nsfw && m.isGroup) {
        return m.reply(
            `╭─「 🔞 𝗡𝗦𝗙𝗪 」\n` +
            `│ ꕤ El contenido *NSFW* está desactivado.\n` +
            `│\n` +
            `│ ✦ Un admin puede activarlo con:\n` +
            `│ *${usedPrefix}nsfw on*\n` +
            `╰─────────────────`
        )
    }

    const baseCommand = COMMAND_MAP[command]
    if (!baseCommand) return m.reply(
        `╭─「 🔞 𝗡𝗦𝗙𝗪 」\n` +
        `│ ꕤ Comando no reconocido.\n` +
        `│ ✦ Usa *${usedPrefix}menu nsfw* para ver la lista.\n` +
        `╰─────────────────`
    )

    let mentionedJid = m.mentionedJid || []
    let userId = mentionedJid.length > 0 ? mentionedJid[0] : (m.quoted ? m.quoted.sender : m.sender)
    let isMentioned = mentionedJid.length > 0 || (m.quoted && m.quoted.sender !== m.sender)

    const getName = async (jid) => {
        try {
            const name = global.db.data.users[jid]?.name || await conn.getName(jid)
            return typeof name === 'string' && name.trim() ? name : jid.split('@')[0]
        } catch { return jid.split('@')[0] }
    }

    const fromName = await getName(m.sender)
    const whoName = await getName(userId)

    const frases = FRASES(fromName, whoName)
    const str = frases[baseCommand]
        ? (isMentioned ? frases[baseCommand].other : frases[baseCommand].self)
        : `\`${fromName}\` *usó ${command}*`

    if (EMOJIS[baseCommand]) m.react(EMOJIS[baseCommand])

    try {
        const res = await fetch(`${API_CAUSAS}?action=${baseCommand}&apikey=${API_KEY}`)
        const buffer = await res.buffer()

        await conn.sendMessage(m.chat, {
            video: buffer,
            gifPlayback: true,
            caption: str,
            mimetype: 'video/mp4',
            mentions: [userId]
        }, { quoted: m })

    } catch (e) {
        console.error(e)
        m.reply(
            `╭─「 ⚠︎ 𝗘𝗿𝗿𝗼𝗿 」\n` +
            `│ _${e.message}_\n` +
            `╰─────────────────`
        )
    }
}

handler.help = ['cum/leche @tag', 'fuck/coger @tag', 'grabboobs @tag', 'suckboobs @tag', 'blowjob/mamada @tag', 'fuck2 @tag', 'yuri/tijeras @tag', 'sixnine/69 @tag', 'sexo @tag', 'violar @tag', 'boobjob/rusa @tag', 'spank/nalgada @tag', 'anal @tag', 'lickpussy @tag', 'fap/paja @tag', 'follar @tag', 'footjob/pies @tag', 'grop/manosear @tag']
handler.tags = ['nsfw']
handler.command = ['cum', 'leche', 'fuck', 'coger', 'grabboobs', 'agarrartetas', 'suckboobs', 'chupartetas', 'blowjob', 'bj', 'mamada', 'fuck2', 'coger2', 'yuri', 'lesbianas', 'tijeras', 'sixnine', '69', 'sexo', 'sex', 'violar', 'perra', 'boobjob', 'rusa', 'spank', 'nalgada', 'anal', 'culiar', 'lickpussy', 'coño', 'fap', 'paja', 'follar', 'footjob', 'pies', 'grop', 'grope', 'manosear']
handler.group = true

export default handler