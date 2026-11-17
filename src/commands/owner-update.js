// /update · /fix · /actualizar · /up — UNIFICADO (antes había dos plugins que
// peleaban por /update). Combina: git stash pull pop con reinicio de pm2
// (de _update.js) + reporte detallado de archivos y detección de conflictos
// locales (de owner-update.js). Solo Real Owners.
import { exec, execSync } from 'child_process'

var handler = async (m, { conn, text, isROwner }) => {
    if (!isROwner) return

    try {
        await conn.reply(m.chat, `ꕤ Buscando actualizaciones...`, m)
        // stash pull pop: guarda cambios locales, actualiza y los devuelve
        const stdout = execSync('git stash && git pull origin main && git stash pop', { stdio: 'pipe' }).toString().trim()

        if (stdout.includes('Already up to date') || stdout.includes('Already up to date.')) {
            return conn.reply(m.chat, 'ꕤ El bot ya está en su versión más reciente.', m)
        }

        // Reporte detallado: archivos cambiados y total
        const lines = stdout.split('\n')
        const files = lines
            .filter(line => line.includes('|') && !line.includes('files changed'))
            .map(line => `> ✰ ${line.split('|')[0].trim()}`)
            .join('\n')
        const stats = lines.find(line => line.includes('changed'))
        const changedCount = stats ? stats.match(/\d+/g)?.[0] || '0' : '0'

        await conn.reply(m.chat, `\`❏ Actualización\`\n──────────────────\n\n*ꕤ Lista de Archivos*\n${files || '> ✰ sin detalles de archivos'}\n\n*ꕤ Cambios Totales: ${changedCount}*\n\n> Reiniciando...`, m)
        exec('pm2 restart index')
    } catch (e) {
        try {
            const status = execSync('git status --porcelain')
            if (status.length > 0) {
                const conflictedFiles = status.toString().split('\n')
                    .filter(line => line.trim() !== '')
                    .map(line => {
                        if (line.match(/\.npm\/|\.cache\/|tmp\/|database\.json|sessions\/|npm-debug\.log/)) return null
                        return '*→ ' + line.slice(3) + '*'
                    }).filter(Boolean)

                if (conflictedFiles.length > 0) {
                    const errorMessage = `\`⚠︎ No se pudo realizar la actualización:\`\n\n> *Se han encontrado cambios locales en los archivos del bot que entran en conflicto.*\n\n${conflictedFiles.join('\n')}`
                    return conn.reply(m.chat, errorMessage, m)
                }
            }
        } catch (error) {
            console.error(error)
        }
        const errorMessage2 = '⚠︎ Ocurrió un error inesperado al actualizar.'
        if (e.message) errorMessage2 += `\n⚠︎ Mensaje de error: ` + e.message
        return conn.reply(m.chat, errorMessage2, m)
    }
}

handler.help = ['update']
handler.tags = ['owner']
handler.command = ['update', 'fix', 'actualizar', 'up']
handler.rowner = true

export default handler
