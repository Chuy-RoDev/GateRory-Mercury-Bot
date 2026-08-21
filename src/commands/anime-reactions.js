import fetch from 'node-fetch'

const API_KEY = 'Zyzz-1234'
const API_CAUSAS = 'https://rest.apicausas.xyz/api/v1/anime'

// Mapa: comando → action de apicausas
const ACTIONS = {
    angry: 'angry',       enojado: 'angry',
    bite: 'bite',         morder: 'bite',
    blush: 'blush',       sonrojarse: 'blush',
    bored: 'bored',       aburrido: 'bored',
    clap: 'clap',         aplaudir: 'clap',
    cry: 'cry',           llorar: 'cry',
    cuddle: 'cuddle',     acurrucarse: 'cuddle',
    dance: 'dance',       bailar: 'dance',
    facepalm: 'facepalm',
    happy: 'happy',       feliz: 'happy',
    hug: 'hug',           abrazar: 'hug',
    kiss: 'kiss',         muak: 'kiss',
    laugh: 'laugh',       reirse: 'laugh',
    lick: 'lick',         lamer: 'lick',
    pat: 'pat',           palmadita: 'pat',     palmada: 'pat',
    poke: 'poke',         picar: 'poke',
    pout: 'pout',         pucheros: 'pout',
    punch: 'punch',       pegar: 'punch',       golpear: 'punch',
    run: 'run',           correr: 'run',
    sad: 'sad',           triste: 'sad',
    slap: 'slap',         bofetada: 'slap',
    sleep: 'sleep',       dormir: 'sleep',
    smile: 'smile',       sonreir: 'smile',
    smug: 'smug',         presumir: 'smug',
    wave: 'wave',         hola: 'wave',         ola: 'wave',
    wink: 'wink',         guiñar: 'wink',
    handhold: 'handhold', mano: 'handhold',
    highfive: 'highfive', '5': 'highfive',
    kill: 'kill',         matar: 'kill',
    bleh: 'bleh',         lengua: 'bleh',
    bonk: 'bonk',
    bath: 'bath',         bañarse: 'bath',
    coffee: 'coffee',     cafe: 'coffee',       café: 'coffee',
    eat: 'eat',           comer: 'eat',
    drunk: 'drunk',       borracho: 'drunk',
    kisscheek: 'kisscheek', beso: 'kisscheek',
    love: 'love',         enamorado: 'love',    enamorada: 'love',
    preg: 'impregnate',   preñar: 'impregnate', embarazar: 'impregnate',
    scared: 'scared',     asustado: 'scared',   asustada: 'scared',
    seduce: 'seduce',     seducir: 'seduce',
    shy: 'shy',           timido: 'shy',        timida: 'shy',
    smoke: 'smoke',       fumar: 'smoke',
    spit: 'spit',         escupir: 'spit',
    step: 'step',         pisar: 'step',
    think: 'think',       pensar: 'think',
    walk: 'walk',         caminar: 'walk',
    dramatic: 'dramatic', drama: 'dramatic',
    cringe: 'cringe',     avergonzarse: 'cringe',
    bully: 'bully',       bullying: 'bully',
    yeet: 'yeet',         patear: 'yeet',
    glomp: 'glomp',
    awoo: 'awoo',
}

