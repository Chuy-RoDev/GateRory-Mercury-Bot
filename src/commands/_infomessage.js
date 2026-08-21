let WAMessageStubType = (await import('@whiskeysockets/baileys')).default

const lidCache = new Map()
const handler = m => m

handler.before = async function (m, { conn, participants }) {
    if (!m.messageStubType || !m.isGroup) return
    
    const primaryBot = global.db.data.chats[m.chat]?.primaryBot
    if (primaryBot && conn.user.jid !== primaryBot) return
    
    const chat = global.db.data.chats[m.chat]
    if (!chat?.detect) return

    const stubHandlers = {
        2: handleStub2,
        21: handleStub21,
        22: handleStub22,
        23: handleStub23,
        25: handleStub25,
        26: handleStub26,
        29: handleStub29,
        30: handleStub30
    }

    const handler = stubHandlers[m.messageStubType]
    if (handler) {
        await handler.call(this, m, { conn, participants })
    } else {
        console.log({
            messageStubType: m.messageStubType,
            messageStubParameters: m.messageStubParameters,
            type: WAMessageStubType[m.messageStubType]
        })
    }
}


async function handleStub2(m, { conn }) {
    const uniqid = m.chat.split('@')[0]
    const sessionPath = `./${sessions}/`
    
    try {
        const files = await fs.promises.readdir(sessionPath)
        const deletePromises = files
            .filter(file => file.includes(uniqid))
            .map(file => fs.promises.unlink(path.join(sessionPath, file)))
        
        await Promise.all(deletePromises)
    } catch (e) {

    }
}

async function handleStub21(m, { conn, participants }) {
    const usuario = await resolveLidToRealJid(m.sender, conn, m.chat)
    const groupAdmins = participants.filter(p => p.admin).map(v => v.id)
    const text = `ꕤ @${usuario.split('@')[0]} ha cambiado el nombre del grupo\n» Nuevo nombre: *${m.messageStubParameters[0]}*`
    
    await sendStubMessage.call(this, m.chat, text, [usuario, ...groupAdmins])
}

async function handleStub22(m, { conn, participants }) {
    const usuario = await resolveLidToRealJid(m.sender, conn, m.chat)
    const groupAdmins = participants.filter(p => p.admin).map(v => v.id)
    const text = `ꕤ @${usuario.split('@')[0]} ha cambiado la foto del grupo`
    
    const pp = await conn.profilePictureUrl(m.chat, 'image').catch(() => null)
    if (pp) {
        await sendStubMessage.call(this, m.chat, text, [usuario, ...groupAdmins], { image: { url: pp } })
    } else {
        await sendStubMessage.call(this, m.chat, text, [usuario, ...groupAdmins])
    }
}

async function handleStub23(m, { conn, participants }) {
    const usuario = await resolveLidToRealJid(m.sender, conn, m.chat)
    const groupAdmins = participants.filter(p => p.admin).map(v => v.id)
    const text = `ꕤ @${usuario.split('@')[0]} ha actualizado el enlace del grupo`
    
    await sendStubMessage.call(this, m.chat, text, [usuario, ...groupAdmins])
}

async function handleStub25(m, { conn, participants }) {
    const usuario = await resolveLidToRealJid(m.sender, conn, m.chat)
    const groupAdmins = participants.filter(p => p.admin).map(v => v.id)
    const setting = m.messageStubParameters[0] == 'on' ? 'Solo admins pueden editar' : 'Todos pueden editar'
    const text = `ꕤ @${usuario.split('@')[0]} ha modificado la configuración del grupo\n» ${setting}`
    
    await sendStubMessage.call(this, m.chat, text, [usuario, ...groupAdmins])
}

async function handleStub26(m, { conn, participants }) {
    const usuario = await resolveLidToRealJid(m.sender, conn, m.chat)
    const groupAdmins = participants.filter(p => p.admin).map(v => v.id)
    const status = m.messageStubParameters[0] == 'on' ? 'cerrado' : 'abierto'
    const permission = m.messageStubParameters[0] == 'on' ? 'Solo admins pueden escribir' : 'Todos pueden escribir'
    const text = `ꕤ @${usuario.split('@')[0]} ha ${status} el grupo\n» ${permission}`
    
    await sendStubMessage.call(this, m.chat, text, [usuario, ...groupAdmins])
}

async function handleStub29(m, { conn, participants }) {
    const usuario = await resolveLidToRealJid(m.sender, conn, m.chat)
    const userJid = m.messageStubParameters[0]
    const groupAdmins = participants.filter(p => p.admin).map(v => v.id)
    const text = `ꕤ @${usuario.split('@')[0]} ha promovido a admin a @${userJid.split('@')[0]}`
    
    await sendStubMessage.call(this, m.chat, text, [usuario, userJid, ...groupAdmins])
}

async function handleStub30(m, { conn, participants }) {
    const usuario = await resolveLidToRealJid(m.sender, conn, m.chat)
    const userJid = m.messageStubParameters[0]
    const groupAdmins = participants.filter(p => p.admin).map(v => v.id)
    const text = `ꕤ @${usuario.split('@')[0]} ha removido como admin a @${userJid.split('@')[0]}`
    
    await sendStubMessage.call(this, m.chat, text, [usuario, userJid, ...groupAdmins])
}

async function sendStubMessage(chat, text, mentionedJid, extra = {}) {
    const rcanal = {
        contextInfo: {
            mentionedJid: mentionedJid.filter(Boolean),
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: channelRD.id,
                serverMessageId: '',
                newsletterName: channelRD.name
            },
            externalAdReply: {
                title: "⸝⸝　 ꒰　A V I S O　꒱  ⁞　ˎˊ˗",
                body: textbot,
                previewType: "PHOTO",
                thumbnail: await fetch(icono).then(res => res.buffer()).catch(() => null),
                sourceUrl: redes
            }
        }
    }

    await this.sendMessage(chat, { text, ...rcanal, ...extra }, { quoted: null })
}

async function resolveLidToRealJid(lid, conn, groupChatId) {
    const inputJid = lid.toString()
    
    if (!inputJid.endsWith("@lid") || !groupChatId?.endsWith("@g.us")) {
        return inputJid.includes("@") ? inputJid : `${inputJid}@s.whatsapp.net`
    }
    
    if (lidCache.has(inputJid)) {
        return lidCache.get(inputJid)
    }

    try {
        const metadata = await conn.groupMetadata(groupChatId)
        if (!metadata?.participants) return inputJid

        const lidToFind = inputJid.split("@")[0]
        
        for (const participant of metadata.participants) {
            if (!participant?.jid) continue
            
            const contactDetails = await conn.onWhatsApp(participant.jid)
            if (!contactDetails?.[0]?.lid) continue
            
            const possibleLid = contactDetails[0].lid.split("@")[0]
            if (possibleLid === lidToFind) {
                lidCache.set(inputJid, participant.jid)
                return participant.jid
            }
        }
    } catch (e) {
    }

    lidCache.set(inputJid, inputJid)
    return inputJid
}

export default handler