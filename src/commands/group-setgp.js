import fetch from 'node-fetch'
import fs from 'fs'
import { generarBienvenida, generarDespedida } from './_welcome.js'

const handler = async (m, { conn, command, usedPrefix, text }) => {
  const value = text ? text.trim() : ''
  const chat = global.db.data.chats[m.chat]
  
  if (command === 'setgp') {
    return m.reply(`✦ Ingresa la categoría que deseas modificar para tu grupo.\n\n🜸 Categorías disponibles:\n• ${usedPrefix}gpname <nuevo nombre>\n> Cambia el nombre del grupo\n• ${usedPrefix}gpdesc <nueva descripción>\n> Modifica la descripción del grupo\n• ${usedPrefix}gpbanner <imagen>\n> Establece una nueva imagen para el grupo (responde a una imagen)\n• ${usedPrefix}setwelcome <mensaje>\n> Configura el mensaje de bienvenida para nuevos miembros\n• ${usedPrefix}setbye <mensaje>\n> Establece el mensaje de despedida al salir un usuario\n• ${usedPrefix}testwelcome\n> Simula el mensaje de bienvenida\n• ${usedPrefix}testbye\n> Simula el mensaje de despedida`)
  }
  
  try {
    switch (command) {
      case 'setwelcome': {
        if (!value) return m.reply(`ꕤ Debes enviar un mensaje de bienvenida.\n> Puedes usar {usuario}, {grupo} y {desc} como variables dinámicas.\n> Usa *|* para separar líneas en el mensaje.\n\n✐ Ejemplo: ${usedPrefix}setwelcome Bienvenido {usuario} | a {grupo}! | Léete las reglas 📌`)
        // Convierte cada | en salto de línea real
        chat.sWelcome = value.replace(/\s*\|\s*/g, '\n')
        m.reply(`ꕤ Has establecido el mensaje de bienvenida correctamente.\n> Puedes usar ${usedPrefix}testwelcome para ver cómo se verá.`)
        break
      }
      
      case 'setbye': {
        if (!value) return m.reply(`ꕤ Debes enviar un mensaje de despedida.\n> Puedes usar {usuario}, {grupo} y {desc} como variables dinámicas.\n> Usa *|* para separar líneas en el mensaje.\n\n✐ Ejemplo: ${usedPrefix}setbye Adiós {usuario} | te extrañaremos en {grupo}!`)
        // Convierte cada | en salto de línea real
        chat.sBye = value.replace(/\s*\|\s*/g, '\n')
        m.reply(`ꕤ Has establecido el mensaje de despedida correctamente.\n> Puedes usar ${usedPrefix}testbye para ver cómo se verá.`)
        break
      }
      
      case 'testwelcome': {
        const groupMetadata = m.isGroup ? await conn.groupMetadata(m.chat).catch(() => null) : null
        if (!groupMetadata) return m.reply('⚠︎ No se pudo obtener información del grupo.')
        
        const { image, caption, mentions } = await generarBienvenida({ 
          conn, 
          userId: m.sender, 
          groupMetadata, 
          chat 
        })
        
        await conn.sendMessage(m.chat, { 
          image: image, 
          caption: caption, 
          mentions: mentions 
        }, { quoted: m })
        break
      }
      
      case 'testbye': {
        const groupMetadata = m.isGroup ? await conn.groupMetadata(m.chat).catch(() => null) : null
        if (!groupMetadata) return m.reply('⚠︎ No se pudo obtener información del grupo.')
        
        const { image, caption, mentions } = await generarDespedida({ 
          conn, 
          userId: m.sender, 
          groupMetadata, 
          chat 
        })
        
        await conn.sendMessage(m.chat, { 
          image: image, 
          caption: caption, 
          mentions: mentions
        }, { quoted: m })
        break
      }
    }
  } catch (e) {
    console.error('Error en handler:', e)
    m.reply(`⚠︎ Se ha producido un problema.\n\n${e.message}`)
  }
}

handler.help = ['setwelcome', 'setbye', 'testwelcome', 'testbye']
handler.tags = ['group']
handler.command = ['setgp', 'setwelcome', 'setbye', 'testwelcome', 'testbye']
handler.admin = true
handler.group = true

export default handler