import { readdirSync, unlinkSync, existsSync, promises as fs, statSync } from 'fs'
import { tmpdir } from 'os'
import path, { join } from 'path'

const handler = async (m, { conn, __dirname, command, usedPrefix, isROwner }) => {
if (!isROwner) return
try {
switch (command) {
case 'delai': case 'dsowner': {
if (global.conn.user.jid !== conn.user.jid) {
return m.reply('ꕤ Utiliza este comando directamente en el número principal del Bot.')
}
const sessionPath = `./${sessions}/`
if (!existsSync(sessionPath)) return m.reply('ꕥ La carpeta de sesión está vacía.')
const files = await fs.readdir(sessionPath)
let filesDeleted = 0
for (const file of files) {
if (file !== 'creds.json') {
await fs.unlink(path.join(sessionPath, file))
filesDeleted++
}}
if (filesDeleted === 0) {
m.reply('ꕥ La carpeta de sesión no contenía archivos eliminables.')
} else {
m.reply(`ꕤ Se eliminaron ${filesDeleted} archivos de sesión, excepto el archivo creds.json.`)
}
break
}
case 'cleartmp': case 'vaciartmp': {
const tmpPaths = [tmpdir(), join(__dirname, '../tmp')]
let totalDeleted = 0
for (const dirname of tmpPaths) {
const files = readdirSync(dirname)
for (const file of files) {
const fullPath = join(dirname, file)
const stats = statSync(fullPath)
if (stats.isDirectory()) continue
unlinkSync(fullPath)
totalDeleted++
}}
m.reply(`ꕤ Listo, se eliminaron ${totalDeleted} archivos de las carpetas temporales.`)
break
}}} catch (err) {
m.reply(`⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${err.message}`)
}}

handler.help = ['delai', 'dsowner', 'cleartmp', 'vaciartmp']
handler.tags = ['owner']
handler.command = ['delai', 'dsowner', 'cleartmp', 'vaciartmp']

export default handler