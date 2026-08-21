const handler = async (m, { conn, text, isOwner, usedPrefix, command }) => {
    // Solo permitir a owners
    if (!isOwner) return conn.reply(m.chat, 'ꕥ Este comando es solo para propietarios del bot.', m)
    
    if (!text) return conn.reply(m.chat, `ꕥ *Formato incorrecto*\n\nUso: *${usedPrefix + command} <link> | <emoji>*`, m)
    
    // Separar el enlace y los emojis
    const parts = text.split('|').map(part => part.trim())
    if (parts.length !== 2) return conn.reply(m.chat, `ꕥ Formato incorrecto.\n\nUso: *${usedPrefix + command} <link> | <emoji>*`, m)
    
    const [postLink, emojisString] = parts
    const emojis = emojisString.split(',').map(e => e.trim()).filter(e => e)
    
    // Validar que sea un enlace de WhatsApp
    if (!postLink.includes('whatsapp.com/channel/') && !postLink.includes('wa.me/channel/')) {
        return conn.reply(m.chat, 'ꕥ El enlace debe ser de un canal de WhatsApp.', m)
    }
    
    if (emojis.length === 0 || emojis.length > 3) {
        return conn.reply(m.chat, 'ꕥ Debes proporcionar entre 1 y 3 emojis como máximo.', m)
    }
    
    try {
        // Enviar mensaje inicial
        const initialMsg = await conn.reply(m.chat, 'ꕤ *Enviando 1k reacciones al canal...*', m)
        
        // Probar diferentes formatos de URL de la API
        const apiKey = 'Arlette-Xz'
        const encodedLink = encodeURIComponent(postLink)
        const concatenatedEmojis = emojis.join('')
        const encodedEmojis = encodeURIComponent(concatenatedEmojis)
        
        // Opción 1: Formato original
        const apiUrl1 = `https://api-adonix.ultraplus.click/tools/react?apikey=${apiKey}&post_link=${encodedLink}&reacts=${encodedEmojis}`
        
        // Opción 2: Formato alternativo
        const apiUrl2 = `https://api-adonix.ultraplus.click/tools/react?post_link=${encodedLink}&reacts=${encodedEmojis}&apikey=${apiKey}`
        
        // Opción 3: Sin encodeURIComponent en emojis
        const apiUrl3 = `https://api-adonix.ultraplus.click/tools/react?apikey=${apiKey}&post_link=${encodedLink}&reacts=${concatenatedEmojis}`
        
        let success = false
        let result
        
        // Probar cada URL
        const urlsToTry = [apiUrl1, apiUrl2, apiUrl3]
        
        for (const url of urlsToTry) {
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'application/json',
                        'Origin': 'https://api-adonix.ultraplus.click',
                        'Referer': 'https://api-adonix.ultraplus.click/'
                    }
                })
                
                if (!response.ok) continue
                
                result = await response.json()
                
                if (result.status === 200 || 
                    result.status === 'success' || 
                    result.message?.toLowerCase().includes('exito') ||
                    result.message?.toLowerCase().includes('success') ||
                    result.success === true) {
                    success = true
                    break
                }
            } catch {
                continue
            }
        }
        
        if (success) {
            // Editar mensaje inicial con el formato solicitado
            await conn.sendMessage(m.chat, {
                text: `ꕤ *¡Reacciones de ${concatenatedEmojis} enviadas exitosamente!*`,
                edit: initialMsg.key
            })
        } else {
            // Editar mensaje inicial con error
            await conn.sendMessage(m.chat, {
                text: `ꕥ *No se pudo enviar las reacciones*\n\nPosibles causas:\n• API Key expirada\n• Enlace no válido\n• API fuera de servicio\n• Límite de uso alcanzado`,
                edit: initialMsg.key
            })
        }
        
    } catch (error) {
        console.error('Error:', error)
        conn.reply(m.chat, `ꕥ *Error al procesar la solicitud*\n\n${error.message}`, m)
    }
}

handler.help = ['1k <link> | <emoji>']
handler.tags = ['owner']
handler.command = ['1k', 'reacciones', 'r']
handler.owner = true

export default handler