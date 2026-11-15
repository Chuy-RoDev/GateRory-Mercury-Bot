import fetch from "node-fetch";
import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

// ─────────────────────────────────────────────────────────────
// CADENA DE APIs (reemplaza apicausas, dominio muerto)
//  1. tikwm.com  → video HD/SD + audio + fotos (la más completa)
//  2. alyacore   → solo video (reserva; para audio se extrae con ffmpeg)
// ─────────────────────────────────────────────────────────────

const ALYACORE_KEY = 'LUFFY-FIX67';
const SIZE_LIMIT_MB = 100;

const newsletterJid = '120363418071540900@newsletter';
const newsletterName = "⏤͟͞ू⃪፝͜⁞⟡ 𝐄llen 𝐉ᴏ𝐄's 𝐒ervice";

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer: 'https://www.tikwm.com/' };

async function apiTikwm(url) {
    const res = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`, {
        headers: UA, timeout: 30000, validateStatus: () => true
    })
    const d = res.data?.data
    if (!d || (!d.play && !d.hdplay && !d.wmplay && !(Array.isArray(d.images) && d.images.length))) return null
    return {
        fuente: 'tikwm',
        titulo: d.title || '',
        autor: d.author?.nickname || d.author?.unique_id || '',
        duracion: d.duration || 0,
        vistas: d.play_count || d.stats?.playCount || 0,
        likes: d.digg_count || d.stats?.diggCount || 0,
        cover: d.cover || d.origin_cover || '',
        hd: d.hdplay || '',
        sd: d.play || '',
        sinMarca: d.wmplay || '',
        audio: d.music || '',
        fotos: Array.isArray(d.images) ? d.images : [],
        esFoto: d.type === 'image' || Array.isArray(d.images) && d.images.length > 0
    }
}

async function apiAlyacore(url) {
    const res = await axios.get(`https://api.alyacore.xyz/dl/tiktok?url=${encodeURIComponent(url)}&key=${ALYACORE_KEY}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 30000, validateStatus: () => true
    })
    const d = res.data?.data || res.data?.result
    if (!res.data?.status || !d?.dl) return null
    return {
        fuente: 'alyacore',
        titulo: d.title || '',
        autor: d.author?.nickname || d.author?.unique_id || '',
        duracion: d.duration || 0,
        vistas: d.stats?.playCount || 0,
        likes: d.stats?.diggCount || 0,
        cover: d.cover || '',
        hd: d.dl, sd: d.dl, sinMarca: d.dl,
        audio: '', fotos: [],
        esFoto: d.type === 'image'
    }
}

async function pesoMB(url) {
    try {
        const r = await axios.head(url, { timeout: 15000, headers: UA, validateStatus: () => true })
        return (parseInt(r.headers['content-length']) || 0) / 1048576
    } catch { return 0 }
}

// extrae audio de un mp4 con ffmpeg (para alyacore, que no trae pista de audio)
async function extraerAudio(videoUrl, titulo) {
    const tmp = path.join(process.cwd(), 'tmp')
    if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true })
    const entrada = path.join(tmp, `tt_${Date.now()}.mp4`)
    const salida = path.join(tmp, `tt_${Date.now()}.mp3`)
    const r = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 120000, headers: UA })
    fs.writeFileSync(entrada, r.data)
    await new Promise((resolve, reject) => {
        ffmpeg(entrada).audioCodec('libmp3lame').audioBitrate(128).toFormat('mp3')
            .on('end', resolve).on('error', reject).save(salida)
    })
    const buffer = fs.readFileSync(salida)
    for (const f of [entrada, salida]) { try { fs.unlinkSync(f) } catch { } }
    return { buffer, titulo }
}

