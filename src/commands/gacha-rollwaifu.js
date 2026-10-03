import { join } from "path";
import { promises as fs } from 'fs'
import fetch from 'node-fetch'

const FILE_PATH = join(process.cwd(), 'src', 'json', 'characters.json') 
let charactersCache = null;
let lastCacheLoad = 0;
const CACHE_TTL = 5 * 60 * 1000;
const cooldowns = {}

// --- FUNCIONES DE APOYO ---
async function loadCharacters() {
    const now = Date.now();
    if (charactersCache && (now - lastCacheLoad) < CACHE_TTL) return charactersCache;
    try {
        const data = await fs.readFile(FILE_PATH, 'utf-8');
        charactersCache = JSON.parse(data);
        lastCacheLoad = now;
        return charactersCache;
    } catch (error) {
        throw new Error('No se pudo cargar el archivo characters.json.');
    }
}

function flattenCharacters(charactersData) {
    if (Array.isArray(charactersData)) return charactersData;
    return Object.values(charactersData).flatMap(series =>
        Array.isArray(series.characters) ? series.characters : []
    );
}

function getSeriesNameByCharacter(charactersData, characterId) {
    return Object.entries(charactersData).find(([_, series]) =>
        Array.isArray(series.characters) &&
        series.characters.some(char => String(char.id) === String(characterId))
    )?.[1]?.name || 'Desconocido';
}

function formatTag(tag) {
    return String(tag).toLowerCase().trim().replace(/\s+/g, '_');
}

async function buscarImagenApi(tag) {
    const formattedTag = formatTag(tag);
    const apiUrls = [
        `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=${formattedTag}`,
        `https://danbooru.donmai.us/posts.json?tags=${formattedTag}`
    ];
    for (const url of apiUrls) {
        try {
            const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 });
            if (!response.ok) continue;
            const data = await response.json();
            const posts = Array.isArray(data) ? data : data?.posts || [];
            const images = posts.map(post => post?.file_url || post?.large_file_url).filter(url => typeof url === 'string' && /\.(jpe?g|png|webp)$/i.test(url));
            if (images.length > 0) return images;
        } catch (e) { continue; }
    }
    return [];
}

