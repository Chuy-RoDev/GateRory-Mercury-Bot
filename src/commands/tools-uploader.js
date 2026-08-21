import uploadFile from '../../lib/uploadFile.js'
import uploadImage from '../../lib/uploadImage.js'
import { FormData, Blob } from "formdata-node"
import { fileTypeFromBuffer } from "file-type"
import crypto from "crypto"
import fetch from 'node-fetch'

// GitHub configuration - Use environment variables for security (Añadido)
const GITHUB_HARDCODED_TOKEN = process.env.GITHUB_TOKEN || ''
const GITHUB_HARDCODED_REPO = process.env.GITHUB_REPO || 'WillZek/Storage-CB2'

// --- FUNCIONES DE SUBIDA DE ARCHIVOS ---

async function russellCDN(buffer) {
    const { ext, mime } = await fileTypeFromBuffer(buffer) || { ext: 'jpg', mime: 'image/jpeg' }
    const blob = new Blob([buffer], { type: mime })
    const formData = new FormData()
    const filename = `${crypto.randomBytes(8).toString('hex')}.${ext}`
    
    formData.append('file', blob, filename)
    
    const res = await fetch('https://cdn.russellxz.click/api/upload', {
        method: 'POST',
        body: formData
    })
    
    const data = await res.json()
    return data.url || data.link || data.direct_url || `https://cdn.russellxz.click/${filename}`
}

async function telegraPh(buffer) {
    const { ext } = await fileTypeFromBuffer(buffer) || { ext: 'jpg' }
    const blob = new Blob([buffer], { type: `image/${ext}` })
    const formData = new FormData()
    formData.append('file', blob, `file.${ext}`)
    
    const res = await fetch('https://telegra.ph/upload', {
        method: 'POST',
        body: formData
    })
    
    const data = await res.json()
    return data[0]?.src ? `https://telegra.ph${data[0].src}` : null
}

async function catbox(buffer) {
    const { ext } = await fileTypeFromBuffer(buffer) || { ext: 'jpg' }
    const blob = new Blob([buffer], { type: `image/${ext}` })
    const formData = new FormData()
    const name = crypto.randomBytes(4).toString('hex')
    
    formData.append('reqtype', 'fileupload')
    formData.append('fileToUpload', blob, `${name}.${ext}`)
    
    const res = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: formData
    })
    
    return (await res.text()).trim()
}

// 4. GitHub (Añadido del código anterior)
async function uploadGitHub(buffer, ext) {
    const token = process.env.GITHUB_TOKEN || global.GITHUB_TOKEN || GITHUB_HARDCODED_TOKEN
    const repo = process.env.GITHUB_REPO || global.GITHUB_REPO || GITHUB_HARDCODED_REPO
    if (!token) throw new Error('Falta GITHUB_TOKEN')
    
    const filename = `${crypto.randomBytes(6).toString('hex')}.${ext || 'bin'}`
    const path = `images/${filename}`
    const content = Buffer.from(buffer).toString('base64')
    
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'upload-bot' },
        body: JSON.stringify({ message: `upload ${filename}`, content: content })
    })
    const data = await res.json()
    if (data?.content?.download_url) return data.content.download_url
    throw new Error(data?.message || 'Fallo al subir a GitHub')
}

// 5. PostImages (Añadido del código anterior)
async function uploadPostImages(buffer, ext, mime) {
    const form = new FormData()
    form.append('optsize', '0')
    form.append('expire', '0')
    form.append('numfiles', '1')
    form.append('upload_session', String(Math.random()))
    form.append('file', new Blob([buffer], { type: mime || 'image/jpeg' }), `${Date.now()}.${ext || 'jpg'}`)
    const res = await fetch('https://postimages.org/json/rr', { method: 'POST', body: form })
    const json = await res.json().catch(async () => ({ raw: await res.text() }))
    return json?.url || json?.images?.[0]?.url || null
}

// 6. Litterbox (Añadido del código anterior)
async function uploadLitterbox(buffer, ext, mime) {
    const form = new FormData()
    form.append('file', new Blob([buffer], { type: mime || 'application/octet-stream' }), `upload.${ext || 'bin'}`)
    form.append('time', '24h')
    const res = await fetch('https://api.alvianuxio.eu.org/uploader/litterbox', { method: 'POST', body: form })
    const text = await res.text()
    try { 
        const j = JSON.parse(text); 
        return j.url || j.data?.url || null 
    } catch { 
        return /https?:\/\/[\w./-]+/i.test(text) ? text.trim() : null 
    }
}

