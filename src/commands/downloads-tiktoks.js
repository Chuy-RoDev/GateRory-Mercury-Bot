import axios from "axios";
import { generateWAMessageFromContent, generateWAMessage, jidNormalizedUser } from "@fer2809fl/baileys";
import crypto from "crypto";
import { downloadToTmp, cleanTmp, react, firstSuccessful, UA_HEADER } from "../../src/downloader.js";

const DELIRIUS_URL = "https://api.delirius.store/";
const FAA_URL = "https://api-faa.my.id/";

const TIKTOK_REGEX = /^(https?:\/\/)?(www\.|vm\.|vt\.)?tiktok\.com\/.*$/i;

const formatNumbers = (num) => {
    if (num === undefined || num === null || num === "") return "0";
    const n = Number(num);
    if (!Number.isFinite(n)) return "0";
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
};

const normalizeDuration = (value) => {
    if (value === undefined || value === null) return 0;
    const raw = String(value).trim();
    const match = raw.match(/(\d+(?:\.\d+)?)/);
    if (!match) return 0;
    const numero = Number(match[0]);
    if (!Number.isFinite(numero) || numero <= 0) return 0;
    return numero > 1000 ? Math.round(numero / 1000) : Math.round(numero);
};

const parseDelimitedNumber = (value) => {
    if (value === undefined || value === null) return 0;
    const raw = String(value).trim();
    if (!raw) return 0;
    if (/^\d{1,3}(?:\.\d{3})+$/.test(raw)) {
        return Number(raw.replace(/\./g, ""));
    }
    const normalized = raw.replace(/,/g, "");
    const numero = Number(normalized);
    return Number.isFinite(numero) ? numero : 0;
};

// Función auxiliar para enviar álbumes nativos en Baileys
async function sendAlbumMessage(sock, jid, array, quoted) {
    const userJid = jidNormalizedUser(sock.user?.id || sock.authState?.creds?.me?.id || "");
    const album = await generateWAMessageFromContent(jid, {
        messageContextInfo: { messageSecret: crypto.randomBytes(32) },
        albumMessage: {
            expectedImageCount: array.filter((a) => "image" in a).length,
            expectedVideoCount: array.filter((a) => "video" in a).length,
        },
    }, { quoted, userJid });

    await sock.relayMessage(jid, album.message, { messageId: album.key.id });

    for (const item of array) {
        const img = await generateWAMessage(jid, item, { upload: sock.waUploadToServer, userJid });
        img.message.messageContextInfo = {
            messageSecret: crypto.randomBytes(32),
            messageAssociation: { associationType: 1, parentMessageKey: album.key },
        };
        await sock.relayMessage(jid, img.message, { messageId: img.key.id });
    }
    return album;
}

// Scrapers de descarga
async function downloadDelirius(url) {
    const res = await axios.get(`${DELIRIUS_URL}download/tiktok?url=${encodeURIComponent(url)}`, {
        timeout: 30000,
        headers: { "User-Agent": UA_HEADER }
    });
    const data = res.data?.data;
    if (!data) throw new Error("Sin datos de Delirius");

    let videoUrl = null;
    if (data.meta?.media && Array.isArray(data.meta.media)) {
        const videoMedia = data.meta.media.find(m => m.type === "video");
        videoUrl = videoMedia?.org || videoMedia?.hd || videoMedia?.wm;
    }
    videoUrl = videoUrl || data.url;
    if (!videoUrl) throw new Error("No se encontró URL de video en Delirius");

    return {
        id: data.id || `tiktok_${Date.now()}`,
        title: data.title || "",
        author: data.author?.nickname || data.author?.username || "TikTok User",
        views: formatNumbers(parseDelimitedNumber(data.repro || 0)),
        likes: formatNumbers(parseDelimitedNumber(data.like || 0)),
        videoUrl,
        duration: normalizeDuration(data.duration || 0)
    };
}

async function downloadFaa(url) {
    const res = await axios.get(`${FAA_URL}faa/tiktok?url=${encodeURIComponent(url)}`, {
        timeout: 30000,
        headers: { "User-Agent": UA_HEADER }
    });
    const result = res.data?.result;
    if (!result) throw new Error("Sin resultado de FAA");

    const videoUrl = result.alternatives?.selected || result.data || result.url;
    if (!videoUrl) throw new Error("No se encontró URL de video en FAA");

    return {
        id: result.id || `tiktok_${Date.now()}`,
        title: result.title || "",
        author: result.author?.nickname || result.author?.username || "TikTok User",
        views: formatNumbers(result.stats?.views || 0),
        likes: formatNumbers(result.stats?.likes || 0),
        videoUrl,
        duration: result.duration ? normalizeDuration(parseInt(String(result.duration).match(/\d+/)?.[0] || 0)) : 0
    };
}

async function getDownloadInfo(url) {
    return firstSuccessful([
        downloadDelirius(url),
        downloadFaa(url)
    ]);
}

// Scrapers de búsqueda
async function searchDelirius(query) {
    const res = await axios.get(`${DELIRIUS_URL}search/tiktoksearch?query=${encodeURIComponent(query)}`, {
        timeout: 20000,
        headers: { "User-Agent": UA_HEADER }
    });
    const videos = res.data?.meta;
    if (!videos || videos.length === 0) throw new Error("No se encontraron videos");
    return videos.slice(0, 5).map(video => ({
        url: video.url,
        title: video.title || "",
        author: video.author?.nickname || video.author?.username || "TikTok User",
        views: formatNumbers(parseDelimitedNumber(video.play || 0)),
        likes: formatNumbers(parseDelimitedNumber(video.like || 0)),
        duration: normalizeDuration(video.duration || video.videoDuration || 0)
    }));
}