let handler = async (m, { conn }) => {
    if (global.adminAbuse) return await conn.reply(m.chat, `⚠️ **¡ADMIN ABUSE!**\nEspera a que termine el evento.`, m)

    const userId = m.sender
    const now = Date.now()
    const COOLDOWN_TIME  = 15 * 60 * 1000
    const PROTECTION_MS  = 30 * 1000          // 30s de protección para el roller
    const EXPIRY_MS      = 2 * 60 * 1000 + PROTECTION_MS  // 2m 30s para reclamar

    if (!global.db.data.users[userId]) {
        global.db.data.users[userId] = {
            name: m.pushName || 'Usuario Desconocido',
            chat: 0,
            commandCount: 0,
            lastRoll: 0,
            waifus: []
        }
    }
    const user = global.db.data.users[userId]

    if (cooldowns[userId] && now < cooldowns[userId]) {
        const remaining = Math.ceil((cooldowns[userId] - now) / 1000)
        return await conn.reply(m.chat, `( ⸝⸝･̆⤚･̆⸝⸝ ) Espera *${Math.floor(remaining/60)}m ${remaining%60}s*.`, m)
    }

    try {
        const rawData = await loadCharacters()
        let characters = flattenCharacters(rawData)
        
        // --- FILTRO INTELIGENTE: BUSCA PERSONAJES NO RECLAMADOS EN LA DB ---
        let randomCharacter;
        for (let i = 0; i < 5; i++) { 
            let tempChar = characters[Math.floor(Math.random() * characters.length)];
            let charId = tempChar.id || tempChar.name;
            let dbChar = global.db.data.characters?.[charId];
            
            if (!dbChar || !dbChar.user) { 
                randomCharacter = tempChar;
                break;
            }
            if (i === 4) randomCharacter = tempChar; 
        }

        const charId = randomCharacter.id || randomCharacter.name;
        const seriesName = getSeriesNameByCharacter(rawData, charId);
        
        if (!global.db.data.chats[m.chat]) global.db.data.chats[m.chat] = {}
        const chatData = global.db.data.chats[m.chat]
        if (!chatData.pendingClaims) chatData.pendingClaims = {}

        let resourceURL = null;
        let resourceType = 'image';
        const hasVideos = randomCharacter.vid && randomCharacter.vid.length > 0
        const hasImages = randomCharacter.img && randomCharacter.img.length > 0

        if (hasVideos || hasImages) {
            if (hasVideos && (!hasImages || Math.random() < 0.7)) {
                resourceURL = randomCharacter.vid[Math.floor(Math.random() * randomCharacter.vid.length)]
                resourceType = 'video'
            } else {
                resourceURL = randomCharacter.img[Math.floor(Math.random() * randomCharacter.img.length)]
            }
        } 

        if (!resourceURL) {
            const apiImages = await buscarImagenApi(randomCharacter.name);
            if (apiImages.length > 0) resourceURL = apiImages[Math.floor(Math.random() * apiImages.length)];
        }

        if (!resourceURL) return await conn.reply(m.chat, `✘ No encontré imagen para: ${randomCharacter.name}`, m)

        // --- SINCRONIZACIÓN CON LA DB ---
        const dbCharStatus = global.db.data.characters?.[charId];
        const isClaimed = dbCharStatus && dbCharStatus.user && dbCharStatus.user !== "";
        
        const statusMessage = isClaimed 
            ? `Reclamado por @${dbCharStatus.user.split('@')[0]}` 
            : '✨ ¡𝗟𝗶𝗯𝗿𝗲! ¡𝗨𝘀𝗮 #claim!'
        
        const message = `╔◡╍┅•.⊹︵ࣾ᷼ ׁ𖥓┅╲۪ ⦙᷼͝🧸᷼͝⦙ ׅ╱ׅ╍𖥓 ︵ࣾ᷼︵ׄׄ᷼⊹┅╍◡╗\n┋  ⣿̶ֻ㪝ׅ⃕݊⃧🐚⃚̶̸͝ᤢ֠◌ִ̲ 𝑪𝑯𝑨𝑹𝑨𝑪𝑻𝑬𝑹 𝑹𝑨𝑵𝑫𝑶𝑴 🐸ꨪ̸⃙ׅᮬֺ๋֢᳟  ┋\n╚◠┅┅˙•⊹.⁀𖥓 ׅ╍╲۪ ⦙᷼͝🎠᷼͝⦙ ׅ╱ׅ╍𖥓 ◠˙⁀۪ׄ⊹˙╍┅◠╝\n\n> 𝙉𝙊𝙈𝘽𝙍𝙀: *${randomCharacter.name}*\n> 𝙂𝙀𝙉𝙀𝙍𝙊: *${randomCharacter.gender || 'Desconocido'}*\n> 𝙑𝘼𝙇𝙊𝙍: *${randomCharacter.value || 100}*\n> 𝙀𝙎𝙏𝘼𝘿𝙊: ${statusMessage}\n> 𝙁𝙐𝙀𝙉𝙏𝙀: *${seriesName}*\n> 𝙄𝘿: *${charId}*`

        // --- ENVIAR Y GUARDAR EL messageId COMO CLAVE DEL SLOT ---
        let sentMsg;
        if (resourceType === 'video' || resourceURL.match(/\.(mp4|mov)$/i)) {
            sentMsg = await conn.sendMessage(m.chat, { video: { url: resourceURL }, gifPlayback: true, caption: message, mentions: isClaimed ? [dbCharStatus.user] : [] }, { quoted: m })
        } else {
            sentMsg = await conn.sendMessage(m.chat, { image: { url: resourceURL }, caption: message, mentions: isClaimed ? [dbCharStatus.user] : [] }, { quoted: m })
        }

        // Usar el messageId del mensaje enviado como clave única del slot
        const msgId = sentMsg?.key?.id || (userId + '_' + now)

        chatData.pendingClaims[msgId] = {
            id: charId,
            name: randomCharacter.name,
            rollerId: userId,           // ← campo que usa claim.js para la lógica de protección
            protectedUntil: now + PROTECTION_MS,
            expiresAt: now + EXPIRY_MS,
        }
        
        // --- GUARDAR COOLDOWN ---
        user.lastRoll = now + COOLDOWN_TIME 
        cooldowns[userId] = now + COOLDOWN_TIME

    } catch (error) {
        console.error(error)
        await conn.reply(m.chat, `✘ Error interno: ${error.message}`, m)
    }
}

handler.help = ['rw']
handler.tags = ['gacha']
handler.command = ['ver', 'rw', 'rollwaifu']
handler.group = true

export default handler