const FRASES = (from, who) => ({
    angry:      { self: [`\`${from}\` está molesto.`, `\`${from}\` se enfada.`], other: [`\`${from}\` está molesto con \`${who}\`.`, `\`${from}\` culpa a \`${who}\` con enojo.`] },
    bath:       { self: [`\`${from}\` se está bañando.`], other: [`\`${from}\` baña a \`${who}\`.`] },
    bite:       { self: [`\`${from}\` se mordió a sí mismo.`], other: [`\`${from}\` muerde a \`${who}\`.`, `\`${from}\` le da un mordisco a \`${who}\`.`] },
    bleh:       { self: [`\`${from}\` saca la lengua.`], other: [`\`${from}\` le saca la lengua a \`${who}\`.`] },
    blush:      { self: [`\`${from}\` se sonroja.`, `\`${from}\` se ruboriza.`], other: [`\`${from}\` se sonroja por \`${who}\`.`] },
    bonk:       { self: [`\`${from}\` se dio un bonk.`], other: [`\`${from}\` le dio un bonk a \`${who}\`.`] },
    bored:      { self: [`\`${from}\` está aburrido.`, `\`${from}\` bosteza.`], other: [`\`${from}\` se aburre de \`${who}\`.`] },
    clap:       { self: [`\`${from}\` aplaude.`], other: [`\`${from}\` aplaude a \`${who}\`.`] },
    coffee:     { self: [`\`${from}\` toma café.`], other: [`\`${from}\` toma café con \`${who}\`.`] },
    cry:        { self: [`\`${from}\` está llorando.`, `\`${from}\` derrama lágrimas.`], other: [`\`${from}\` llora por \`${who}\`.`] },
    cuddle:     { self: [`\`${from}\` se abraza a sí mismo.`], other: [`\`${from}\` se acurrucó con \`${who}\`.`] },
    dance:      { self: [`\`${from}\` está bailando.`], other: [`\`${from}\` baila con \`${who}\`.`] },
    drunk:      { self: [`\`${from}\` está borracho.`, `\`${from}\` ve doble.`], other: [`\`${from}\` está borracho con \`${who}\`.`] },
    dramatic:   { self: [`\`${from}\` actúa dramáticamente.`], other: [`\`${from}\` le hace una escena a \`${who}\`.`] },
    eat:        { self: [`\`${from}\` está comiendo.`], other: [`\`${from}\` come con \`${who}\`.`] },
    facepalm:   { self: [`\`${from}\` se da una palmada en la cara.`], other: [`\`${from}\` no puede creer lo que hizo \`${who}\`.`] },
    happy:      { self: [`\`${from}\` está feliz.`, `\`${from}\` irradia alegría.`], other: [`\`${from}\` está feliz por \`${who}\`.`] },
    highfive:   { self: [`\`${from}\` celebra su victoria.`], other: [`\`${from}\` choca los cinco con \`${who}\`.`] },
    handhold:   { self: [`\`${from}\` une sus manos.`], other: [`\`${from}\` camina de la mano con \`${who}\`.`] },
    hug:        { self: [`\`${from}\` se abraza a sí mismo.`], other: [`\`${from}\` abraza a \`${who}\`.`, `\`${from}\` consuela a \`${who}\`.`] },
    kill:       { self: [`\`${from}\` está derrotado.`], other: [`\`${from}\` derrota a \`${who}\`.`] },
    kiss:       { self: [`\`${from}\` lanza un beso al aire.`], other: [`\`${from}\` besa a \`${who}\`.`] },
    kisscheek:  { self: [`\`${from}\` se besa la mejilla.`], other: [`\`${from}\` besa la mejilla de \`${who}\`.`] },
    laugh:      { self: [`\`${from}\` se ríe a carcajadas.`], other: [`\`${from}\` se ríe con \`${who}\`.`] },
    lick:       { self: [`\`${from}\` se lame los labios.`], other: [`\`${from}\` lame a \`${who}\`.`] },
    love:       { self: [`\`${from}\` muestra amor propio.`], other: [`\`${from}\` está enamorado de \`${who}\`.`] },
    pat:        { self: [`\`${from}\` se auto-felicita.`], other: [`\`${from}\` acaricia a \`${who}\`.`] },
    poke:       { self: [`\`${from}\` se pincha.`], other: [`\`${from}\` molesta a \`${who}\`.`] },
    pout:       { self: [`\`${from}\` hace pucheros.`], other: [`\`${from}\` le hace pucheros a \`${who}\`.`] },
    punch:      { self: [`\`${from}\` golpea al aire.`], other: [`\`${from}\` le da un puñetazo a \`${who}\`.`] },
    impregnate: { self: [`\`${from}\` anuncia un milagro.`], other: [`\`${from}\` deja embarazada a \`${who}\`.`] },
    run:        { self: [`\`${from}\` está corriendo.`, `\`${from}\` huye.`], other: [`\`${from}\` huye de \`${who}\`.`] },
    sad:        { self: [`\`${from}\` está triste.`], other: [`\`${from}\` está triste por \`${who}\`.`] },
    scared:     { self: [`\`${from}\` está aterrorizado.`], other: [`\`${from}\` se esconde de \`${who}\`.`] },
    seduce:     { self: [`\`${from}\` lanza una mirada seductora.`], other: [`\`${from}\` intenta seducir a \`${who}\`.`] },
    shy:        { self: [`\`${from}\` está tímido.`], other: [`\`${from}\` se avergüenza por \`${who}\`.`] },
    slap:       { self: [`\`${from}\` se abofetea.`], other: [`\`${from}\` abofetea a \`${who}\`.`] },
    sleep:      { self: [`\`${from}\` está durmiendo.`], other: [`\`${from}\` duerme junto a \`${who}\`.`] },
    smile:      { self: [`\`${from}\` sonríe amablemente.`], other: [`\`${from}\` le sonríe a \`${who}\`.`] },
    smug:       { self: [`\`${from}\` está presumiendo.`], other: [`\`${from}\` presume frente a \`${who}\`.`] },
    smoke:      { self: [`\`${from}\` está fumando.`], other: [`\`${from}\` fuma con \`${who}\`.`] },
    spit:       { self: [`\`${from}\` escupe.`], other: [`\`${from}\` escupe a \`${who}\`.`] },
    step:       { self: [`\`${from}\` tropieza.`], other: [`\`${from}\` pisa a \`${who}\`.`] },
    think:      { self: [`\`${from}\` está pensando.`], other: [`\`${from}\` piensa en \`${who}\`.`] },
    walk:       { self: [`\`${from}\` sale a pasear.`], other: [`\`${from}\` camina con \`${who}\`.`] },
    wink:       { self: [`\`${from}\` guiña el ojo.`], other: [`\`${from}\` le guiña el ojo a \`${who}\`.`] },
    cringe:     { self: [`\`${from}\` siente vergüenza ajena.`], other: [`\`${from}\` no puede creer a \`${who}\`.`] },
    bully:      { self: [`\`${from}\` es duro consigo mismo.`], other: [`\`${from}\` le hace bullying a \`${who}\`.`] },
    wave:       { self: [`\`${from}\` saluda.`], other: [`\`${from}\` saluda a \`${who}\`.`] },
    yeet:       { self: [`\`${from}\` se mandó a volar.`], other: [`\`${from}\` mandó a volar a \`${who}\`.`] },
    glomp:      { self: [`\`${from}\` se lanzó al suelo.`], other: [`\`${from}\` se lanzó sobre \`${who}\`.`] },
    awoo:       { self: [`\`${from}\` dice: ¡Awoooo! 🐺`], other: [`\`${from}\` le dice ¡Awoooo! a \`${who}\`. 🐺`] },
})