async function searchFaa(query) {
    const res = await axios.get(`${FAA_URL}faa/tiktok-search?q=${encodeURIComponent(query)}`, {
        timeout: 20000,
        headers: { "User-Agent": UA_HEADER }
    });
    const videos = res.data?.result;
    if (!videos || videos.length === 0) throw new Error("No se encontraron videos");
    return videos.slice(0, 5).map(first => {
        const username = first.author?.username || "";
        const id = first.id || "";
        return {
            url: username && id ? `https://www.tiktok.com/@${username}/video/${id}` : "",
            title: first.title || "",
            author: first.author?.nickname || username || "TikTok User",
            views: formatNumbers(first.stats?.views || 0),
            likes: formatNumbers(first.stats?.likes || 0),
            duration: normalizeDuration(first.duration || 0)
        };
    }).filter(v => v.url);
}

async function searchTikTok(query) {
    return firstSuccessful([
        searchDelirius(query),
        searchFaa(query)
    ]);
}

export default [
    {
        command: ["tt", "tiktok", "ttdl", "tiktokdl", "tiktoks", "ttss"],
        description: "Descarga un video de TikTok por URL o busca múltiples resultados en formato de álbum.",
        async execute({ sock, msg, remoteJid, text, usedPrefix, command }) {
            const tmpFiles = [];
            try {
                if (!text) {
                    return sock.sendMessage(remoteJid, {
                        text: `⚠️ Por favor ingresa una URL de TikTok o un término de búsqueda.\n\n*Ejemplo:* ${usedPrefix}${command} https://vt.tiktok.com/...\n*Ejemplo:* ${usedPrefix}${command} edits anime`
                    }, { quoted: msg });
                }

                const inputStr = text.trim();

                if (TIKTOK_REGEX.test(inputStr)) {
                    // Descarga directa por enlace único
                    await react(sock, remoteJid, msg, "⏳");
                    const info = await getDownloadInfo(inputStr);
                    const tmpFile = await downloadToTmp(info.videoUrl, "mp4", "tiktok-dl");
                    tmpFiles.push(tmpFile);

                    const durationStr = info.duration ? `${info.duration}s` : "N/A";
                    const caption = `🎬 *TikTok Download*\n\n` +
                        `📌 *Título:* ${info.title || "Sin título"}\n` +
                        `👤 *Autor:* ${info.author}\n` +
                        `⏱️ *Duración:* ${durationStr}\n` +
                        `👁️ *Vistas:* ${info.views}\n` +
                        `❤️ *Likes:* ${info.likes}\n` +
                        `🔗 *Enlace:* ${inputStr}`;

                    await sock.sendMessage(remoteJid, {
                        video: { url: tmpFile },
                        mimetype: "video/mp4",
                        fileName: `${(info.title || "video").replace(/[<>:"/\\|?*]/g, "").slice(0, 50)}.mp4`,
                        caption
                    }, { quoted: msg });

                    await react(sock, remoteJid, msg, "✅");
                } else {
                    // Búsqueda de múltiples videos (Álbum multimedia)
                    await react(sock, remoteJid, msg, "🔍");
                    const searchResults = await searchTikTok(inputStr);

                    const albumMedia = [];
                    for (const item of searchResults) {
                        try {
                            const info = await getDownloadInfo(item.url);
                            const tmpFile = await downloadToTmp(info.videoUrl, "mp4", "tiktok-search");
                            tmpFiles.push(tmpFile);

                            const durationStr = info.duration ? `${info.duration}s` : (item.duration ? `${item.duration}s` : "N/A");
                            const caption = `🎬 *TikTok Search*\n\n` +
                                `📌 *Título:* ${info.title || item.title || "Sin título"}\n` +
                                `👤 *Autor:* ${info.author || item.author}\n` +
                                `⏱️ *Duración:* ${durationStr}\n` +
                                `👁️ *Vistas:* ${info.views || item.views}\n` +
                                `❤️ *Likes:* ${info.likes || item.likes}\n` +
                                `🔗 *Enlace:* ${item.url}`;

                            albumMedia.push({
                                video: { url: tmpFile },
                                mimetype: "video/mp4",
                                fileName: `${(info.title || item.title || "video").replace(/[<>:"/\\|?*]/g, "").slice(0, 50)}.mp4`,
                                caption
                            });
                        } catch (err) {
                            console.error(`Error procesando resultado ${item.url}:`, err);
                        }
                    }

                    if (albumMedia.length === 0) {
                        throw new Error("No se pudieron descargar los videos de la búsqueda.");
                    }

                    if (albumMedia.length === 1) {
                        await sock.sendMessage(remoteJid, albumMedia[0], { quoted: msg });
                    } else {
                        await sendAlbumMessage(sock, remoteJid, albumMedia, msg);
                    }

                    await react(sock, remoteJid, msg, "✅");
                }
            } catch (e) {
                await react(sock, remoteJid, msg, "❌");
                await sock.sendMessage(remoteJid, {
                    text: `❌ Error: ${e.message || "Ocurrió un error inesperado."}`
                }, { quoted: msg });
            } finally {
                cleanTmp(...tmpFiles);
            }
        },
    }
];