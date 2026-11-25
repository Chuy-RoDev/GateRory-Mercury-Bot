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

// ── modo búsqueda (/tt <texto>): tikwm también sirve para buscar. Los resultados
// quedan 5 minutos por chat+usuario para elegir con /tt <número> y guardan los
// DATOS COMPLETOS del video: al elegir NO se vuelve a llamar a la API (tikwm
// limita a ~1 req/seg y la segunda llamada era otra fuente de fallos) ──
const busquedasPendientes = new Map(); // `${chat}|${sender}` → { lista, modo, ts }
const ESPERA_BUSQUEDA_MS = 5 * 60 * 1000;
const MAX_RESULTADOS_BUSQUEDA = 8;

// tikwm a veces responde con rutas relativas (/video/media/...) y otras con URL absoluta
const absTikwm = (u) => /^https?:\/\//i.test(u || '') ? u : (u ? 'https://www.tikwm.com' + u : '')

function mapearResultadosBusqueda(vids) {
    return vids
        .slice(0, MAX_RESULTADOS_BUSQUEDA)
        .map(v => {
            const id = String(v.video_id || v.id || '')
            const usuario = v.author?.unique_id || ''
            const datos = {
                fuente: 'tikwm',
                titulo: v.title || '',
                autor: v.author?.nickname || usuario || 'Desconocido',
                duracion: v.duration || 0,
                vistas: v.play_count || 0,
                likes: v.digg_count || 0,
                cover: absTikwm(v.cover || v.origin_cover),
                hd: absTikwm(v.hdplay), sd: absTikwm(v.play), sinMarca: absTikwm(v.wmplay),
                audio: absTikwm(v.music),
                fotos: Array.isArray(v.images) ? v.images.map(absTikwm) : [],
                esFoto: v.type === 'image' || Array.isArray(v.images) && v.images.length > 0
            }
            return {
                id, usuario,
                titulo: datos.titulo, duracion: datos.duracion, vistas: datos.vistas,
                urlCanonica: id && usuario ? `https://www.tiktok.com/@${usuario}/video/${id}` : '',
                // solo se lista lo que de verdad se puede enviar (video o fotos)
                datos: (datos.hd || datos.sd || datos.sinMarca || datos.fotos.length) ? datos : null
            }
        })
        .filter(v => v.datos)
}

// La búsqueda de tikwm es caprichosa: limita a ~1 req/seg y cuando te limita
// responde code -1 o el HTML de Cloudflare SIN datos — eso causaba el "No
// encontré nada" falso con "Mambo". Se reintenta con pausas y se distingue
// "el servicio no respondió bien" de "de verdad no hay resultados".
async function apiBuscarTikwm(texto) {
    const url = `https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(texto)}&count=${MAX_RESULTADOS_BUSQUEDA}&web=1`
    for (let intento = 0; intento < 3; intento++) {
        if (intento) await new Promise(r => setTimeout(r, 2000))
        try {
            const res = await axios.get(url, { headers: UA, timeout: 15000, validateStatus: () => true })
            const d = typeof res.data === 'string' ? null : res.data // HTML de Cloudflare → string
            const vids = d?.data?.videos || d?.data?.items || d?.data?.articles
            if (!Array.isArray(vids)) continue // 429, code -1, HTML → reintenta
            if (!vids.length) return { lista: [], caida: false } // respondió bien: no hay nada de verdad
            return { lista: mapearResultadosBusqueda(vids), caida: false }
        } catch { /* red caída: reintenta */ }
    }
    return { lista: [], caida: true }
}

