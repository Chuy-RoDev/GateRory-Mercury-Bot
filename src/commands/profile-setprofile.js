import { createHash } from 'crypto'
import fetch from 'node-fetch'
import moment from 'moment-timezone'

const handler = async (m, { conn, command, usedPrefix, text }) => {
try {
const user = global.db.data.users[m.sender]
if (command === 'setprofile') {
return m.reply(`✦ Ingresa la categoría que quieras modificar.\n\n🜸 *_Categorías disponibles:_*\n\n*• ${usedPrefix}setbirth _<01/01/2000|(dia/mes/año)>_*\n> *Establece tu fecha de cumpleaños.*\n*• ${usedPrefix}delbirth*\n> *Borra tu fecha de cumpleaños establecida.*\n*• ${usedPrefix}setgenre _<Hombre|Mujer>_*\n> *Establece tu género.*\n*• ${usedPrefix}delgenre*\n> *Borra tu género establecido.*\n*• ${usedPrefix}setdesc _<texto>_*\n> *Establece una descripción para tu perfil.*\n*• ${usedPrefix}deldesc*\n> *Borra tu descripción establecida.*`)
}
switch (command) {
case 'setbirth': {
if (!text) return conn.reply(m.chat, `ꕤ Debes ingresar una fecha válida para tu cumpleaños.\n\n> ✐ Ejemplo » *${usedPrefix + command} 01/01* (día/mes) o *${usedPrefix + command} 01/01/2000* (día/mes/año)`, m)
function validarFechaNacimiento(text) {
    const regex = /^\d{1,2}\/\d{1,2}(\/\d{4})?$/
    if (!regex.test(text)) return null
    
    const partes = text.split('/')
    const dia = parseInt(partes[0])
    const mes = parseInt(partes[1]) - 1
    const tieneAño = partes.length === 3
    const año = tieneAño ? parseInt(partes[2]) : moment.tz('America/Caracas').year()
    
    const fecha = moment.tz({ day: dia, month: mes, year: año }, 'America/Caracas')
    if (!fecha.isValid()) return null
    
    if (tieneAño) {
        const ahora = moment.tz('America/Caracas')
        const edad = ahora.diff(fecha, 'years')
        if (edad < 5 || edad > 120) return null
    }
    
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    
    if (tieneAño) {
        return `${dia} de ${meses[mes]} de ${año}`
    } else {
        return `${dia} de ${meses[mes]}`
    }
}
const birth = validarFechaNacimiento(text)
if (!birth) {
return conn.reply(m.chat, `ꕥ La fecha ingresada no es válida o no tiene lógica.\n> Ejemplo: *${usedPrefix + command} 01/12* o *${usedPrefix + command} 01/12/2000*`, m)
}
user.birth = birth
return conn.reply(m.chat, `ꕤ Se ha establecido tu fecha de nacimiento como: *${user.birth}*!`, m)
break
}
case 'delbirth': {
if (!user.birth) {
return conn.reply(m.chat, `ꕥ No tienes una fecha de nacimiento establecida que se pueda eliminar.`, m)
}
user.birth = ''
return conn.reply(m.chat, `ꕤ Tu fecha de nacimiento ha sido eliminada.`, m)
break
}
case 'setgenre': {
if (!text) return conn.reply(m.chat, `ꕤ Debes ingresar un género válido.\n> Ejemplo » *${usedPrefix + command} hombre*`, m)
function asignarGenre(text) {
let genre
switch (text.toLowerCase()) {
case "hombre":
genre = "Hombre"
break
case "mujer":
genre = "Mujer"
break
default:
return null
}
return genre
}
let genre = asignarGenre(text)
if (!genre) {
return conn.reply(m.chat, `ꕥ Recuerda elegir un género válido.\n> Ejemplo: ${usedPrefix + command} hombre`, m)
}
if (user.genre === genre) {
return conn.reply(m.chat, `ꕥ Ya tienes establecido el género como *${user.genre}*.`, m)
}
user.genre = genre
return conn.reply(m.chat, `ꕤ Se ha establecido tu género como: *${user.genre}*!`, m)
break
}
case 'delgenre': {
if (!user.genre) {
return conn.reply(m.chat, `ꕥ No tienes un género asignado.`, m)
}
user.genre = ''
return conn.reply(m.chat, `ꕤ Se ha eliminado tu género.`, m)
break
}
case 'setdescription': case 'setdesc': {
// Sin texto: borra la descripción y muestra cómo usarlo
if (!text) {
    if (user.description) {
        user.description = ''
        return conn.reply(m.chat, `ꕤ Tu descripción ha sido eliminada.\n\n> ✐ Para establecer una nueva usa:\n*${usedPrefix + command} línea 1 | línea 2 | línea 3*\n> Cada *|* representa un salto de línea en tu perfil.`, m)
    }
    return conn.reply(m.chat, `ꕤ Así se usa este comando:\n\n> *${usedPrefix + command} línea 1 | línea 2 | línea 3*\n> Cada *|* representa un salto de línea en tu perfil.\n\n✐ Ejemplo:\n*${usedPrefix + command} 妻が私を支配しているんだよ | Alex está en adopción 🗣️ | +58 422-4700479*`, m)
}
// Convierte cada | en salto de línea real
user.description = text.replace(/\s*\|\s*/g, '\n')
return conn.reply(m.chat, `ꕤ Se ha establecido tu descripción, puedes revisarla con ${usedPrefix}profile ฅ^•ﻌ•^ฅ`, m)
break
}
case 'deldescription': case 'deldesc': {
if (!user.description) {
return conn.reply(m.chat, `ꕥ No tienes una descripción establecida que se pueda eliminar.`, m)
}
user.description = ''
return conn.reply(m.chat, `ꕤ Tu descripción ha sido eliminada.`, m)
break
}}} catch (error) {
m.reply(`⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`)
}}

handler.help = ['setprofile', 'setbirth', 'delbirth', 'setgenre', 'setgenero', 'delgenre', 'setdescription', 'setdesc', 'deldescription', 'deldesc']
handler.tags = ['rg']
handler.command = ['setprofile', 'setbirth', 'delbirth', 'setgenre', 'setgenero', 'delgenre', 'setdescription', 'setdesc', 'deldescription', 'deldesc']
handler.group = true

export default handler