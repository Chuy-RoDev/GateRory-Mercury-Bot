import { writeFileSync } from 'fs'
import { join } from 'path'

let handler = async (m, { conn, usedPrefix, isROwner }) => {
  if (!isROwner) return
  try {
    const { key } = await conn.reply(m.chat, `ꕤ Reiniciando a *Shiroko*...`, m)
    
    const restartPath = join(process.cwd(), 'src', 'json', 'restart.json')
    
    writeFileSync(restartPath, JSON.stringify({ chat: m.chat, key }, null, 2))

    setTimeout(() => {
      if (process.send) {
        process.send("restart")
      } else {
        process.exit(0)
      }
    }, 1000)
  } catch (error) {
    console.error(error)
    m.reply(`⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`)
  }
}

handler.help = ['restart']
handler.tags = ['owner']
handler.command = ['restart', 'reiniciar'] 

export default handler
