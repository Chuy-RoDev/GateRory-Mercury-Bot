import ws from 'ws'

const handler = async (m, { conn, args, usedPrefix }) => {
  const ctxErr = (global.rcanalx || {})
  
  try {
    if (!m.isGroup) return conn.reply(m.chat, 'ꕤ Este comando solo se puede usar en grupos.', m)

    const getDigits = (str) => {
      if (!str) return ''
      return String(str).replace(/[^0-9]/g, '')
    }

    // 1. Obtención de participantes y metadatos del grupo
    const meta = await conn.groupMetadata(m.chat).catch(() => null)
    const participants = meta?.participants || []
    
    // Resolver identificador del emisor (LID o JID normal)
    const senderRaw = m.sender || ''
    let senderDigits = getDigits(senderRaw)

    if (senderRaw.includes('@lid')) {
      const match = participants.find(p => p.lid === senderRaw || getDigits(p.lid) === senderDigits)
      if (match?.id) senderDigits = getDigits(match.id)
    }

    // Lista de Owners normalizada
    const ownerNumbers = (Array.isArray(global.owner) ? global.owner : [global.owner]).map(o => getDigits(o))
    
    // Verificación de rango de Administrador
    const isAdmin = participants.some(p => {
      const pId = getDigits(p.id)
      const pLid = getDigits(p.lid)
      const isUser = pId === senderDigits || pLid === senderDigits
      return isUser && (p.admin === 'admin' || p.admin === 'superadmin')
    }) || ownerNumbers.includes(senderDigits)

    if (!isAdmin) {
      return conn.reply(m.chat, 'ꕤ Solo los administradores del grupo pueden usar este comando.', m, ctxErr)
    }

    // 2. Extraer objetivo (mención, cita o argumento)
    let rawTarget = m.msg?.contextInfo?.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null) || args[0]
    if (!rawTarget && m.mentionedJid) {
      rawTarget = Array.isArray(m.mentionedJid) ? m.mentionedJid[0] : m.mentionedJid
    }

    if (!rawTarget) {
      return conn.reply(m.chat, `ꕤ Menciona, cita o escribe el número del Bot para configurarlo como principal.\n> Ejemplo: *${usedPrefix}setprimary @bot*`, m, ctxErr)
    }

    const targetDigits = getDigits(rawTarget)
    if (!targetDigits) {
      return conn.reply(m.chat, `ꕤ No se pudo identificar el número del bot objetivo.`, m, ctxErr)
    }

    // 3. Recopilar Sockets activos (Bot Principal + Sub-Bots)
    const mainBotRaw = global.conn?.user?.id || global.conn?.user?.jid || conn.user?.id || conn.user?.jid || ''
    const mainBotDigits = getDigits(mainBotRaw)

    const activeSubDigits = new Set()
    if (Array.isArray(global.conns)) {
      for (const c of global.conns) {
        const isAlive = c?.sock?.ws?.socket?.readyState !== ws.CLOSED
        if (isAlive) {
          const possibleSources = [c?.jid, c?.subId, c?.sock?.user?.id, c?.sock?.user?.jid]
          for (const raw of possibleSources) {
            const d = getDigits(raw)
            if (d) activeSubDigits.add(d)
          }
        }
      }
    }

    const allActiveDigits = Array.from(new Set([mainBotDigits, ...activeSubDigits]))

    // 4. Validación de Socket activo
    if (!allActiveDigits.includes(targetDigits)) {
      return conn.reply(m.chat, `ꕤ El número @${targetDigits} no corresponde a un Socket activo en este momento.`, m, { mentions: [`${targetDigits}@s.whatsapp.net`] })
    }

    const targetFullJid = `${targetDigits}@s.whatsapp.net`
    const chat = global.db.data.chats[m.chat] || (global.db.data.chats[m.chat] = {})

    if (chat.primaryBot === targetFullJid) {
      return conn.reply(m.chat, `ꕤ El bot @${targetDigits} ya es el principal en este grupo.`, m, { mentions: [targetFullJid] })
    }

chat.primaryBot = targetFullJid

// ← AGREGAR AQUÍ (6 líneas nuevas)
if (Array.isArray(global.conns)) {
    for (const c of global.conns) {
        const connDigits = getDigits(c.jid)
        if (connDigits === targetDigits && c.sock) {
            c.sock.customPrefix = chat.prefix || '/'
            break
        }
    }
}

await conn.reply(m.chat, `ꕤ Listo. Se ha establecido...`)

  } catch (e) {
    conn.reply(m.chat, `ꕤ Error: ${e.message}`, m)
  }
}

handler.help = ['setprimary']
handler.tags = ['grupo']
handler.command = ['setprimary']
handler.group = true

export default handler     