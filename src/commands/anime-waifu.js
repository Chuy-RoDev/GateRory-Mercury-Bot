import fetch from 'node-fetch';

// ── CATEGORIAS ───────────────────────────────────────────────
const SFW = {
    waifu:    { wpm: 'waifu',    wi: 'waifu',     nb: 'waifu' },
    neko:     { wpm: 'neko',     wi: 'neko',       nb: 'neko' },
    shinobu:  { wpm: 'shinobu', wi: null,          nb: null },
    megumin:  { wpm: 'megumin', wi: null,          nb: null },
    bully:    { wpm: 'bully',   wi: null,          nb: null },
    cuddle:   { wpm: 'cuddle',  wi: null,          nb: 'cuddle' },
    cry:      { wpm: 'cry',     wi: null,          nb: 'cry' },
    hug:      { wpm: 'hug',     wi: null,          nb: 'hug' },
    kiss:     { wpm: 'kiss',    wi: null,          nb: 'kiss' },
    pat:      { wpm: 'pat',     wi: null,          nb: 'pat' },
    smug:     { wpm: 'smug',    wi: null,          nb: null },
    bonk:     { wpm: 'bonk',    wi: null,          nb: null },
    blush:    { wpm: 'blush',   wi: null,          nb: 'blush' },
    smile:    { wpm: 'smile',   wi: null,          nb: 'smile' },
    wave:     { wpm: 'wave',    wi: null,          nb: 'wave' },
    highfive: { wpm: 'highfive',wi: null,          nb: 'highfive' },
    handhold: { wpm: 'handhold',wi: null,          nb: null },
    nom:      { wpm: 'nom',     wi: null,          nb: null },
    bite:     { wpm: 'bite',    wi: null,          nb: 'bite' },
    slap:     { wpm: 'slap',    wi: null,          nb: 'slap' },
    happy:    { wpm: 'happy',   wi: null,          nb: 'happy' },
    wink:     { wpm: 'wink',    wi: null,          nb: 'wink' },
    poke:     { wpm: 'poke',    wi: null,          nb: 'poke' },
    dance:    { wpm: 'dance',   wi: null,          nb: 'dance' },
    cringe:   { wpm: 'cringe',  wi: null,          nb: null },
}

const NSFW = {
    nsfwwaifu: { wpm: 'waifu',   wi: 'waifu',  nb: null },
    ero:       { wpm: 'ero',     wi: null,      nb: null },
    nsfwneko:  { wpm: 'neko',    wi: 'oppai',   nb: null },
    trap:      { wpm: 'trap',    wi: 'trap',    nb: null },
    blowjob:   { wpm: 'blowjob', wi: 'oral',    nb: null },
}

// Alias de comandos → categoria interna
const ALIAS = {
    // SFW
    'waifu': 'waifu', 'neko': 'neko', 'shinobu': 'shinobu',
    'megumin': 'megumin', 'bully': 'bully', 'cuddle': 'cuddle',
    'cry': 'cry', 'hug': 'hug', 'kiss': 'kiss', 'pat': 'pat',
    'smug': 'smug', 'bonk': 'bonk', 'blush': 'blush', 'smile': 'smile',
    'wave': 'wave', 'highfive': 'highfive', 'handhold': 'handhold',
    'nom': 'nom', 'bite': 'bite', 'slap': 'slap', 'happy': 'happy',
    'wink': 'wink', 'poke': 'poke', 'dance': 'dance', 'cringe': 'cringe',
    // NSFW
    'waifunsfw': 'nsfwwaifu', 'nsfwwaifu': 'nsfwwaifu',
    'nekonsfw': 'nsfwneko', 'nsfwneko': 'nsfwneko',
    'ero': 'ero', 'trap': 'trap', 'blowjob': 'blowjob',
}

// ── FETCHERS ─────────────────────────────────────────────────
async function fromWaifuPics(cat, nsfw = false) {
    const base = nsfw ? 'https://api.waifu.pics/nsfw/' : 'https://api.waifu.pics/sfw/'
    const r = await fetch(base + cat, { timeout: 5000 })
    const d = await r.json()
    return d.url || null
}

async function fromWaifuIm(tag, nsfw = false) {
    const url = `https://api.waifu.im/search/?included_tags=${tag}&is_nsfw=${nsfw}`
    const r = await fetch(url, { timeout: 5000 })
    const d = await r.json()
    return d.images?.[0]?.url || null
}

async function fromNekosBest(cat) {
    const r = await fetch(`https://nekos.best/api/v2/${cat}`, { timeout: 5000 })
    const d = await r.json()
    return d.results?.[0]?.url || null
}

async function getImage(catKey, isNsfw) {
    const cats = isNsfw ? NSFW : SFW
    const cat = cats[catKey]
    if (!cat) return null

    const intentos = []
    if (cat.wpm) intentos.push(() => fromWaifuPics(cat.wpm, isNsfw))
    if (cat.wi)  intentos.push(() => fromWaifuIm(cat.wi, isNsfw))
    if (cat.nb)  intentos.push(() => fromNekosBest(cat.nb))

    for (const fn of intentos) {
        try {
            const url = await fn()
            if (url) return url
        } catch { continue }
    }
    return null
}

// ── HANDLER ──────────────────────────────────────────────────
const handler = async (m, { conn, usedPrefix, command }) => {
    try {
        await m.react('🕒')

        const catKey = ALIAS[command]
        if (!catKey) return

        const isNsfw = catKey in NSFW

        // Verificar NSFW del grupo
        if (isNsfw) {
            const chatData = global.db?.data?.chats?.[m.chat] || {}
            if (!chatData.nsfw) {
                await m.react('✖️')
                return conn.reply(m.chat, `ꕤ El contenido *NSFW* está desactivado en este grupo.\n> Un administrador puede activarlo con *${usedPrefix}nsfw on*`, m)
            }
        }

        const url = await getImage(catKey, isNsfw)
        if (!url) throw new Error('No se encontró imagen. Intenta de nuevo.')

        await conn.sendFile(m.chat, url, 'anime.jpg', '', m)
        await m.react('✔️')

    } catch (err) {
        await m.react('✖️')
        conn.reply(m.chat, `❌ Error: ${err.message}`, m)
    }
}

handler.help = ['waifu', 'neko', 'hug', 'kiss', 'pat', 'slap', '...']
handler.tags = ['anime']
handler.command = Object.keys(ALIAS)
handler.group = true

export default handler