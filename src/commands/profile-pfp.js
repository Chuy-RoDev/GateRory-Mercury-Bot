import { jidNormalizedUser } from '@whiskeysockets/baileys';

let handler = async (m, { conn, text, usedPrefix, command }) => {
    
    let mentionedJid = await m.mentionedJid || []; 
    
    let who = mentionedJid.length > 0 ? mentionedJid[0] : (m.quoted ? await m.quoted.sender : null); 
    
    if (!who && text) {
        let num = text.trim().replace(/[^0-9]/g, ''); 
        if (num.length >= 8 && num.length <= 15) { 
            who = jidNormalizedUser(num + '@s.whatsapp.net');
        }
    }
    
    if (!who) {
        return m.reply(`ꕤ Debes etiquetar a un usuario, responder a su mensaje.`);
    }

    let targetJid = jidNormalizedUser(who); 

    let name;
    let pp;
    
    try {
        name = (await conn.getName(targetJid)) || targetJid.split('@')[0];
    } catch {
        name = targetJid.split('@')[0];
    }

    let cleanedName;
    if (name.includes('@s.whatsapp.net') || name.startsWith('+')) {
        cleanedName = targetJid.split('@')[0].replace('+', '');
    } else {
        cleanedName = name;
    }
    
    try {
        pp = await conn.profilePictureUrl(targetJid, 'image');
    } catch (e) {
        pp = null;
    }

    if (!pp) {
        await conn.sendMessage(m.chat, { text: `ꕤ No se puede obtener la imagen de perfil de *${cleanedName}*` }, { quoted: m });
        return;
    }

    await conn.sendFile(m.chat, pp, 'profile.jpg', null, m);
}

handler.help = ['pfp']
handler.tags = ['rg']
handler.command = ['pfp', 'getpic']
handler.group = true

export default handler