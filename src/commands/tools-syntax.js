// BY ABRAHAN-M
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

var handler = async (m, { usedPrefix, command }) => {
    try {
        conn.sendPresenceUpdate('composing', m.chat)

        const commandsDir = path.join(__dirname, '../commands/')

        if (!fs.existsSync(commandsDir)) {
            return await conn.reply(m.chat, `⚠︎ El directorio de comandos no existe:\n> ${commandsDir}\n\nVerifica la ruta correcta.`, m)
        }

        const files = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js'))

        if (files.length === 0) {
            return await conn.reply(m.chat, '⚠︎ No se encontraron archivos .js en el directorio de comandos.', m)
        }

        let response = `ꕤ *Revisión de Syntax Errors:*\n\n`
        let hasErrors = false

        for (const file of files) {
            try {
                // Se agrega un timestamp para evitar el cache del import y detectar cambios reales
                await import(path.resolve(commandsDir, file) + '?update=' + Date.now())
            } catch (error) {
                hasErrors = true
                response += `⚠︎ *Error en:* ${file}\n> ● Mensaje: ${error.message}\n\n`
            }
        }

        if (!hasErrors) {
            response += 'ꕤ ¡Todo está en orden! No se detectaron errores de sintaxis.'
        }

        await conn.reply(m.chat, response, m)
    } catch (err) {
        await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${err.message}`, m)
    }
}

handler.command = ['syntax', 'detectar', 'errores']
handler.help = ['syntax']
handler.tags = ['tools']
handler.rowner = true

export default handler
