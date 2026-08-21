import { exec } from 'child_process'

let handler = async (m, { conn }) => {
    await conn.reply(m.chat, `ꕤ Buscando actualizaciones...`, m)
    exec('git stash && git pull origin main && git stash pop', async (err, stdout, stderr) => {
        if (err) return conn.reply(m.chat, `⚠︎ Error al actualizar:\n${err.message}`, m)
        if (stdout.includes('Already up to date')) {
            return conn.reply(m.chat, `ꕤ El bot ya está en su versión más reciente.`, m)
        }
        await conn.reply(m.chat, `ꕤ Actualización aplicada. Reiniciando...`, m)
        exec('pm2 restart index')
    })
}

handler.help = ['update']
handler.tags = ['owner']
handler.command = ['update']
handler.rowner = true
export default handler