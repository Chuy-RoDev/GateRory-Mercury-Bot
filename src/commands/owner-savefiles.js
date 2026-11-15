import fs from 'fs'
import { unlinkSync, existsSync } from 'fs'

const handler = async (m, { conn, text, command, usedPrefix, isROwner }) => {
if (!isROwner) return
try {
const ar = Object.keys(plugins)
const ar1 = ar.map(v => v.replace('.js', ''))
switch (command) {
case 'saveplugin': {
if (!text) return m.reply(`ꕤ Por favor, ingrese el nombre del plugin.`)
if (!m.quoted || !m.quoted.text) return m.reply(`✧ Responda al mensaje con el contenido del plugin.`)
// FIX (seguridad): el nombre iba directo a la ruta → path traversal posible
// ("../../index" escribiría fuera de src/commands). Whitelist estricta.
if (!/^[a-zA-Z0-9_-]+$/.test(text.trim())) return m.reply(`✧ Nombre de plugin inválido. Usa solo letras, números, guiones y guion bajo (sin rutas).`)
const ruta = `src/commands/${text.trim()}.js`
await fs.writeFileSync(ruta, m.quoted.text)
m.reply(`ꕤ Guardando plugin en ${ruta}`)
break
}
case 'savefile': {
if (!text) return m.reply(`ꕤ Ingresa la Ruta y el nombre del Archivo junto al comando.`)
if (!m.quoted?.text) return m.reply(`ꕥ Responde al mensaje.`)
// FIX (seguridad): se bloquea path traversal ("..") y rutas absolutas.
if (/(^|\/)\.\.($|\/)/.test(text.trim()) || text.trim().startsWith('/') || text.trim().includes('\\')) return m.reply(`✧ Ruta inválida: no uses "..", rutas absolutas ni backslashes.`)
const path = `${text.trim()}.js`
await fs.writeFileSync(path, m.quoted.text)
m.reply(`ꕤ Guardado en *${path}*.`)
break
}
case 'deletefile': {
if (!text) return m.reply(`ꕤ Ingresa la ruta y el nombre del archivo que deseas eliminar.`)
const file = text.trim()
// FIX (seguridad): bloquear borrado por path traversal / archivos críticos.
if (/(^|\/)\.\.($|\/)/.test(file) || file.startsWith('/') || file.includes('\\')) return m.reply(`✧ Ruta inválida: no uses ".." ni rutas absolutas.`)
if (file === 'src/commands' || file.startsWith('Sessions/') || file.startsWith('Sessions')) return m.reply(`✧ No se permiten borrar sesiones ni carpetas.`)
if (!existsSync(file)) return m.reply(`ꕥ Archivo no encontrado.`)
unlinkSync(file)
m.reply(`ꕤ El archivo *${file}* ha sido eliminado con éxito.`)
break
}
case 'getplugin': {
if (!text) return m.reply(`ꕤ Ingrese el nombre de algún plugin existente*\n\n*—◉ Ejemplo*\n*◉ ${usedPrefix + command} downloads-play\n\n*—◉ Lista de commands:*\n*◉* ${ar1.map(v => ' ' + v).join`\n*◉*`}`)

const fullFileName = ar.find(fileName => fileName.endsWith(`${text}.js`))

if (!fullFileName) return m.reply(`ꕥ No se encontró el plugin "${text}".\n\n*—◉ commands existentes:*\n*◉* ${ar1.map(v => ' ' + v).join`\n*◉*`}`)

let filePath
if (fullFileName.startsWith('commands/')) {
    filePath = `./src/${fullFileName}` 
} else {
    filePath = `./src/${fullFileName}` 
}

await conn.sendMessage(m.chat, { 
    document: fs.readFileSync(filePath), 
    mimetype: 'application/javascript', 
    fileName: fullFileName 
}, { quoted: m })
break
}}} catch (e) {
m.reply(`⚠︎ Se ha producido un problema.\n> Usa ${usedPrefix}report para informarlo.\n\n${e.message}`)
}}

handler.help = ['saveplugin', 'savefile', 'deletefile', 'getplugin']
handler.tags = ['owner']
handler.command = ['saveplugin', 'savefile', 'deletefile', 'getplugin']

export default handler