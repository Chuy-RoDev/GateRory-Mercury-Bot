let proposals = {}

let handler = async (m, { conn, command, usedPrefix }) => {
    try {
        let sender = m.sender
        if (!global.db.data.users[sender]) global.db.data.users[sender] = {}

        if (command === 'marry') {
            // Mismo patron que mute: await m.mentionedJid
            const mentionedJid = await m.mentionedJid
            let targetRaw = (Array.isArray(mentionedJid) && mentionedJid.length)
                ? mentionedJid[0]
                : null

            // Resolver LID a JID real
            if (targetRaw && targetRaw.includes('@lid')) {
                try {
                    const meta = await conn.groupMetadata(m.chat)
                    const found = meta.participants.find(p =>
                        p.lid === targetRaw ||
                        p.lid?.split('@')[0] === targetRaw.split('@')[0]
                    )
                    if (found) targetRaw = found.jid || found.id || targetRaw
                } catch {}
            }

            // Si no hay mencion, intentar con quoted
            if (!targetRaw && m.quoted) {
                targetRaw = await Promise.resolve(m.quoted.sender)
                if (typeof targetRaw !== 'string') {
                    targetRaw = targetRaw?.jid || targetRaw?.id || String(targetRaw)
                }
            }

            let target = targetRaw
            if (target && (target.includes('@lid') || !target.includes('@s.whatsapp.net'))) {
                try {
                    const meta = await conn.groupMetadata(m.chat)
                    const found = meta.participants.find(p =>
                        p.lid === target ||
                        p.jid === target ||
                        p.id === target ||
                        p.lid?.split('@')[0] === target.split('@')[0] ||
                        p.jid?.split('@')[0] === target.split('@')[0]
                    )
                    if (found) target = found.jid || found.id || target
                } catch {}
            }

            if (!target) return m.reply(`Menciona o responde al mensaje de un usuario.\nUso: ${usedPrefix}marry @usuario`)
            if (sender === target) return m.reply(`No puedes proponerte matrimonio a ti mismo.`)

            if (!global.db.data.users[target]) global.db.data.users[target] = {}

            if (global.db.data.users[sender]?.marry) {
                const partner = global.db.data.users[sender].marry
                return conn.sendMessage(m.chat, {
                    text: `Ya estás casado/a con @${partner.split('@')[0]}`,
                    mentions: [partner]
                }, { quoted: m })
            }

            if (global.db.data.users[target]?.marry) {
                const partnerTarget = global.db.data.users[target].marry
                return conn.sendMessage(m.chat, {
                    text: `@${target.split('@')[0]} ya está casado/a con @${partnerTarget.split('@')[0]}`,
                    mentions: [target, partnerTarget]
                }, { quoted: m })
            }

            if (proposals[target] === sender) {
                delete proposals[target]
                global.db.data.users[sender].marry = target
                global.db.data.users[target].marry = sender
                await global.db.write()

                return conn.sendMessage(m.chat, {
                    text: `¡Se han Casado!\n\nEsposo/a: @${sender.split('@')[0]}\nEsposo/a: @${target.split('@')[0]}`,
                    mentions: [sender, target]
                }, { quoted: m })
            } else {
                proposals[sender] = target
                setTimeout(() => { if (proposals[sender]) delete proposals[sender] }, 120000)

                return conn.sendMessage(m.chat, {
                    text: `@${target.split('@')[0]}, @${sender.split('@')[0]} te ha propuesto matrimonio.\n\nResponde con ${usedPrefix}marry @${sender.split('@')[0]} para aceptar.\nLa propuesta expira en 2 minutos.`,
                    mentions: [target, sender]
                }, { quoted: m })
            }
        }

        if (command === 'divorce') {
            if (!global.db.data.users[sender]?.marry) return m.reply(`No estás casado/a con nadie.`)

            let partner = global.db.data.users[sender].marry
            global.db.data.users[sender].marry = ''
            if (global.db.data.users[partner]) global.db.data.users[partner].marry = ''
            await global.db.write()

            return conn.sendMessage(m.chat, {
                text: `@${sender.split('@')[0]} y @${partner.split('@')[0]} se han divorciado.`,
                mentions: [sender, partner]
            }, { quoted: m })
        }

    } catch (e) {
        console.error(e)
        await m.reply(`Error: ${e.message}`)
    }
}

handler.help = ['marry', 'divorce']
handler.tags = ['perfil']
handler.command = ['marry', 'divorce']
handler.group = true

export default handler