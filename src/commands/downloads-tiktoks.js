import fetch from "node-fetch";
import axios from 'axios';
// (fsSync eliminado: solo se usaba para el bloque roto de global.icons)

const CAUSA_API_KEY = 'causa-ee5ee31dcfc79da4';
const CAUSA_ENDPOINT = 'https://rest.apicausas.xyz/api/v1/descargas/tiktok';
const SIZE_LIMIT_MB = 100;

const newsletterJid = '120363418071540900@newsletter';
const newsletterName = "⏤͟͞ू⃪፝͜⁞⟡ 𝐄llen 𝐉ᴏ𝐄's 𝐒ervice";


const handler = async (m, { conn, args, usedPrefix, command }) => {
    // FIX: aquí se calculaba thumbnailBuffer con global.icons (¡que no existe en el repo!)
    // y Buffer.from(undefined, 'base64') lanzaba TypeError ANTES del try → el comando
    // .tt crasheaba SIEMPRE. Era código muerto, se elimina. Si quieres thumbnail local,
    // el global correcto es global.icono (Buffer de src/assets/menu.jpg).
    args = args.filter(v => v?.trim());

  // FIX: m.replyExternal no existe en este framework (ni en simple.js) → cualquier
  // respuesta del plugin lanzaba "m.replyExternal is not a function". Usamos m.reply.
  const sendExternalMessage = (msgText, options = {}) => m.reply(msgText, options)

  if (!args[0]) {
    return await sendExternalMessage(`*— (Bostezo)*... ¿Viniste a pedirme algo sin saber qué?\n\n🎧 ᥱȷᥱm⍴ᥣ᥆:\n${usedPrefix}${command} https://vt.tiktok.com/ZSmrDCvrS/`);
  }

  const isMode = ["audio", "video"].includes(args[0].toLowerCase());
  const type = isMode ? (args[0].toLowerCase() === "audio" ? "mp3" : "mp4") : "info";
  const queryOrUrl = isMode ? args[1] : args[0];

  // FIX: .tt audio / .tt video sin URL mandaba "undefined" a la API.
  if (isMode && !queryOrUrl) {
    return await sendExternalMessage(`*— Oye...* si me dices "${args[0].toLowerCase()}" también necesito el enlace.\n\n🎧 ᥱȷᥱm⍴ᥣ᥆:\n${usedPrefix}${command} ${args[0].toLowerCase()} https://vt.tiktok.com/ZSmrDCvrS/`);
  }

  await m.react("🔎");

  try {
    const apiUrl = `${CAUSA_ENDPOINT}?apikey=${CAUSA_API_KEY}&url=${encodeURIComponent(queryOrUrl)}&type=${type}`;
    // FIX: fetch sin timeout podía colgar el comando indefinidamente.
    const res = await fetch(apiUrl, { timeout: 30000 });
    const json = await res.json();

    if (!json.status) throw new Error(json.msg || 'No se pudo obtener el contenido.');
    const data = json.data;

    if (isMode) {
      const downloadUrl = data.download?.url;
      if (!downloadUrl) throw new Error("No se encontró el enlace de descarga.");

      // FIX: axios.head sin timeout ni manejo: si el CDN rechaza HEAD (403/405) la
      // descarga entera fallaba aunque el envío directo sí funcionaría.
      let fileSizeMb = 0;
      try {
        const response = await axios.head(downloadUrl, { timeout: 15000 });
        fileSizeMb = (parseInt(response.headers['content-length']) || 0) / (1024 * 1024);
      } catch (e) {
        console.error('[TIKTOK] HEAD falló, enviando directo:', e.message);
      }

      if (fileSizeMb > SIZE_LIMIT_MB) {
        await conn.sendMessage(m.chat, {
          document: { url: downloadUrl },
          fileName: `${data.titulo || 'tiktok'}.${type === 'mp3' ? 'mp3' : 'mp4'}`,
          mimetype: type === 'mp3' ? 'audio/mpeg' : 'video/mp4',
          caption: `⚠️ *Archivo pesado (${fileSizeMb.toFixed(2)} MB)*.\n\n> *Título:* ${data.titulo}`
        }, { quoted: m });
      } else {
        const media = type === 'mp3' 
          ? { audio: { url: downloadUrl }, mimetype: "audio/mpeg", fileName: `tiktok.mp3` }
          : { video: { url: downloadUrl }, caption: `🎬 *Aquí tienes.*\n\n> *Título:* ${data.titulo}`, mimetype: "video/mp4" };
        
        await conn.sendMessage(m.chat, media, { quoted: m });
      }
      await m.react("✅");

    } else {
      const vistasStr = (data.vistas !== undefined && data.vistas !== null) 
                        ? data.vistas.toLocaleString() 
                        : '0';
      
      const caption = `₊‧꒰ 🦈 ꒱ 𝙏𝙄𝙆𝙏𝙊𝙆 𝙄𝙉𝙁𝙊\n\n> *Autor:* ${data.autor || 'Desconocido'}\n> *Título:* ${data.titulo || 'Sin título'}\n> *Duración:* ${data.duracion || '---'}\n> *Vistas:* ${vistasStr}\n\n*— Elige si quieres audio o video.*`;

      const buttons = [
        { buttonId: `${usedPrefix}${command} video ${queryOrUrl}`, buttonText: { displayText: '🎬 𝙑𝙄𝘿𝙀𝙊' }, type: 1 },
        { buttonId: `${usedPrefix}${command} audio ${queryOrUrl}`, buttonText: { displayText: '🎧 𝘼𝙐𝘿𝙄𝙊' }, type: 1 }
      ];

      await conn.sendMessage(m.chat, {
        // FIX: el fallback era global.icons (indefinido) → si la API no mandaba thumbnail,
        // Baileys lanzaba error. Usamos global.icono (Buffer local) como respaldo.
        image: data.thumbnail ? { url: data.thumbnail } : global.icono,
        caption: caption + `\n\n> Escribe *${usedPrefix}${command} video <url>* o *${usedPrefix}${command} audio <url>* para descargar.`,
        footer: 'Victoria Housekeeping Service',
        buttons,
        headerType: 4,
        contextInfo: {
            mentionedJid: [m.sender],
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid,
                newsletterName,
                serverMessageId: -1
            }
        }
      }, { quoted: m });
    }

  } catch (e) {
    console.error(e);
    await m.react("❌");
    await sendExternalMessage(`*— Tsk...* Falló el servicio: ${e.message}`);
  }
};

handler.help = ['tiktok <URL>'];
handler.tags = ['descargas'];
handler.command = ['tiktok', 'tt'];
handler.register = true;

export default handler;