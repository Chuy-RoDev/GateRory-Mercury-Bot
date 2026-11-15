import { exec } from 'child_process'
import fs from 'fs'

let handler = async (m, { conn, text, usedPrefix, command }) => {
if (!text) return m.reply(`ꕤ Por favor, ingresa el nombre de un paquete de NPMJs y versión (opcional).`)
// FIX (seguridad): antes el texto del usuario iba directo a exec(`npm pack ${pkg}@${ver}`)
// → inyección de comandos (ej: "/npm ; rm -rf ~"). Ahora el paquete y la versión se
// validan con whitelist estricta y exec corre con timeout y límite de buffer.
const PKG_RE = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i
const VER_RE = /^(latest|[a-z0-9-]+|\d+(\.\d+){0,3})$/i
async function npmdownloader(pkg, pkgver) {
try {
pkg = String(pkg || '').trim()
pkgver = String(pkgver || 'latest').trim()
if (!pkg || !PKG_RE.test(pkg) || pkg.length > 214) throw new Error('Nombre de paquete inválido. Usa solo letras, números, @ / . _ -')
if (!VER_RE.test(pkgver) || pkgver.length > 30) throw new Error('Versión inválida. Ejemplos: latest, 1.2.3, next')
await m.react('🕒')
const filePath = await new Promise((resolve, reject) => {
// timeout evita procesos zombi en Termux; maxBuffer evita crash por salida enorme
exec(`npm pack ${pkg}@${pkgver}`, { timeout: 120000, maxBuffer: 32 * 1024 * 1024 }, (error, stdout) => {
if (error) {
m.reply('Error')
console.error(`exec error: ${error}`)
reject(error)
return
}
resolve(stdout.trim())
}) })
const fileName = filePath.split('/').pop();
const data = await fs.promises.readFile(filePath)
let Link;
if (pkgver === 'latest') {
Link = `https://www.npmjs.com/package/${pkg}`
} else {
Link = `https://www.npmjs.com/package/${pkg}/v/${pkgver}`
}
const pkgInfo = await new Promise((resolve, reject) => {
exec(`npm view ${pkg} description`, { timeout: 30000, maxBuffer: 1024 * 1024 }, (error, stdout) => {
if (error) {
console.error(`Error al obtener la descripción: ${error}`)
reject('No se pudo obtener la descripción.')
return
}
resolve(stdout.trim())
}) })
await conn.sendMessage(m.chat, {document: data, mimetype: "application/zip", fileName: fileName, caption: `» Nombre: ${fileName}\n» Versión: ${pkgver}\n» Descripción: ${pkgInfo}\n» Link: ${Link}`},{ quoted: m })
await fs.promises.unlink(filePath)
} catch (err) {
console.error(`⚠︎ Error: ${err}`)
}}
try {
const [text2, ver] = text.split(",")
await npmdownloader(text2.trim(), ver ? ver.trim() : 'latest')
await m.react('✔️')
} catch (error) {
await m.react('✖️')
m.reply(`⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`)
}}

handler.help = ["npmdl"]
handler.tags = ["tools"]
handler.command = ["npmdownloader", "npmjs", "npmdl", "npm"]

export default handler