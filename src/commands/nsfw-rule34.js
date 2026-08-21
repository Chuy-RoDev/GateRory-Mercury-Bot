import fetch from 'node-fetch';

// --- CONFIGURACIÓN DE LA API ---
const API_BASE_URL = "https://rest.apicausas.xyz/api/v1/nsfw/descargas/rule34";
const API_KEY = "causa-ee5ee31dcfc79da4";

const handler = async (m, { conn, args, usedPrefix, command }) => {
    // 1. Verificación de NSFW con juicio de Shiroko
    const chat = global.db.data.chats[m.chat];
    if (m.isGroup && !chat?.nsfw) {
        return m.reply(`El NSFW está deshabilitado... ¿Realmente quieres hacer esto?..\n> Un administrador debe activarlo con: *${usedPrefix}nsfw on*`);
    }

    // 2. Validación de Argumentos (Comando vacío con rivalidad)
    if (!args[0]) {
        return m.reply(`Esto... ¿Realmente quieres que haga esto?... *Pervertido.*\n\n> *Ejemplo:* (Mika Misono... ugh)\n> Si quieres que sea un vídeo ponlo al final...\n*${usedPrefix + command} mika_misono video*`);
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
        
        // --- CAMBIO PARA MANDAR HASTA 10 RESULTADOS ---
        const medias = [];
        const maxResults = Math.min(results.length, 10);

        for (let i = 0; i < maxResults; i++) {
            const post = results[i];
            const fileUrl = post.file_url;
            const type = post.type ? post.type.toLowerCase() : fileUrl.split('.').pop().toLowerCase();
            const isVideo = ['mp4', 'webm', 'mov', 'gif'].includes(type);

            medias.push({
                type: isVideo ? 'video' : 'image',
                data: { url: fileUrl }
            });
        }

        const caption = `Encontré estos ${medias.length} resultados para: *${tags}*... *Pervertido.*`;

        // 4. Envío grupal usando la lógica de Sylphy (evita el error de tmp)
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