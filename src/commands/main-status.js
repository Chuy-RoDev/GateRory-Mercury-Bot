import { cpus as _cpus, totalmem, freemem, platform, hostname } from 'os'
import { sizeFormatter } from 'human-readable'

const format = sizeFormatter({ std: 'JEDEC', decimalPlaces: 2, render: (l, s) => `${l} ${s}B` })
const plt = `${platform()} ${process.arch}`, host = hostname().slice(0, 8), cpuLen = _cpus().length, totalRam = format(totalmem())

let handler = async (m, { conn }) => {
    const u = global.db.data.users
    const c = global.db.data.chats
    
    await conn.sendMessage(m.chat, { text: `「✦」Estado de *${global.botname}*

❒ RAM [MAIN]: *${format(process.memoryUsage().rss)}*
❒ CPU (x${cpuLen}): *${(100 - (100 * _cpus()[0].times.idle / Object.values(_cpus()[0].times).reduce((a, b) => a + b))).toFixed(1)}%*
✿ Bots activos: *${global.conns?.length || 0}*
✐ Comandos: *${toNum(Object.values(u).reduce((a, b) => a + (b.commands || 0), 0))}*
❒ Usuarios: *${Object.keys(u).length}*
❒ Grupos: *${Object.keys(c).length}*
❒ Plugins: *${Object.keys(global.plugins).length}*

◤ Sistema:
    • *Plataforma:* ${plt}
    • *RAM Total:* ${totalRam}
    • *RAM Usada:* ${format(totalmem() - freemem())}
    • *Host:* ${host}...` }, { quoted: m })
}

handler.command = ['estado', 'status']
handler.group = true

export default handler

function toNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
    return n
}
