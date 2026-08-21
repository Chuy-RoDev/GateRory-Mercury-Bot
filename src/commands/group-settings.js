let handler = async (m, { conn, command }) => {
    try {
        let isClose = { 
            'open': 'not_announcement', 
            'abrir': 'not_announcement', 
            'close': 'announcement', 
            'cerrar': 'announcement' 
        }[command]
        
        await conn.groupSettingUpdate(m.chat, isClose)
        await m.react('✅')
        
    } catch {
        await m.react('❌')
    }
}

handler.help = ['open', 'close', 'abrir', 'cerrar']
handler.tags = ['grupo']
handler.command = ['open', 'close', 'abrir', 'cerrar']
handler.admin = true
handler.botAdmin = true

export default handler