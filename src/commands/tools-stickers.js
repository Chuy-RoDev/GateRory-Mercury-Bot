import { sticker, addExif } from '../../lib/sticker.js'
import axios from 'axios'

const stickerAPI = {
    async getStatic(text, retryCount = 1) {
        try {
            const response = await axios.get(`https://skyzxu-brat.hf.space/brat`, { 
                params: { text }, 
                responseType: 'arraybuffer',
                timeout: 10000
            })
            return response.data
        } catch (error) {
            if (error.response?.status === 429 && retryCount <= 3) {
                await new Promise(resolve => setTimeout(resolve, 5000))
                return this.getStatic(text, retryCount + 1)
            }
            throw error
        }
    },

    async getAnimated(text) {
        const response = await axios.get(`https://skyzxu-brat.hf.space/brat-animated`, { 
            params: { text }, 
            responseType: 'arraybuffer',
            timeout: 15000
        })
        if (!response.data) throw new Error('La API no devolvió datos para el sticker animado.')
        return response.data
    },

    async getEmojiMix(emoji1, emoji2) {
        const res = await axios.get(`https://tenor.googleapis.com/v2/featured?key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&contentfilter=high&media_filter=png_transparent&component=proactive&collection=emoji_kitchen_v5&q=${encodeURIComponent(emoji1)}_${encodeURIComponent(emoji2)}`)
        if (!res.data.results || res.data.results.length === 0) throw new Error('No se encontraron combinaciones para esos emojis.')
        return res.data.results
    }
}

const quoteGenerator = {
    async createQuote(userName, userAvatar, text) {
        if (text.length > 30) throw new Error('El texto no puede exceder los 30 caracteres.')
        
        const quoteData = { 
            type: 'quote', 
            format: 'png', 
            backgroundColor: '#000000', 
            width: 512, 
            height: 512, 
            scale: 2, 
            messages: [{ 
                entities: [], 
                avatar: true, 
                from: { 
                    id: 1, 
                    name: userName, 
                    photo: { url: userAvatar } 
                }, 
                text: text, 
                replyMessage: {} 
            }]
        }
        
        const response = await axios.post('https://bot.lyo.su/quote/generate', quoteData, { 
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        })
        
        return Buffer.from(response.data.result.image, 'base64')
    }
}

const userManager = {
    getUserConfig(userId) {
        const userData = global.db.data.users[userId] || {}
        return {
            packName: userData.text1 || global.packsticker,
            authorName: userData.text2 || global.packsticker2
        }
    }
}

let handler = async (m, { conn, text, args, command, usedPrefix }) => {
    const errorConfig = global.rcanalx || {}
    
    try {
        await conn.sendMessage(m.chat, { 
            react: { 
                text: '⏳', 
                key: m.key 
            }
        })

        const userConfig = userManager.getUserConfig(m.sender)
        const inputText = m.quoted?.text || text

        if (!inputText && !['emojimix'].includes(command)) {
            return conn.reply(m.chat, `ꕤ Proporciona el contenido necesario para crear el sticker.`, m, errorConfig)
        }

        let resultSticker

        switch (command) {
            case 'brat': {
                const apiData = await stickerAPI.getStatic(inputText)
                resultSticker = await sticker(apiData, false, userConfig.packName, userConfig.authorName, [""], { keepScale: true })
                if (!resultSticker) throw new Error('No se pudo generar el sticker estático.')
                await conn.sendFile(m.chat, resultSticker, 'sticker.webp', '', m)
                break
            }

            case 'bratv': {
                const videoData = await stickerAPI.getAnimated(inputText)
                resultSticker = await sticker(videoData, null, userConfig.packName, userConfig.authorName, [""], { keepScale: true })
                await conn.sendMessage(m.chat, { sticker: resultSticker }, { quoted: m })
                break
            }

            case 'emojimix': {
                if (!args[0]) {
                    return conn.reply(m.chat, `ꕤ Especifica dos emojis para combinar.\nEjemplo: *${usedPrefix + command}* 😊+🌟`, m, errorConfig)
                }
                
                const [firstEmoji, secondEmoji] = text.split`+`
                const emojiResults = await stickerAPI.getEmojiMix(firstEmoji, secondEmoji)
                
                const stickerCreation = emojiResults.map(result => 
                    sticker(false, result.url, userConfig.packName, userConfig.authorName)
                )
                const createdStickers = await Promise.all(stickerCreation)
                
                for (let individualSticker of createdStickers) {
                    await conn.sendFile(m.chat, individualSticker, null, { asSticker: true }, m)
                }
                break
            }

            case 'qc': {
                const quoteText = args.join(' ') || m.quoted?.text
                if (!quoteText) {
                    return conn.reply(m.chat, `ꕤ Ingresa el texto para la cita.`, m, errorConfig)
                }

                const targetUser = m.quoted ? m.quoted.sender : m.sender

                const profilePicture = await conn.profilePictureUrl(targetUser, 'image')
                    .catch(() => 'https://telegra.ph/file/24fa902ead26340f3df2c.png')

                let finalName
                try {
                    finalName = global.db.data.users[targetUser]?.name
                        || conn.getName(targetUser)
                        || targetUser.split('@')[0]
                } catch {
                    finalName = targetUser.split('@')[0]
                }

                const cleanText = quoteText.replace(new RegExp(`@${targetUser.split('@')[0]}`, 'g'), '').trim()

                const quoteImage = await quoteGenerator.createQuote(finalName, profilePicture, cleanText)
                resultSticker = await sticker(quoteImage, false, userConfig.packName, userConfig.authorName, [""], { keepScale: true })

                if (resultSticker) {
                    await conn.sendFile(m.chat, resultSticker, 'sticker.webp', '', m)
                }
                break
            }

            case 'take': 
            case 'wm': {
                if (!m.quoted) {
                    return conn.reply(m.chat, `ꕤ Responde a un sticker con *${usedPrefix + command}* y el nuevo nombre.\nEjemplo: *${usedPrefix + command}* MiPack•MiNombre`, m, errorConfig)
                }
                
                const originalSticker = await m.quoted.download()
                if (!originalSticker) {
                    return conn.reply(m.chat, 'ꕤ Error al obtener el sticker original.', m, errorConfig)
                }
                
                const textParts = text.split(/[\u2022|]/).map(part => part.trim())
                const newPack = textParts[0] || userConfig.packName
                const newAuthor = textParts[1] || userConfig.authorName
                
                const modifiedSticker = await addExif(originalSticker, newPack, newAuthor)
                await conn.sendMessage(m.chat, { sticker: modifiedSticker }, { quoted: m })
                break
            }
        }
    } catch (error) {
        await conn.reply(m.chat, `⚠️ Ocurrió un error.\nReporta el problema con *${usedPrefix}report*.\n\n${error.message}`, m, errorConfig)
    }
}

handler.help = ['brat', 'bratv', 'emojimix', 'qc', 'take', 'wm']
handler.tags = ['stickers']
handler.command = ['brat', 'bratv', 'emojimix', 'qc', 'take', 'wm']

export default handler