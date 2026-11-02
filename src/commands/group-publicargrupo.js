import fetch from 'node-fetch'

// ── PUBLICAR GRUPO EN gruposwats.com — ASISTENTE POR PASOS ───────────────────
// /publicar arranca un asistente conversacional: el bot pregunta un dato por
// mensaje y el usuario RESPONDE CITANDO cada pregunta (mismo patrón que
// /xvideos con los números). Al final muestra el resumen de cómo quedará la
// publicación, permite corregir/cancelar, y al confirmar envía el alta al
// sitio y devuelve el enlace de verificación.
//
// LÍMITE HONESTO: el paso final de gruposwats.com usa Cloudflare Turnstile
// (captcha humano), así que la publicación NO puede ser 100% automática; el
// bot hace TODO lo demás y entrega el enlace listo para ese último toque.
// ──────────────────────────────────────────────────────────────────────────────

const SITE = global.gruposwatsBaseUrl || 'https://www.gruposwats.com'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const MAX_NOMBRE = 35, MAX_DESC = 150, MAX_KEYS = 90
const RE_ENLACE = /^https:\/\/chat\.whatsapp\.com\/[\w-]+$/
const RE_CORREO = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/
const TIEMPO_LIMITE_MS = 10 * 60 * 1000 // 10 min por paso

const PASOS = ['nombre', 'enlace', 'descripcion', 'claves', 'correo', 'adulto']

// normaliza respuestas tipo botón: quita formato y puntuación suelta
const limpiar = (t) => t.toLowerCase().replace(/[¡!¿?.,;:*_~]/g, '').trim()

// ── textos de cada pregunta ──────────────────────────────────────────────────
function textoPaso(paso, datos = {}) {
switch (paso) {
case 'nombre':
return `ꕤ *Paso 1 de 6* — Nombre del grupo\n\n✦ ¿Cómo se llama tu grupo?\n\n✧ Máximo ${MAX_NOMBRE} caracteres.`
case 'enlace':
return `ꕤ *Paso 2 de 6* — Enlace de invitación\n\n✦ Manda el enlace de tu grupo (debe verse así):\nhttps://chat.whatsapp.com/XXXXXXXX\n\n✧ Cómo sacarlo: abre el grupo → toca el nombre del grupo → *Invitar mediante enlace* → *Copiar enlace*.`
case 'descripcion':
return `ꕤ *Paso 3 de 6* — Descripción\n\n✦ Escribe una descripción corta de tu grupo.\n\n✧ Máximo ${MAX_DESC} caracteres.`
case 'claves':
return `ꕤ *Paso 4 de 6* — Palabras clave\n\n✦ Separa por comas las palabras con las que la gente buscará tu grupo.\n\n✧ Ejemplo: anime, amigos, música\n✧ Máximo ${MAX_KEYS} caracteres.`
case 'correo':
return `ꕤ *Paso 5 de 6* — Correo de gestión\n\n✦ Escribe tu correo (el sitio lo usa para gestionar/editar/borrar tu grupo y ahí llega la info).\n\n✧ Ejemplo: tucorreo@gmail.com`
case 'adulto':
return `ꕤ *Paso 6 de 6* — Contenido adulto\n\n✦ ¿Tu grupo tiene contenido +18?\n\n✧ Responde *si* o *no*.`
case 'resumen':
return `ꕤ *Resumen de tu publicación*\n\n` +
`┌ ✦ Nombre: ${datos.nombre}\n` +
`├ ✦ Enlace: ${datos.enlace}\n` +
`├ ✦ Descripción: ${datos.descripcion}\n` +
`├ ✦ Claves: ${datos.claves}\n` +
`├ ✦ Correo de gestión: ${datos.correo}\n` +
`└ ✦ Contenido +18: ${datos.adulto ? 'Sí' : 'No'}\n\n` +
`✧ Así se publicará en gruposwats.com.\n\n` +
`✦ Responde a este mensaje:\n` +
`  • *confirmar* → lo envío al sitio\n` +
`  • *corregir* → eliges qué dato cambiar\n` +
`  • *cancelar* → lo dejamos así`
case 'elegir-corregir':
return `ꕤ ¿Qué dato quieres cambiar?\n\n✦ Responde: *nombre*, *enlace*, *descripción*, *claves*, *correo* o *+18*`
}
}

// ── motor del asistente ──────────────────────────────────────────────────────
function nuevaSesion(m) {
return {
sender: m.sender,
chat: m.chat,
paso: 'nombre',
datos: { nombre: null, enlace: null, descripcion: null, claves: null, correo: null, adulto: null },
preguntaKey: null,
timer: null,
}
}

