import { jidDecode } from '@whiskeysockets/baileys'

const linkRegex = /https:\/\/chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/i

let handler = async (m, { conn, command, usedPrefix, text }) => {
    try {
        let nombreBot = global.botname || 'Shiroko'

        const usuariosPermitidos = [conn.user.jid, ...global.owner.map(([number]) => `${number}@s.whatsapp.net`)]
        if (!usuariosPermitidos.includes(m.sender)) {
            return m.reply(`ꕤ El comando *${command}* solo puede ser ejecutado por el Socket.`)
        }

        const acciones = {
            'self': async () => await gestionarModo(m, conn, usedPrefix, text, 'self', nombreBot),
            'public': async () => await gestionarModo(m, conn, usedPrefix, text, 'public', nombreBot),
            'join': async () => await unirseGrupo(m, conn, text, nombreBot),
            'salir': async () => await abandonarGrupo(m, conn, text, nombreBot),
            'leave': async () => await abandonarGrupo(m, conn, text, nombreBot),
            'logout': async () => await cerrarSesion(m, conn),
            'reload': async () => await recargarSesion(m, conn)
        }

        if (acciones[command]) {
            await acciones[command]()
        }

    } catch (error) {
        m.reply(`⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`)
    }
}

async function gestionarModo(m, conn, usedPrefix, text, tipo, nombreBot) {
    if (!global.db.data.settings) global.db.data.settings = {}
    if (!global.db.data.settings[conn.user.jid]) {
        global.db.data.settings[conn.user.jid] = {}
    }
    
    const configuracion = global.db.data.settings[conn.user.jid]
    const valor = text ? text.trim().toLowerCase() : ''
    const estadoActual = configuracion[tipo] || false
    const activar = valor === 'enable' || valor === 'on'
    const desactivar = valor === 'disable' || valor === 'off'
    
    if (activar || desactivar) {
        if (estadoActual === activar) {
            return m.reply(`ꕤ El modo *${tipo}* ya estaba ${activar ? 'activado' : 'desactivado'}.`)
        }
        configuracion[tipo] = activar
        return m.reply(`ꕤ Has *${activar ? 'activado' : 'desactivado'}* el modo *${tipo}* para *${nombreBot}*.`)
    }
    
    const mensajeEstado = `「✦」Configuración de *${nombreBot}*\n\nPuedes activar o desactivar el modo *${tipo}* utilizando:\n\n● Activar » ${usedPrefix}${m.command} enable\n● Desactivar » ${usedPrefix}${m.command} disable\n\n✧ Estado actual » *${estadoActual ? '✓ Activado' : '✗ Desactivado'}*`
    m.reply(mensajeEstado)
}

async function unirseGrupo(m, conn, text, nombreBot) {
    if (!text) return m.reply(`ꕤ Debes enviar un enlace de invitación para unirme a un grupo.`)
    
    const [_, codigo] = text.match(linkRegex) || []
    if (!codigo) return m.reply(`ꕤ El enlace de invitación no es válido.`)
    
    await conn.groupAcceptInvite(codigo)
    m.reply(`ꕤ *${nombreBot}* se ha unido exitosamente al grupo.`)
}

async function abandonarGrupo(m, conn, text, nombreBot) {
    const idGrupo = text || m.chat
    const datosChat = global.db.data.chats[m.chat]
    
    if (datosChat) {
        datosChat.welcome = false
    }
    
    await conn.groupLeave(idGrupo)
    
    if (datosChat) {
        datosChat.welcome = true
    }
    
    m.reply(`ꕤ *${nombreBot}* ha abandonado el grupo exitosamente.`)
}

async function cerrarSesion(m, conn) {
    const idRaw = conn.user?.id || ''
    const idLimpio = jidDecode(idRaw)?.user || idRaw.split('@')[0]
    
   const indice = global.conns?.findIndex(c => c.user.jid === conn.user.jid)
    
    if (global.conn.user.jid === conn.user.jid) {
        return m.reply('ꕤ Este comando está deshabilitado en las sesiones principales.')
    }
    
    if (indice === -1 || !global.conns[indice]) {
        return m.reply('⚠︎ La sesión ya está cerrada o no se encontró una conexión activa.')
    }
    
    m.reply('✩ Tu sesión ha sido cerrada exitosamente.')
    
    setTimeout(async () => {
        await global.conns[indice].logout()
        global.conns.splice(indice, 1)
    }, 1000)
}

async function recargarSesion(m, conn) {
    const idRaw = conn.user?.id || ''
    const idLimpio = jidDecode(idRaw)?.user || idRaw.split('@')[0]
    
    if (typeof global.reloadHandler !== 'function') {
        throw new Error('No se encontró la función global.reloadHandler')
    }
    
    await global.reloadHandler(true)
    m.reply('✿ La sesión fue recargada correctamente.')
}

handler.command = ['self', 'public', 'join', 'salir', 'leave', 'logout', 'reload']
handler.help = ['self', 'public', 'join', 'salir', 'leave', 'logout', 'reload']
handler.tags = ['socket']

export default handler