const fmtDuracion = (s) => {
    s = Math.max(0, Math.round(Number(s) || 0))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const fmtVistas = (n) => {
    n = Number(n) || 0
    return n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace('.0', '') + 'K' : String(n)
}

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

    // m.reply(text, chatId, options): el 2º parámetro es el JID de destino
    // (lib/simple.js). Pasarle opciones como 2º arg metía un objeto {} como
    // jid y Baileys crasheaba en isJidNewsletter ("jid?.endsWith is not a
    // function"). Se pasa solo el texto; m.reply ya usa m.chat y cita el m.
    const sendExternalMessage = (msgText) => m.reply(msgText)

    if (!args[0]) {
        return await sendExternalMessage(`*— (Bostezo)*... ¿Viniste a pedirme algo sin saber qué?\n\n🎧 ᥱȷᥱm⍴ᥣ᥆:\n${usedPrefix}${command} https://vt.tiktok.com/ZSmrDCvrS/\n🔎 ᥒ𝗈 𝗍𝗂𝖾ᥒᥱ𝗌 𝖾ᥒᥣᥲᥴᥱ? También BUSCO: *${usedPrefix}${command} gatito bailando*`);
    }

    let isMode = ["audio", "video"].includes(args[0].toLowerCase());
    let type = isMode ? (args[0].toLowerCase() === "audio" ? "mp3" : "mp4") : "info";
    let queryOrUrl = isMode ? args[1] : args[0];

    if (isMode && !queryOrUrl) {
        return await sendExternalMessage(`*— Oye...* si me dices "${args[0].toLowerCase()}" también necesito un enlace o qué buscar.\n\n🎧 ᥱȷᥱm⍴ᥣ᥆:\n${usedPrefix}${command} ${args[0].toLowerCase()} https://vt.tiktok.com/ZSmrDCvrS/\n${usedPrefix}${command} ${args[0].toLowerCase()} gatito bailando`);
    }

    await m.react("🔎");

    try {
        // ── sin enlace: buscar en TikTok (o elegir un resultado de la búsqueda previa) ──
        const claveBusqueda = `${m.chat}|${m.sender}`
        const pendiente = busquedasPendientes.get(claveBusqueda)
        const pendienteVivo = pendiente && Date.now() - pendiente.ts < ESPERA_BUSQUEDA_MS ? pendiente : null
        if (!pendienteVivo) busquedasPendientes.delete(claveBusqueda)

        const esEnlace = /(?:tiktok\.com|vm\.tiktok|vt\.tiktok)/i.test(queryOrUrl || '')

        let elegidaDirecta = null
        if (!esEnlace) {
            const numero = parseInt(queryOrUrl)
            if (pendienteVivo && numero >= 1 && numero <= pendienteVivo.lista.length) {
                // eligió un resultado: sus datos YA vinieron con la búsqueda (sin
                // segunda llamada a la API); el enlace canónico queda para los botones
                elegidaDirecta = pendienteVivo.lista[numero - 1]
                queryOrUrl = elegidaDirecta.urlCanonica || elegidaDirecta.datos.hd || elegidaDirecta.datos.sd || elegidaDirecta.datos.sinMarca || ''
                if (pendienteVivo.modo && !isMode) { isMode = true; type = pendienteVivo.modo }
            } else {
                // buscar — con TODAS las palabras (antes solo se usaba args[0])
                const textoBusqueda = (isMode ? args.slice(1) : args).join(' ').trim() || queryOrUrl
                const { lista, caida } = await apiBuscarTikwm(textoBusqueda).catch(() => ({ lista: [], caida: true }))
                if (!lista.length) throw new Error(caida
                    ? 'La búsqueda de TikTok no respondió bien (está saturada o me limitó). Prueba otra vez en unos segundos o pásame el enlace directo.'
                    : `No encontré nada en TikTok para "${textoBusqueda}".`)
                busquedasPendientes.set(claveBusqueda, { lista, modo: isMode ? type : null, ts: Date.now() })
                for (const [k, v] of busquedasPendientes) {
                    if (Date.now() - v.ts > ESPERA_BUSQUEDA_MS) busquedasPendientes.delete(k)
                }
                const lineas = lista.map((v, i) =>
                    `> *${i + 1}.* ${v.usuario ? '@' + v.usuario : 'TikTok'} — ${fmtDuracion(v.duracion)} — ${fmtVistas(v.vistas)} vistas\n> ⌞ ${(v.titulo || 'sin título').slice(0, 60)}`)
                const pistaModo = isMode ? ` y sale *${args[0].toLowerCase()}* directo` : ''
                return await sendExternalMessage(
                    `₊‧꒰ 🔎 ꒱ 𝙏𝙄𝙆𝙏𝙊𝙆 — *"${textoBusqueda.slice(0, 60)}"*\n\n${lineas.join('\n')}\n\n*— Responde* con *${usedPrefix}${command} <número>*${pistaModo} (vigencia 5 min).`
                )
            }
        }

        // cadena: tikwm primero, alyacore de reserva (los resultados elegidos ya traen sus datos)
        let data = null
        if (elegidaDirecta) {
            data = elegidaDirecta.datos
        } else {
            try { data = await apiTikwm(queryOrUrl) } catch { data = null }
            if (!data) { try { data = await apiAlyacore(queryOrUrl) } catch { data = null } }
            if (!data) throw new Error('Ninguna API pudo leer ese TikTok (¿enlace privado o caído?).')
        }

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
                if (!url) throw new Error('ese resultado no trae video utilizable; prueba otro número o un enlace directo.')
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

handler.help = ['tiktok <URL | búsqueda>'];
handler.tags = ['descargas'];
// aliases tiktoks/tts restaurados (existían en la versión auditada y se habían perdido)
handler.command = ['tiktok', 'tt', 'tiktoks', 'tts'];
handler.register = true;

export default handler;
