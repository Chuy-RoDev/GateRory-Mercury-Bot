import fetch from 'node-fetch';

// --- CONFIGURACIÓN DE LA API ---
const API_BASE_URL = "https://rest.apicausas.xyz/api/v1/nsfw/descargas/rule34";
const API_KEY = "causa-ee5ee31dcfc79da4";

const handler = async (m, { conn, args, usedPrefix, command }) => {
    // 1. Verificación de NSFW
    const chat = global.db.data.chats[m.chat];
    if (m.isGroup && !chat?.nsfw) {
        return m.reply(`El NSFW está deshabilitado... ¿Realmente quieres hacer esto?..\n> Un administrador debe activarlo con: *${usedPrefix}nsfw on*`);
    }

    // 2. Validación de Argumentos
    if (!args[0]) {
        return m.reply(`Esto... ¿Realmente quieres que haga esto?... *Pervertido.*\n\n> *Ejemplo:*\n*${usedPrefix + command} mika_misono*`);
    }

    const tags = args.join(', ');
    const queryUrl = `${API_BASE_URL}?tags=${encodeURIComponent(tags)}&apikey=${API_KEY}`;

    try {
        await m.react('⏳');

        const response = await fetch(queryUrl);
        const json = await response.json();

        // 3. Manejo de errores
        if (!json.status || !json.data.results || json.data.results.length === 0) {
            await m.react('❌');
            return m.reply(`*Cero unidades encontradas.* 🦈\nNo hay nada de "${tags}" aquí. Qué pérdida de tiempo.`);
        }

        const results = json.data.results;
        
        // --- SEPARACIÓN: HASTA 5 IMÁGENES Y 5 VÍDEOS ---
        const images = [];
        const videos = [];

        for (const post of results) {
            const fileUrl = post.file_url;
            if (!fileUrl) continue;

            const type = post.type ? post.type.toLowerCase() : fileUrl.split('.').pop().toLowerCase();
            const isVideo = ['mp4', 'webm', 'mov', 'gif'].includes(type);

            const mediaObj = {
                type: isVideo ? 'video' : 'image',
                data: { url: fileUrl }
            };

            if (isVideo && videos.length < 5) {
                videos.push(mediaObj);
            } else if (!isVideo && images.length < 5) {
                images.push(mediaObj);
            }

            // Si ya se juntaron 5 de cada tipo, detener la búsqueda
            if (images.length === 5 && videos.length === 5) break;
        }

        const medias = [...images, ...videos];

        if (medias.length === 0) {
            await m.react('❌');
            return m.reply(`*Cero archivos válidos encontrados.* 🦈`);
        }

        const caption = `Encontré *${images.length} imágenes* y *${videos.length} vídeos* para: *${tags}*... *Pervertido.*`;

        // 4. Envío de medios
        await conn.sendSylphy(m.chat, medias, { caption, quoted: m });

        await m.react('✔️');

    } catch (e) {
        console.error('Error:', e);
        await m.react('❌');
        await m.reply(`*Ugh, algo salió mal.* 🛠️\nLa base de datos no responde. Arréglatelas solo.`);
    }
};

handler.help = ['rule34 <tags>'];
handler.tags = ['nsfw'];
handler.command = ['r34', 'rule34'];

export default handler;