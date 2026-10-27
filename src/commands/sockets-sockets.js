import { jidDecode } from '@whiskeysockets/baileys'

const linkRegex = /https:\/\/chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/i

// FIX: global.owner es un array de STRINGS ("57311...", ...). Antes se destructuraba
// como ([number]) => ..., lo que tomaba el PRIMER CARÁCTER ("5") y ningún owner pasaba
// el filtro. Ahora comparamos por dígitos de forma uniforme.
const digits = j => String(j || '').replace(/\D/g, '')
const ownerDigits = (Array.isArray(global.owner) ? global.owner : [])
    .map(o => Array.isArray(o) ? String(o[0]) : String(o))
    .filter(Boolean)

let handler = async (m, { conn, command, usedPrefix, text }) => {
    try {
        let nombreBot = global.botname || 'Shiroko'

        const myDigits = digits(conn.user?.id || conn.user?.jid)
        const permitidos = new Set(ownerDigits)
        if (myDigits) permitidos.add(myDigits)
        if (!permitidos.has(digits(m.sender))) {
            return m.reply(`ꕤ El comando *${command}* solo puede ser ejecutado por el Socket.`)
        }

        const acciones = {
            'self': async () => await gestionarModo(m, conn, usedPrefix, text, 'self', nombreBot, command),
            'public': async () => await gestionarModo(m, conn, usedPrefix, text, 'public', nombreBot, command),
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

async function gestionarModo(m, conn, usedPrefix, text, tipo, nombreBot, command) {
    if (!global.db.data.settings) global.db.data.settings = {}
    const connKey = conn.user?.id || conn.user?.jid || 'unknown'
    if (!global.db.data.settings[connKey]) {
        global.db.data.settings[connKey] = {}
    }

    const configuracion = global.db.data.settings[connKey]
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
    
    const mensajeEstado = `「✦」Configuración de *${nombreBot}*\n\nPuedes activar o desactivar el modo *${tipo}* utilizando:\n\n● Activar » ${usedPrefix}${command} enable\n● Desactivar » ${usedPrefix}${command} disable\n\n✧ Estado actual » *${estadoActual ? '✓ Activado' : '✗ Desactivado'}*`
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
    // FIX: antes tocaba datosChat.welcome (dejándolo forzado a true aunque el grupo lo
    // tuviera desactivado) y respondía DESPUÉS de salir (el reply al grupo fallaba
    // siempre). Avisamos antes de salir y no tocamos la config del chat.
    await m.reply(`ꕤ *${nombreBot}* saldrá del grupo en unos segundos...`).catch(() => {})
    await conn.groupLeave(idGrupo)
}

async function cerrarSesion(m, conn) {
    const myDigits = digits(conn.user?.id || conn.user?.jid)

    if (digits(global.conn?.user?.id || global.conn?.user?.jid) === myDigits) {
        return m.reply('ꕤ Este comando está deshabilitado en las sesiones principales.')
    }

    // FIX: las entradas de global.conns son { sock, subId, jid, name } — no tienen .user,
    // así que el findIndex original lanzaba TypeError y logout NUNCA funcionaba.
    // Además el wrapper no tiene logout(): es c.sock.logout().
    const indice = global.conns?.findIndex(c => c?.sock === conn || digits(c?.jid) === myDigits || digits(c?.sock?.user?.id) === myDigits)

    if (indice === -1 || !global.conns[indice]) {
        return m.reply('⚠︎ La sesión ya está cerrada o no se encontró una conexión activa.')
    }
    
    m.reply('✩ Tu sesión ha sido cerrada exitosamente.')
    
    setTimeout(async () => {
        try { await global.conns[indice]?.sock?.logout() } catch (e) { console.error('[SOCKET] logout:', e.message) }
        try { global.conns[indice]?.sock?.ws?.close() } catch {}
        const idx2 = global.conns.findIndex(c => c?.sock === conn || digits(c?.jid) === myDigits)
        if (idx2 !== -1) global.conns.splice(idx2, 1)
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