// 7. TmpFiles (Añadido del código anterior)
async function uploadTmpFiles(buffer, ext, mime) {
    const form = new FormData()
    form.append('file', new Blob([buffer], { type: mime || 'application/octet-stream' }), `upload.${ext || 'bin'}`)
    const res = await fetch('https://api.alvianuxio.eu.org/uploader/tmpfiles', { method: 'POST', body: form })
    const text = await res.text()
    try { 
        const j = JSON.parse(text); 
        return j.url || j.data?.url || j.link || null 
    } catch { 
        return /https?:\/\/[\w./-]+/i.test(text) ? text.trim() : null 
    }
}

// 8. FreeImageHost (Añadido del código anterior)
async function uploadFreeImageHost(buffer, ext, mime) {
    const form = new FormData()
    form.append('key', '6d207e02198a847aa98d0a2a901485a5')
    form.append('action', 'upload')
    form.append('source', new Blob([buffer], { type: mime || 'image/jpeg' }), `upload.${ext || 'jpg'}`)
    const res = await fetch('https://freeimage.host/api/1/upload', { method: 'POST', body: form })
    const j = await res.json().catch(async () => ({ raw: await res.text() }))
    return j?.image?.url || j?.data?.image?.url || null
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B'
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`
}


// --- HANDLER PRINCIPAL ---

const handler = async (m, { conn, command }) => {
    const q = m.quoted ? m.quoted : m
    const mime = (q.msg || q).mimetype || ''
    
    if (!mime) return conn.reply(m.chat, 'ꕤ Responde a una imagen o video', m)
    
    try {
        const media = await q.download()
        const size = formatBytes(media.length)
        const typeInfo = await fileTypeFromBuffer(media) || {}
        const { ext, mime: realMime } = typeInfo

        switch(command) {
            case 'tourl': {
                const link = await Promise.race([
                    russellCDN(media).catch(() => null),
                    telegraPh(media).catch(() => null),
                    catbox(media).catch(() => null)
                ])
                
                if (!link) throw new Error('Todas las APIs fallaron')
                
                const platform = link.includes('russellxz.click') ? 'Russell CDN' : 
                               link.includes('telegra.ph') ? 'Telegraph' : 
                               link.includes('catbox') ? 'Catbox' : 'Server'
                
                const msg = `ꕤ *Enlace Generado*

• URL: ${link}
• Tamaño: ${size}
• Plataforma: ${platform}
• Expiración: Nunca

↳ Archivo adjunto:`
                
                await conn.sendFile(m.chat, media, 'file.jpg', msg, m)
                break
            }
            
            case 'catbox': {
                const link = await catbox(media)
                const msg = `ꕤ *Catbox Upload*

• URL: ${link}
• Tamaño: ${size}
• Expiración: Nunca

↳ Archivo adjunto:`
                
                await conn.sendFile(m.chat, media, 'file.jpg', msg, m)
                break
            }
            
            case 'russell': {
                const link = await russellCDN(media)
                const msg = `ꕤ *Russell CDN*

• URL: ${link}
• Tamaño: ${size}
• Velocidad: Alta
• Expiración: Nunca

↳ Archivo adjunto:`
                
                await conn.sendFile(m.chat, media, 'file.jpg', msg, m)
                break
            }
            
            case 'telegraph': 
            case 'telegra': 
            case 'tg': {
                const link = await telegraPh(media)
                const msg = `ꕤ *Telegraph Upload*

• URL: ${link}
• Tamaño: ${size}
• Plataforma: Telegraph
• Expiración: Nunca

↳ Archivo adjunto:`
                
                await conn.sendFile(m.chat, media, 'file.jpg', msg, m)
                break
            }

            // --- Nuevos comandos para servicios específicos ---
            case 'github': {
                const link = await uploadGitHub(media, ext)
                const msg = `ꕤ *GitHub Upload*
                
• URL: ${link}
• Tamaño: ${size}
• Plataforma: GitHub (Repo privado)
• Expiración: Nunca

↳ Archivo adjunto:`
                await conn.sendFile(m.chat, media, 'file.jpg', msg, m)
                break
            }
            case 'postimages': {
                const link = await uploadPostImages(media, ext, realMime)
                const msg = `ꕤ *PostImages Upload*
                
• URL: ${link}
• Tamaño: ${size}
• Plataforma: PostImages
• Expiración: Nunca

↳ Archivo adjunto:`
                await conn.sendFile(m.chat, media, 'file.jpg', msg, m)
                break
            }
            case 'litterbox': {
                const link = await uploadLitterbox(media, ext, realMime)
                const msg = `ꕤ *Litterbox Upload*
                
• URL: ${link}
• Tamaño: ${size}
• Plataforma: Litterbox
• Expiración: 24 Horas

↳ Archivo adjunto:`
                await conn.sendFile(m.chat, media, 'file.jpg', msg, m)
                break
            }
            case 'tmpfiles': {
                const link = await uploadTmpFiles(media, ext, realMime)
                const msg = `ꕤ *TmpFiles Upload*
                
• URL: ${link}
• Tamaño: ${size}
• Plataforma: TmpFiles
• Expiración: Temporal

↳ Archivo adjunto:`
                await conn.sendFile(m.chat, media, 'file.jpg', msg, m)
                break
            }
            case 'freeimagehost': {
                const link = await uploadFreeImageHost(media, ext, realMime)
                const msg = `ꕤ *FreeImageHost Upload*
                
• URL: ${link}
• Tamaño: ${size}
• Plataforma: FreeImageHost
• Expiración: Nunca

↳ Archivo adjunto:`
                await conn.sendFile(m.chat, media, 'file.jpg', msg, m)
                break
            }

            case 'upload': 
            case 'uploadall': { // Comando multi-subida unificado
                const results = await Promise.allSettled([
                    russellCDN(media).catch(() => null),
                    telegraPh(media).catch(() => null),
                    catbox(media).catch(() => null),
                    uploadImage(media).catch(() => null), // Mantenemos esta si está definida
                    uploadPostImages(media, ext, realMime).catch(() => null),
                    uploadLitterbox(media, ext, realMime).catch(() => null),
                    uploadTmpFiles(media, ext, realMime).catch(() => null)
                ])
                
                const links = results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value)
                
                if (!links.length) throw new Error('Todas las APIs fallaron')
                
                const msg = `ꕤ *Multi Upload*\n\n${links.map((link, i) => {
                    let platform = 'Server'
                    let expiration = 'Nunca'
                    if (link.includes('russellxz.click')) platform = 'Russell CDN'
                    else if (link.includes('telegra.ph')) platform = 'Telegraph'
                    else if (link.includes('catbox')) platform = 'Catbox'
                    else if (link.includes('postimages')) platform = 'PostImages'
                    else if (link.includes('alvianuxio.eu.org/uploader/litterbox')) { platform = 'Litterbox'; expiration = '24 Horas' }
                    else if (link.includes('alvianuxio.eu.org/uploader/tmpfiles')) { platform = 'TmpFiles'; expiration = 'Temporal' }
                    else if (link.includes('freeimagehost')) platform = 'FreeImageHost'
                    
                    return `**[${i + 1}]** *${platform}* (${expiration}): ${link}`
                }).join('\n')}
                
• Tamaño: ${size}

↳ Archivo adjunto:`
                
                await conn.sendFile(m.chat, media, 'file.jpg', msg, m)
                break
            }
        }
        
    } catch (e) {
        console.error(e)
        conn.reply(m.chat, 'ꕤ Error al subir el archivo', m)
    }
}

handler.help = ['catbox', 'upload', 'russell', 'telegraph', 'github', 'postimages', 'litterbox', 'tmpfiles', 'freeimagehost']
handler.tags = ['tools']
handler.command = [
    'tourl', 
    'catbox', 
    'russell', 
    'cdn', 
    'telegraph', 
    'telegra', 
    'tg', 
    'github', 
    'postimages', 
    'litterbox', 
    'tmpfiles', 
    'freeimagehost',
    'upload', 
    'uploadall'
]

export default handler