const getFrasesKey = (action) => {
    const map = { impregnate: 'impregnate' }
    return map[action] || action
}

let handler = async (m, { conn, command }) => {
    const action = ACTIONS[command]
    if (!action) return

    let mentionedJid = await m.mentionedJid
    let userId = mentionedJid.length > 0 ? mentionedJid[0] : (m.quoted ? m.quoted.sender : m.sender)

    const getName = async (jid) => {
        try {
            const name = global.db.data.users[jid]?.name || await conn.getName(jid)
            return typeof name === 'string' && name.trim() ? name.trim() : jid.split('@')[0]
        } catch { return jid.split('@')[0] }
    }

    const from = await getName(m.sender)
    const who = await getName(userId)
    const isSelf = m.sender === userId
    const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)]

    const frases = FRASES(from, who)
    const key = getFrasesKey(action)
    const frasesCmd = frases[key]
    const str = frasesCmd ? rnd(isSelf ? frasesCmd.self : frasesCmd.other) : null
    if (!str) return

    try {
        const res = await fetch(`${API_CAUSAS}?action=${action}&apikey=${API_KEY}`)
        const contentType = res.headers.get('content-type') || ''

        let mediaUrl
        let isVideo = false

        if (contentType.includes('application/json')) {
            const json = await res.json()
            mediaUrl = json.data?.url
            if (typeof mediaUrl === 'string') {
                isVideo = mediaUrl.toLowerCase().split('?')[0].endsWith('.mp4')
            }
        } else {
            mediaUrl = await res.buffer()
            isVideo = contentType.includes('video')
        }

        if (!mediaUrl) return m.reply('ꕤ No se encontró contenido para esta reacción.')

        await conn.sendMessage(m.chat, {
            [isVideo ? 'video' : 'image']: typeof mediaUrl === 'string' ? { url: mediaUrl } : mediaUrl,
            caption: str,
            gifPlayback: isVideo,
            mentions: [userId].filter(jid => jid)
        }, { quoted: m })

    } catch (e) {
        console.error(e)
        return m.reply('ꕤ Error al obtener el gif. Intenta de nuevo.')
    }
}

const CMDS = ['angry','enojado','bath','bañarse','bite','morder','bleh','lengua','blush','sonrojarse','bonk','bored','aburrido','clap','aplaudir','coffee','cafe','café','cry','llorar','cuddle','acurrucarse','dance','bailar','drunk','borracho','dramatic','drama','eat','comer','facepalm','palmada','happy','feliz','highfive','5','handhold','mano','hug','abrazar','kill','matar','kiss','muak','kisscheek','beso','laugh','reirse','lick','lamer','love','enamorado','enamorada','pat','palmadita','poke','picar','pout','pucheros','punch','pegar','golpear','preg','preñar','embarazar','run','correr','sad','triste','scared','asustada','asustado','seduce','seducir','shy','timido','timida','slap','bofetada','sleep','dormir','smile','sonreir','smug','presumir','smoke','fumar','spit','escupir','step','pisar','think','pensar','walk','caminar','wink','guiñar','cringe','avergonzarse','bully','bullying','wave','hola','ola','yeet','patear','glomp','awoo']

handler.help = CMDS
handler.tags = ['anime']
handler.command = CMDS
handler.group = true

export default handler