const handler = async (m, { conn, args, usedPrefix, command }) => {
    args = args.filter(v => v?.trim());

    const sendExternalMessage = (msgText, options = {}) => m.reply(msgText, options)

    if (!args[0]) {
        return await sendExternalMessage(`*— (Bostezo)*... ¿Viniste a pedirme algo sin saber qué?\n\n🎧 ᥱȷᥱm⍴ᥣ᥆:\n${usedPrefix}${command} https://vt.tiktok.com/ZSmrDCvrS/`);
    }

    const isMode = ["audio", "video"].includes(args[0].toLowerCase());
    const type = isMode ? (args[0].toLowerCase() === "audio" ? "mp3" : "mp4") : "info";
    const queryOrUrl = isMode ? args[1] : args[0];

    if (isMode && !queryOrUrl) {
        return await sendExternalMessage(`*— Oye...* si me dices "${args[0].toLowerCase()}" también necesito el enlace.\n\n🎧 ᥱȷᥱm⍴ᥣ᥆:\n${usedPrefix}${command} ${args[0].toLowerCase()} https://vt.tiktok.com/ZSmrDCvrS/`);
    }

    await m.react("🔎");

    try {
        // cadena: tikwm primero, alyacore de reserva
        let data = null
        try { data = await apiTikwm(queryOrUrl) } catch { data = null }
        if (!data) { try { data = await apiAlyacore(queryOrUrl) } catch { data = null } }
        if (!data) throw new Error('Ninguna API pudo leer ese TikTok (¿enlace privado o caído?).')

        if (isMode) {
            // audio: pista de tikwm; en alyacore se extrae del video con ffmpeg
            if (type === 'mp3') {
                if (data.audio) {
                    await conn.sendMessage(m.chat, {
                        audio: { url: data.audio }, mimetype: 'audio/mpeg', fileName: 'tiktok.mp3'
                    }, { quoted: m });
                } else {
                    const { buffer, titulo } = await extraerAudio(data.sd || data.hd, data.titulo)
                    await conn.sendMessage(m.chat, {
                        audio: buffer, mimetype: 'audio/mpeg', fileName: `${(titulo || 'tiktok').slice(0, 40)}.mp3`
                    }, { quoted: m });
                }
            } else if (data.fotos.length) {
                // publicación de fotos
                for (const foto of data.fotos.slice(0, 10)) {
                    await conn.sendFile(m.chat, foto, 'tiktok.jpg', `ꕤ ${data.titulo || 'Aquí tienes'}`, m)
                }
            } else {
                // video: si el HD pasa de 100MB se baja al SD y se envía igual, nunca documento
                let url = data.hd || data.sd || data.sinMarca
                const pesoHD = await pesoMB(url)
                if (pesoHD > SIZE_LIMIT_MB && data.sd && data.sd !== url) {
                    const pesoSD = await pesoMB(data.sd)
                    if (!pesoSD || pesoSD < pesoHD) url = data.sd
                }
                const caption = `🎬 *Aquí tienes.*\n\n> *Título:* ${data.titulo}`;
                await conn.sendMessage(m.chat, { video: { url }, caption, mimetype: 'video/mp4' }, { quoted: m });
            }
            await m.react("✅");

        } else {
            const vistasStr = (data.vistas !== undefined && data.vistas !== null) ? data.vistas.toLocaleString() : '0';

            const caption = `₊‧꒰ 🦈 ꒱ 𝙏𝙄𝙆𝙏𝙊𝙆 𝙄𝙉𝙁𝙊\n\n> *Autor:* ${data.autor || 'Desconocido'}\n> *Título:* ${data.titulo || 'Sin título'}\n> *Duración:* ${data.duracion || '---'}\n> *Vistas:* ${vistasStr}\n\n*— Elige si quieres audio o video.*`;

            const buttons = [
                { buttonId: `${usedPrefix}${command} video ${queryOrUrl}`, buttonText: { displayText: '🎬 𝙑𝙄𝘿𝙀𝙊' }, type: 1 },
                { buttonId: `${usedPrefix}${command} audio ${queryOrUrl}`, buttonText: { displayText: '🎧 𝘼𝙐𝘿𝙄𝙊' }, type: 1 }
            ];

            await conn.sendMessage(m.chat, {
                image: data.cover ? { url: data.cover } : global.icono,
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
// aliases tiktoks/tts restaurados (existían en la versión auditada y se habían perdido)
handler.command = ['tiktok', 'tt', 'tiktoks', 'tts'];
handler.register = true;

export default handler;
