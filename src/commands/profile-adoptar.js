var handler = async (m, { conn, usedPrefix, command }) => {
conn.adoptar = conn.adoptar ? conn.adoptar : {}
let user = global.db.data.users[m.sender]

// --- 1. LÓGICA PARA ABANDONAR / INDEPENDIZARSE ---
if (command === 'abandonar' || command === 'independizarse') {
    let esPadre = user.hijos && user.hijos.length > 0
    let esHijo = user.padres && user.padres.length > 0
    
    if (!esPadre && !esHijo) return conn.reply(m.chat, `「⚠️」 No tienes ningún vínculo familiar que romper.`, m)

    if (command === 'abandonar') {
        if (!esPadre) return conn.reply(m.chat, `「⚠️」 No tienes hijos a los cuales abandonar.`, m)
        let mentionedJid = await m.mentionedJid
        let hijoId = mentionedJid && mentionedJid.length ? mentionedJid[0] : (m.quoted ? m.quoted.sender : null)
        if (!hijoId) return conn.reply(m.chat, `「⚠️」 Menciona al hijo que deseas abandonar.\n> Ejemplo: *${usedPrefix}abandonar @hijo*`, m)
        
        const hijoName = await global.getProperName(conn, hijoId)
        
        // Eliminar del padre
        user.hijos = user.hijos.filter(id => id !== hijoId)
        // Eliminar de la pareja si existe
        if (user.marry) {
            let spouse = global.db.data.users[user.marry]
            if (spouse.hijos) spouse.hijos = spouse.hijos.filter(id => id !== hijoId)
        }
        // Eliminar del hijo
        let hijo = global.db.data.users[hijoId]
        if (hijo.padres) hijo.padres = hijo.padres.filter(id => id !== m.sender && id !== user.marry)
        
        return conn.reply(m.chat, `「💔」 Has abandonado a tu hijo/a *${hijoName}*. Ya no forma parte de tu familia.`, m, { mentions: [hijoId] })
    }

    if (command === 'independizarse') {
        if (!esHijo) return conn.reply(m.chat, `「⚠️」 No tienes padres de los cuales independizarte.`, m)
        
        let misPadres = [...user.padres]
        // Limpiar datos del hijo
        user.padres = []
        // Limpiar datos de los padres
        misPadres.forEach(padreId => {
            let p = global.db.data.users[padreId]
            if (p.hijos) p.hijos = p.hijos.filter(id => id !== m.sender)
        })

        return conn.reply(m.chat, `「🏃」 Te has independizado oficialmente. Ya no apareces como hijo de nadie en tu perfil.`, m, { mentions: misPadres })
    }
}

// --- 2. LÓGICA DE RESPUESTA (ACEPTAR / RECHAZAR) ---
if (command === 'aceptar' || command === 'rechazar') {
    if (!conn.adoptar[m.sender]) return 
    let { sender, timeout } = conn.adoptar[m.sender]
    let padre = global.db.data.users[sender]

    if (command === 'aceptar') {
        if (!padre.hijos) padre.hijos = []
        if (!user.padres) user.padres = []
        if (padre.hijos.length >= 3) {
            conn.reply(m.chat, '「❌」 La adopción falló: El usuario ya alcanzó el límite de 3 hijos.', m)
            clearTimeout(timeout); delete conn.adoptar[m.sender]; return
        }

        user.padres.push(sender)
        padre.hijos.push(m.sender)
        
        const adoptadorName = await global.getProperName(conn, sender)
        const adoptadoName = await global.getProperName(conn, m.sender)
        
        let pareja = padre.marry || null
        let txt = `「💖」 *¡ADOPCIÓN OFICIAL!*\n\nAhora *${adoptadoName}* es hijo/a de *${adoptadorName}*.\n`
        if (pareja) {
            let spouse = global.db.data.users[pareja]
            if (!spouse.hijos) spouse.hijos = []
            spouse.hijos.push(m.sender); user.padres.push(pareja)
            const parejaNombre = await global.getProperName(conn, pareja)
            txt += `> Al estar casados, *${parejaNombre}* también es su padre/madre.`
        }
        await conn.sendMessage(m.chat, { text: txt, mentions: pareja ? [m.sender, sender, pareja] : [m.sender, sender] }, { quoted: m })
        clearTimeout(timeout); delete conn.adoptar[m.sender]; return
    }

    if (command === 'rechazar') {
        conn.reply(m.chat, '「❌」 Has rechazado la solicitud de adopción.', m)
        clearTimeout(timeout); delete conn.adoptar[m.sender]; return
    }
}

// --- 3. LÓGICA DE SOLICITUD (ADOPTAR) ---
let mentionedJid = await m.mentionedJid
let who = mentionedJid && mentionedJid.length ? mentionedJid[0] : (m.quoted ? m.quoted.sender : null)
if (!who) return conn.reply(m.chat, `「⚠️」 Menciona a quién quieres adoptar.\n> Ejemplo: *${usedPrefix + command} @usuario*`, m)

let target = global.db.data.users[who]
if (!target) return conn.reply(m.chat, `「⚠️」 Ese usuario aún no tiene datos registrados en el bot.\n> Necesita interactuar primero.`, m)
if (!user.hijos) user.hijos = []
if (who === m.sender) return conn.reply(m.chat, '「❌」 No puedes adoptarte a ti mismo.', m)
if (target.marry) return conn.reply(m.chat, '「🚫」 No puedes adoptar a alguien casado/a.', m)
if (target.padres && target.padres.length > 0) return conn.reply(m.chat, '「❌」 Este usuario ya tiene padres.', m)
if (user.hijos.length >= 3) return conn.reply(m.chat, '「⚠️」 Ya tienes el límite de 3 hijos.', m)

const adoptadorName = await global.getProperName(conn, m.sender)
const adoptadoName = await global.getProperName(conn, who)

conn.adoptar[who] = {
    sender: m.sender,
    timeout: setTimeout(() => {
        conn.reply(m.chat, `「⏰」 La solicitud para *${adoptadoName}* expiró.`, m, { mentions: [who] })
        delete conn.adoptar[who]
    }, 60000)
}

let prop = `「📩」 *${adoptadorName}* quiere adoptarte.\n> Responde con: *${usedPrefix}aceptar* o *${usedPrefix}rechazar*`
await conn.sendMessage(m.chat, { text: prop, mentions: [m.sender, who] }, { quoted: m })
}

handler.help = ['adoptar', 'aceptar', 'rechazar', 'abandonar', 'independizarse']
handler.tags = ['perfil']
handler.command = ['adoptar', 'adopt', 'aceptar', 'rechazar', 'abandonar', 'independizarse']
handler.group = true

export default handler