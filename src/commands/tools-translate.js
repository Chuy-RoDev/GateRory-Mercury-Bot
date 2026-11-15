import translate from '@vitalets/google-translate-api'
import fetch from 'node-fetch'

// FIX: el handler usaba conn.reply sin recibir conn del framework — el comando
// entero crasheaba con "conn is not defined" SIEMPRE, incluso en el camino feliz.
const handler = async (m, { conn, args, usedPrefix, command }) => {
const defaultLang = 'es'
const msg = `ꕤ Por favor, ingresé el (idioma) (texto) para traducirlo.`  
if (!args || !args[0]) {
if (m.quoted && m.quoted.text) {
args = [defaultLang, m.quoted.text]
} else {
return m.reply(msg)
}}
let lang = args[0]
let text = args.slice(1).join(' ')
if ((args[0] || '').length !== 2) {
lang = defaultLang
text = args.join(' ')
}
try {
await m.react('🕒')
const result = await translate(`${text}`, { to: lang, autoCorrect: true })
await conn.reply(m.chat, result.text, m)
await m.react('✔️')
} catch (error) {
// reserva: traducción vía IA gratuita (reemplaza lolhuman, que exigía una
// apikey que nunca estaba definida — ese fallback crasheaba siempre)
try {
await m.react('🕒')
const prompt = `Traduce el siguiente texto al idioma "${lang}". Responde ÚNICAMENTE con la traducción, sin comillas ni explicaciones:\n\n${text}`
const r = await fetch('https://text.pollinations.ai/' + encodeURIComponent(prompt), { signal: AbortSignal.timeout(45000) })
const trad = (await r.text()).trim()
if (!trad) throw new Error('traducción vacía')
await conn.reply(m.chat, trad, m)
await m.react('✔️')
} catch (error) {
await m.react('✖️')
await m.reply(`⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`, m)
}}}

handler.help = ['translate']
handler.tags = ['tools']
handler.command = ['translate', 'traducir', 'trad']
handler.group = true

export default handler