import db from '../../lib/database.js'

const handler = async (m, { conn, text, command, usedPrefix }) => {
    const ctxErr = (global.rcanalx || {})
    const ctxWarn = (global.rcanalw || {})

    try {
        const mentionedJid = await m.mentionedJid
        let who

        if (mentionedJid && mentionedJid.length > 0) {
            who = conn.decodeJid(mentionedJid[0])
        } else if (m.quoted) {
            who = conn.decodeJid(m.quoted.sender)
        } else if (text) {
            const mentionMatch = text.match(/@(\d+)/)
            if (mentionMatch) who = conn.decodeJid(mentionMatch[1] + '@s.whatsapp.net')
        }

        if (!who && ['warn', 'addwarn', 'advertencia', 'delwarn', 'unwarn'].includes(command)) {
            return conn.reply(m.chat, `ꕤ Menciona o cita a alguien.`, m, ctxErr)
        }

        if (who === m.sender) return conn.reply(m.chat, `ꕤ No puedes usarlo contigo mismo.`, m, ctxErr)

        const groupMetadata = await conn.groupMetadata(m.chat)
        const ownerGroup = conn.decodeJid(groupMetadata.owner || m.chat.split`-`[0] + '@s.whatsapp.net')
        const ownerBot = global.owner[0] ? conn.decodeJid((Array.isArray(global.owner[0]) ? global.owner[0][0] : global.owner[0]) + '@s.whatsapp.net') : null

        const chatData = global.db.data.chats[m.chat] || (global.db.data.chats[m.chat] = {})
        const warnLimit = chatData.warnLimit || 3

        if (who && !global.db.data.users[who]) global.db.data.users[who] = { warn: 0 }

        const username = (() => { const n = conn.getName(who); return typeof n === 'string' && n.trim() ? n : who.split('@')[0] })()

        switch (command) {
            case 'advertencia':
            case 'warn':
            case 'addwarn': {
                if (who === conn.user.jid) return conn.reply(m.chat, `ꕤ No puedo advertirme a mí mismo.`, m, ctxWarn)
                if (who === ownerGroup) return conn.reply(m.chat, `ꕤ No puedo advertir al dueño del grupo.`, m, ctxWarn)
                if (who === ownerBot) return conn.reply(m.chat, `ꕤ No puedo advertir al dueño del bot.`, m, ctxWarn)

                let motivo = text ? text.replace(/@\d+\s*/g, '').trim() : ''
                if (!motivo) motivo = 'Sin especificar'

                global.db.data.users[who].warn = (global.db.data.users[who].warn || 0) + 1
                const warnCount = global.db.data.users[who].warn

                await conn.reply(m.chat, `ꕤ *${username}* recibió una advertencia.\n> *Motivo:* ${motivo}\n> *Advertencias:* ${warnCount}/${warnLimit}`, m)

                if (warnCount >= warnLimit) {
                    global.db.data.users[who].warn = 0
                    await conn.reply(m.chat, `ꕤ *${username}* superó el límite y será eliminado.`, m)
                    try {
                        await conn.groupParticipantsUpdate(m.chat, [who], 'remove')
                    } catch {
                        conn.reply(m.chat, `ꕤ No pude eliminar a *${username}*. Verifica que soy administrador.`, m)
                    }
                }
                break
            }
            case 'delwarn':
            case 'unwarn': {
                if ((global.db.data.users[who].warn || 0) <= 0) return conn.reply(m.chat, `ꕤ El usuario tiene 0 advertencias.`, m, ctxWarn)
                global.db.data.users[who].warn -= 1
                await conn.reply(m.chat, `ꕤ A *${username}* se le quitó una advertencia.\n> *Advertencias:* ${global.db.data.users[who].warn}/${warnLimit}`, m)
                break
            }
            case 'listadv': {
                const adv = Object.entries(global.db.data.users).filter(([jid, u]) => u.warn > 0)
                const list = `❀ Usuarios Advertidos\n\n*Total: ${adv.length}*\n${adv.map(([jid, u]) => `● ${jid.split('@')[0]}: *(${u.warn}/${warnLimit})*`).join('\n')}\n\n⚠︎ Límite: *${warnLimit}*`
                await conn.reply(m.chat, list, m)
                break
            }
        }
    } catch (e) {
        conn.reply(m.chat, `ꕤ Error: ${e.message}`, m, ctxErr)
    }
}

handler.command = ['advertencia', 'warn', 'addwarn', 'delwarn', 'unwarn', 'listadv']
handler.group = handler.admin = handler.botAdmin = true
export default handler