import fetch from 'node-fetch'

// ── PUBLICAR GRUPO EN gruposwats.com ─────────────────────────────────────────
// Automatiza el ALTA del grupo en https://www.gruposwats.com/ (paso 1 completo:
// ficha + enlace + validacion del sitio). El paso final del sitio esta protegido
// con Cloudflare Turnstile (captcha humano), asi que la publicacion NO puede ser
// 100% automatica de forma legitima: este comando devuelve el ENLACE DE
// VERIFICACION para que el usuario resuelva el captcha (1 toque) y presione
// "Correcto, Publicar" desde su navegador.
//
// Uso:
//   .publicargrupo Nombre | https://chat.whatsapp.com/XXXX | Descripcion | claves, aqui | tu@correo.com
// Opcional: +18 al inicio para marcar contenido adulto (filtro_sexo = s).
//   .publicargrupo +18 Nombre | https://chat.whatsapp.com/XXXX | Desc | claves | correo
// El correo es obligatorio: el sitio lo usa para gestionar/editar/borrar el grupo
// publicado y ahi llega la informacion de gestion.
// ──────────────────────────────────────────────────────────────────────────────

const SITE = global.gruposwatsBaseUrl || 'https://www.gruposwats.com'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const MAX_NOMBRE = 35, MAX_DESC = 150, MAX_KEYS = 90
const RE_ENLACE = /^https:\/\/chat\.whatsapp\.com\/[\w-]+$/
const RE_CORREO = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/

const stripTags = (s) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

// extrae value= de un <input> concreto (tolerante al orden de atributos)
function valorInput(html, campo) {
for (const tag of html.matchAll(/<input[^>]*>/gi)) {
const t = tag[0]
const nm = t.match(/name=["']([^"']*)["']/i)
if (nm && nm[1] === campo) {
const vl = t.match(/value=["']([^"']*)["']/i)
return vl ? vl[1] : ''
}}
return null
}

const handler = async (m, { conn, text, usedPrefix }) => {
if (!text || !text.includes('|')) return conn.reply(m.chat, ayudo(usedPrefix), m)
try {
await m.react('🕒')

// ---- parseo y validacion local (el sitio valida poco: mejor no enviar basura)
let adulto = false
let resto = text.trim()
if (/^\+18\b/i.test(resto)) { adulto = true; resto = resto.replace(/^\+18\b\s*/i, '') }
const partes = resto.split('|').map(p => p.trim())
if (partes.length < 5) return conn.reply(m.chat, `✧ Faltan datos. ${ayudo(usedPrefix)}`, m)
const [nombre, enlace, descripcion, claves, correo] = partes

if (!nombre || nombre.length > MAX_NOMBRE) return conn.reply(m.chat, `✧ El nombre es obligatorio y no puede pasar de ${MAX_NOMBRE} caracteres.`, m)
if (!RE_ENLACE.test(enlace)) return conn.reply(m.chat, '✧ El enlace debe ser de invitación de WhatsApp y verse así:\nhttps://chat.whatsapp.com/XXXXXXXX', m)
if (!descripcion || descripcion.length > MAX_DESC) return conn.reply(m.chat, `✧ La descripción es obligatoria y no puede pasar de ${MAX_DESC} caracteres.`, m)
if (!claves || claves.length > MAX_KEYS) return conn.reply(m.chat, `✧ Las palabras clave son obligatorias (máximo ${MAX_KEYS} caracteres). Ejemplo: anime, amigos, música`, m)
if (!RE_CORREO.test(correo)) return conn.reply(m.chat, '✧ Ese correo no tiene un formato válido.', m)

// ---- PASO 1a: abrir el formulario para tomar los tokens anti-spam (ck y tt),
//      que el sitio rota en CADA carga de la pagina.
const pagina = await fetch(`${SITE}/crear_grupo_whatsapp.php`, { headers: { 'User-Agent': UA, 'Referer': `${SITE}/` }, timeout: 25000 })
const htmlForm = await pagina.text()
const ck = valorInput(htmlForm, 'ck')
const tt = valorInput(htmlForm, 'tt')
if (!ck || !tt) throw new Error('No pude leer el formulario de gruposwats (cambió el sitio?). Intenta más tarde.')

// ---- PASO 1b: alta via el endpoint AJAX real del sitio
const cuerpo = new URLSearchParams({
i: '', h: '', p_c: '', ck, tt, filtro: 'n',
nombre, urlchat: enlace,
filtro_sexo: adulto ? 's' : 'n',
que_pais: 'n',
correo, correo2: correo,
keysciudad: '', descripcion, keys: claves,
cat1: '', cat2: '', cat3: '', privacidad: 'si',
})
const alta = await fetch(`${SITE}/0_ajax/verifica_paso_1.php`, {
method: 'POST',
headers: { 'User-Agent': UA, 'Referer': `${SITE}/crear_grupo_whatsapp.php`, 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded' },
body: cuerpo.toString(),
timeout: 25000,
})
const respuesta = (await alta.text()).trim()

// exito = el sitio devuelve la URL del paso 2 (verificacion humana)
const mm = respuesta.match(/crear_grupo_whatsapp_2\.php\?h=[^&\s"']+&ck=[^&\s"']+/)
if (!mm) throw new Error(`gruposwats rechazó el alta: ${stripTags(respuesta).slice(0, 220) || 'respuesta vacía'}`)

const enlaceVerificar = `${SITE}/${mm[0]}`
await conn.reply(m.chat, `ꕤ *Ficha enviada a gruposwats.com* ✔\n\n` +
`✦ Nombre: ${nombre}\n` +
`✦ Contenido adulto: ${adulto ? 'Sí (+18)' : 'No'}\n` +
`✦ Gestionado con: ${correo}\n\n` +
`⚠︎ Último paso (obligatorio):\n` +
`1) Abre este enlace en tu navegador:\n${enlaceVerificar}\n` +
`2) Resuelve la verificación de Cloudflare (un toque).\n` +
`3) Pulsa *Correcto, Publicar*.\n\n` +
`✧ Hazlo pronto: el enlace de verificación puede caducar.\n` +
`✧ A ese correo llegará la info para editar/borrar tu grupo.`, m)
await m.react('✔️')
} catch (error) {
await m.react('✖️')
conn.reply(m.chat, `⚠︎ No pude publicar el grupo.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`, m)
}}

function ayudo(usedPrefix) {
return `ꕤ *Cómo publicar tu grupo en gruposwats.com*\n\n` +
`✧ Formato:\n` +
`*${usedPrefix}publicargrupo Nombre | enlace | descripción | claves | correo*\n\n` +
`✧ Ejemplo:\n` +
`${usedPrefix}publicargrupo Anime Chatters | https://chat.whatsapp.com/AbCdEf123 | Grupo de anime en español | anime, amigos, chat | tucorreo@gmail.com\n\n` +
`✧ Opcional: pon *+18* al inicio si el grupo es para adultos.\n\n` +
`✧ Nota: el sitio pide una verificación humana al final; te doy el enlace listo para ese paso.`
}

handler.help = ['publicargrupo']
handler.tags = ['grupos']
handler.command = ['publicargrupo', 'publicargp']

export default handler
