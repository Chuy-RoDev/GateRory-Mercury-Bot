import { exec } from 'child_process'
import fs from 'fs'

let handler = async (m, { conn, text, usedPrefix, command }) => {
if (!text) return m.reply(`ꕤ Por favor, ingresa el nombre de un paquete de NPMJs y versión (opcional).`)
async function npmdownloader(pkg, pkgver) {
try {
await m.react('🕒')
const filePath = await new Promise((resolve, reject) => {
exec(`npm pack ${pkg}@${pkgver}`, (error, stdout) => {
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
exec(`npm view ${pkg} description`, (error, stdout) => {
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