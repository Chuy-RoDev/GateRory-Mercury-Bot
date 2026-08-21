const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/i;

export async function before(m, { conn, isAdmin, isBotAdmin }) {
    if (!m.isGroup || !m.text) return;

    const chat = global.db.data.chats[m.chat] || {};
    const isLink = linkRegex.test(m.text);

    if (chat.antiLink && isLink) {
        if (!isBotAdmin) return;
        if (isAdmin || m.fromMe) return; // Los admins no son expulsados

        await conn.sendMessage(m.chat, { delete: m.key });
        await conn.groupParticipantsUpdate(m.chat, [m.sender], 'remove');

        await conn.reply(m.chat, `ꕤ El usuario @${m.sender.split('@')[0]} ha sido eliminado por enviar enlaces. ✰`, null, { mentions: [m.sender] });
    }
    return true;
}