async function preguntar(conn, m, session, paso = session.paso) {
clearTimeout(session.timer)
session.paso = paso
session.timer = setTimeout(() => {
const actual = conn.publicar?.[session.sender]
if (actual === session) {
delete conn.publicar[session.sender]
conn.sendMessage(session.chat, { text: '⏳ Se acabó el tiempo del asistente. Empieza de nuevo con tu prefijo + *publicar*.' }).catch(() => null)
}
}, TIEMPO_LIMITE_MS)
const info = await conn.sendMessage(m.chat, { text: textoPaso(paso, session.datos) }, { quoted: m })
session.preguntaKey = info?.key || null
}

function cancelar(conn, session) {
clearTimeout(session.timer)
delete conn.publicar[session.sender]
}

const stripTags = (s) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

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

// alta en el sitio (paso 1 del formulario real) — flujo verificado E2E
async function enviarAlSitio(datos) {
const pagina = await fetch(`${SITE}/crear_grupo_whatsapp.php`, { headers: { 'User-Agent': UA, 'Referer': `${SITE}/` }, timeout: 25000 })
const htmlForm = await pagina.text()
const ck = valorInput(htmlForm, 'ck')
const tt = valorInput(htmlForm, 'tt')
if (!ck || !tt) throw new Error('No pude leer el formulario de gruposwats (¿cambió el sitio?). Intenta más tarde.')
const cuerpo = new URLSearchParams({
i: '', h: '', p_c: '', ck, tt, filtro: 'n',
nombre: datos.nombre, urlchat: datos.enlace,
filtro_sexo: datos.adulto ? 's' : 'n',
que_pais: 'n',
correo: datos.correo, correo2: datos.correo,
keysciudad: '', descripcion: datos.descripcion, keys: datos.claves,
cat1: '', cat2: '', cat3: '', privacidad: 'si',
})
const alta = await fetch(`${SITE}/0_ajax/verifica_paso_1.php`, {
method: 'POST',
headers: { 'User-Agent': UA, 'Referer': `${SITE}/crear_grupo_whatsapp.php`, 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded' },
body: cuerpo.toString(),
timeout: 25000,
})
const respuesta = (await alta.text()).trim()
const mm = respuesta.match(/crear_grupo_whatsapp_2\.php\?h=[^&\s"']+&ck=[^&\s"']+/)
if (!mm) throw new Error(`gruposwats rechazó el alta: ${stripTags(respuesta).slice(0, 220) || 'respuesta vacía'}`)
return `${SITE}/${mm[0]}`
}

// validaciones por paso (mismos límites que el sitio)
function validar(paso, texto) {
switch (paso) {
case 'nombre':
if (!texto) return 'El nombre no puede ir vacío.'
if (texto.length > MAX_NOMBRE) return `El nombre no puede pasar de ${MAX_NOMBRE} caracteres (lleva ${texto.length}).`
return null
case 'enlace':
if (!RE_ENLACE.test(texto)) return 'Ese no es un enlace de invitación de WhatsApp. Debe verse así: https://chat.whatsapp.com/XXXXXXXX'
return null
case 'descripcion':
if (!texto) return 'La descripción no puede ir vacía.'
if (texto.length > MAX_DESC) return `La descripción no puede pasar de ${MAX_DESC} caracteres (lleva ${texto.length}).`
return null
case 'claves':
if (!texto) return 'Las palabras clave no pueden ir vacías.'
if (texto.length > MAX_KEYS) return `Las claves no pueden pasar de ${MAX_KEYS} caracteres (lleva ${texto.length}).`
return null
case 'correo':
if (!RE_CORREO.test(texto)) return 'Ese correo no tiene un formato válido. Ejemplo: tucorreo@gmail.com'
return null
case 'adulto':
if (!/^(s|si|sí|yes|1|n|no|0)$/i.test(texto)) return 'Responde *si* o *no*.'
return null
}
return null
}

// ── INICIO: /publicar ────────────────────────────────────────────────────────
const handler = async (m, { conn, text, usedPrefix }) => {
conn.publicar = conn.publicar || {}
if (/^cancelar$/i.test(limpiar(text || ''))) {
const vieja = conn.publicar[m.sender]
if (vieja) cancelar(conn, vieja)
return conn.reply(m.chat, 'ꕤ Asistente cancelado. Cuando quieras: *' + usedPrefix + 'publicar*', m)
}
// sesión nueva (reemplaza una anterior si la hubiera)
clearTimeout(conn.publicar[m.sender]?.timer)
const session = nuevaSesion(m)
conn.publicar[m.sender] = session
await conn.reply(m.chat,
`ꕤ *ASISTENTE PARA PUBLICAR TU GRUPO*\n\n` +
`Te voy preguntando un dato por mensaje.\n` +
`✦ *Responde citando cada pregunta* (mantén pulsado el mensaje → *Responder*).\n` +
`✧ Escribe *cancelar* en cualquier momento para parar.\n\n` +
`✧ Modo rápido (todo de una vez):\n` +
`${usedPrefix}publicar Nombre | enlace | descripción | claves | correo`, m)
await preguntar(conn, m, session, 'nombre')
}

handler.help = ['publicar']
handler.tags = ['grupos']
handler.command = ['publicar', 'publicargrupo', 'publicargp']

// ── RESPUESTAS: cada mensaje que cita la pregunta activa ─────────────────────
handler.before = async (m, { conn }) => {
conn.publicar = conn.publicar || {}
const session = conn.publicar[m.sender]
if (!session || m.chat !== session.chat) return
if (!m.quoted || !session.preguntaKey || m.quoted.id !== session.preguntaKey.id) return
const texto = (m.text || '').trim()
if (!texto) return

// cancelar en cualquier paso
if (/^cancelar$/i.test(limpiar(texto))) {
cancelar(conn, session)
await m.reply('ꕤ Asistente cancelado. Cuando quieras: tu prefijo + *publicar*')
return
}

// resumen final: confirmar / corregir
if (session.paso === 'resumen') {
const orden = limpiar(texto)
if (CONFIRMAR_PALABRAS.includes(orden)) {
session.paso = 'enviando'
try {
const enlace = await enviarAlSitio(session.datos)
const correo = session.datos.correo
cancelar(conn, session)
await m.react('✔️')
return m.reply(`ꕤ *Ficha enviada a gruposwats.com* ✔\n\n` +
`✧ Último paso (obligatorio):\n` +
`1) Abre este enlace en tu navegador:\n${enlace}\n` +
`2) Resuelve la verificación de Cloudflare (un toque).\n` +
`3) Pulsa *Correcto, Publicar*.\n\n` +
`✧ Hazlo pronto: el enlace puede caducar.\n` +
`✧ A ${correo} llegará la info para editar/borrar tu grupo.`)
} catch (error) {
session.paso = 'resumen' // vuelve al resumen para reintentar
await m.react('✖️')
return m.reply(`⚠︎ No pude enviar la ficha.\n${error.message}\n\n✧ Responde *confirmar* para reintentar, *corregir* o *cancelar*.`)
}
}
if (CORREGIR_PALABRAS.includes(orden)) {
await preguntar(conn, m, session, 'elegir-corregir')
return
}
await m.reply('✧ Responde *confirmar*, *corregir* o *cancelar*.')
return
}

// elegir qué dato corregir
if (session.paso === 'elegir-corregir') {
const mapa = { nombre: 'nombre', enlace: 'enlace', descripcion: 'descripcion', desc: 'descripcion', claves: 'claves', keys: 'claves', correo: 'correo', email: 'correo', '+18': 'adulto', 18: 'adulto', adulto: 'adulto' }
const destino = mapa[limpiar(texto)]
if (!destino) { await m.reply('✧ No entendí. Responde: *nombre*, *enlace*, *descripción*, *claves*, *correo* o *+18*.'); return }
await preguntar(conn, m, session, destino)
return
}

// mientras se envía la ficha, ignorar respuestas nuevas
if (!PASOS.includes(session.paso)) return

// atajo modo rápido: en el paso nombre, acepta el formato completo de una vez
if (session.paso === 'nombre' && texto.split('|').length >= 5) {
const p = texto.split('|').map(x => x.trim())
const prueba = { nombre: p[0], enlace: p[1], descripcion: p[2], claves: p[3], correo: p[4] }
const err = validar('nombre', prueba.nombre) || validar('enlace', prueba.enlace) || validar('descripcion', prueba.descripcion) || validar('claves', prueba.claves) || validar('correo', prueba.correo)
if (err) { await m.reply('✧ ' + err + '\n\n✧ Manda solo el nombre, o el formato completo: Nombre | enlace | descripción | claves | correo'); return }
Object.assign(session.datos, prueba)
await m.reply('ꕤ Modo rápido detectado — solo falta un dato.')
return preguntar(conn, m, session, 'adulto')
}

// validación del paso actual
const error = validar(session.paso, texto)
if (error) { await m.reply('✧ ' + error + '\n\n✧ Responde citando la pregunta de nuevo.'); return }

if (session.paso === 'adulto') session.datos.adulto = /^(s|si|sí|yes|1)$/i.test(texto)
else session.datos[session.paso] = texto

const i = PASOS.indexOf(session.paso)
if (i < PASOS.length - 1) return preguntar(conn, m, session, PASOS[i + 1])

// completó el último dato → resumen
await preguntar(conn, m, session, 'resumen')
}

const CONFIRMAR_PALABRAS = ['confirmar', 'publicar ahora', 'listo', 'enviar', 'si, confirmar', 'dale', 'ok']
const CORREGIR_PALABRAS = ['corregir', 'cambiar', 'editar']

export default handler
