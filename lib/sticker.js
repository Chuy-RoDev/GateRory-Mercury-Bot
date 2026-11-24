import { dirname } from "path";
import { fileURLToPath } from "url";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import fluent_ffmpeg from "fluent-ffmpeg";
import { fileTypeFromBuffer } from "file-type";
import webp from "node-webpmux";
import fetch from "node-fetch";

const __dirname = dirname(fileURLToPath(import.meta.url));

const MAX_SIZE_BYTES = 1 * 1024 * 1024 // 1MB limite de WhatsApp
const FPS_STEPS = [60, 30, 24, 20, 15, 12, 10, 8]
const MAX_SEGUNDOS_VIDEO = 10

function esWebpValido(buf) {
    if (!buf || buf.length < 12) return false
    return buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP'
}

function esWebpAnimado(buf) {
    if (!esWebpValido(buf)) return false
    return buf.indexOf(Buffer.from('ANIM')) !== -1
}

function convertirAnimado(tmp, out, fps, esVideo, keepScale, calidad = 70, maxSeg = MAX_SEGUNDOS_VIDEO) {
    return new Promise((resolve, reject) => {
        let cmd = fluent_ffmpeg(tmp)
        if (esVideo) cmd = cmd.inputOptions([`-t`, `${maxSeg}`])

        const vfFiltro = keepScale
            ? `scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,fps=${fps}`
            : `scale=512:512:force_original_aspect_ratio=increase,crop=512:512,fps=${fps}`;

        cmd.addOutputOptions([
            `-vcodec`, `libwebp`,
            `-vf`, vfFiltro,
            `-lossless`, `0`,
            `-compression_level`, `3`,
            `-q:v`, `${calidad}`,
            `-loop`, `0`,
            `-an`,
            `-vsync`, `0`,
            `-f`, `webp`
        ])
        .on("error", (err) => reject(err))
        .on("end", () => resolve())
        .save(out)
    })
}

function convertirEstatico(tmp, out, keepScale) {
    return new Promise((resolve, reject) => {
        const vfFiltro = keepScale 
            ? `scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000`
            : `scale=512:512:force_original_aspect_ratio=increase,crop=512:512`;

        fluent_ffmpeg(tmp)
            .addOutputOptions([
                `-vcodec`, `libwebp`,
                `-vf`, vfFiltro,
                `-lossless`, `0`,
                `-compression_level`, `6`,
                `-q:v`, `80`,
                `-an`,
                `-f`, `webp`
            ])
            .on("error", (err) => reject(err))
            .on("end", () => resolve())
            .save(out)
    })
}

function sticker6(img, url, packname, author, categories = [""], extra = {}) {
    return new Promise(async (resolve, reject) => {
        const keepScale = extra && extra.keepScale ? true : false;

        if (url) {
            const res = await fetch(url)
            if (res.status !== 200) return reject(new Error('fetch failed'))
            img = await res.buffer()
        }

        const type = (await fileTypeFromBuffer(img)) || { mime: 'application/octet-stream', ext: 'bin' }
        if (type.ext === 'bin') return reject(new Error('tipo desconocido'))

        const tmp = path.join(__dirname, `../tmp/${+new Date()}.${type.ext}`)
        const out = tmp + '.webp'
        await fs.promises.writeFile(tmp, img)

        const esVideo = /video/i.test(type.mime)
        const esGif = type.ext === 'gif'
        const esWebpAnim = type.ext === 'webp' && esWebpAnimado(img)
        const esAnimado = esVideo || esGif || esWebpAnim

        const limpiar = () => {
            try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp) } catch {}
            try { if (fs.existsSync(out)) fs.unlinkSync(out) } catch {}
        }

        if (!esAnimado) {
            try {
                await convertirEstatico(tmp, out, keepScale)
                const result = await fs.promises.readFile(out)
                limpiar()
                return resolve(result)
            } catch (e) {
                limpiar()
                return reject(e)
            }
        }

        let resultado = null
        for (const fps of FPS_STEPS) {
            try {
                if (fs.existsSync(out)) fs.unlinkSync(out)
                await convertirAnimado(tmp, out, fps, esVideo, keepScale)
                if (!fs.existsSync(out)) continue
                const stat = fs.statSync(out)
                if (stat.size <= MAX_SIZE_BYTES) {
                    resultado = await fs.promises.readFile(out)
                    break
                }
            } catch (e) {
                continue
            }
        }

        limpiar()

        if (resultado && esWebpValido(resultado)) {
            resolve(resultado)
        } else {
            reject(new Error('no se pudo generar webp valido'))
        }
    })
}

async function sticker5(img, url, packname, author, categories = [""], extra = {}) {
    const keepScale = extra && extra.keepScale ? true : false;
    const { Sticker } = await import("wa-sticker-formatter")
    const buffer = await new Sticker(img ? img : url)
        .setPack(packname)
        .setAuthor(author)
        .setQuality(100)
        .setType(keepScale ? 'full' : 'crop') 
        .toBuffer()
    return buffer
}

async function addExif(webpSticker, packname, author, categories = [""], extra = {}) {
    const img = new webp.Image()
    const json = {
        "sticker-pack-id": crypto.randomBytes(32).toString("hex"),
        "sticker-pack-name": packname,
        "sticker-pack-publisher": author,
        "emojis": categories,
        ...extra,
    }
    const exifAttr = Buffer.from([
        0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
        0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
    ])
    const jsonBuffer = Buffer.from(JSON.stringify(json), "utf8")
    const exif = Buffer.concat([exifAttr, jsonBuffer])
    exif.writeUIntLE(jsonBuffer.length, 14, 4)
    await img.load(webpSticker)
    img.exif = exif
    return await img.save(null)
}

// ── sticker con sonido (función BETA de WhatsApp: el audio vive DENTRO del sticker) ──
// El sticker clásico es WebP y no puede llevar audio, y mandar un MP4 como sticker
// rompe al cliente ("No se puede ver la información sobre el sticker"). El formato
// que sí funciona es el que WhatsApp usa en su beta: Message.audioStickerMessage
// (campo 134 del protobuf) = un FutureProofMessage con un stickerMessage dentro, y
// ese stickerMessage lleva el audio como audioMessage en su campo 26. Baileys aún
// no conoce esos campos, así que se escriben a mano en el protobuf (ver
// enviarStickerConAudio) y se manda con relayMessage. Clientes sin la beta igual
// ven el sticker animado (es webp normal por dentro).
// Reglas que pidió el owner: máx 10 segundos (audio y video) y máx 0.96MB.
// Para el peso (misma idea del comando clásico): se bajan los FPS progresivamente
// hasta el piso 8 y si aún pesa más de 0.96MB se baja la CALIDAD hasta que entre.
const FPS_STEPS_SONIDO = FPS_STEPS // misma escalera que el clásico: [60,30,24,20,15,12,10,8]
const CALIDAD_STEPS_SONIDO = [60, 50, 40, 30, 20, 12] // después del piso de fps, baja la calidad
const MAX_BYTES_SONIDO = 960000 // 0.96MB
const STICKER_MAX_SEG = 10
// El audio va aparte: opus barato y liviano; aac de respaldo si ffmpeg no tiene libopus.
const FORMATOS_AUDIO_SONIDO = [
    { ext: 'ogg', mimetype: 'audio/ogg; codecs=opus', args: ['-c:a', 'libopus', '-b:a', '48k', '-ar', '48000', '-ac', '1', '-f', 'ogg'] },
    { ext: 'm4a', mimetype: 'audio/mp4', args: ['-c:a', 'aac', '-b:a', '64k', '-ar', '44100', '-ac', '1', '-f', 'ipod'] }
]

const parseFps = (str) => {
    const [a, b] = String(str || '').split('/').map(Number)
    if (!a) return 0
    return b ? a / b : a
}

function probeVideo(tmp) {
    return new Promise((resolve, reject) => {
        fluent_ffmpeg.ffprobe(tmp, (err, data) => {
            if (err) return reject(err)
            const stream = (data.streams || []).find(s => s.codec_type === 'video')
            resolve({
                tieneAudio: (data.streams || []).some(s => s.codec_type === 'audio' && !/cover| attached/.test(s.codec_name || '')),
                duracion: parseFloat(data.format?.duration) || parseFloat(stream?.duration) || 0,
                fps: parseFps(stream?.avg_frame_rate) || parseFps(stream?.r_frame_rate) || 0
            })
        })
    })
}

// ¿Este video lleva pista de audio? (ffprobe; falla → false)
async function videoTieneAudio(img) {
    const type = (await fileTypeFromBuffer(img)) || { ext: 'bin' }
    const tmp = path.join(__dirname, `../tmp/${+new Date()}probe.${type.ext}`)
    try {
        await fs.promises.writeFile(tmp, img)
        return (await probeVideo(tmp)).tieneAudio
    } catch {
        return false
    } finally {
        try { fs.existsSync(tmp) && fs.unlinkSync(tmp) } catch {}
    }
}

// Saca la pista de audio del video, recortada a maxSeg; opus primero, aac de respaldo.
const extraerAudio = (tmp, out, fmt, maxSeg) => new Promise((resolve, reject) => {
    fluent_ffmpeg(tmp)
        .addOutputOptions(['-vn', '-t', `${maxSeg}`, ...fmt.args])
        .on('error', (err) => reject(err))
        .on('end', () => resolve())
        .save(out)
})

async function prepararAudioSonido(tmp, maxSeg) {
    let ultimoError = null
    for (const fmt of FORMATOS_AUDIO_SONIDO) {
        const out = `${tmp}.audio.${fmt.ext}`
        try {
            if (fs.existsSync(out)) fs.unlinkSync(out)
            await extraerAudio(tmp, out, fmt, maxSeg)
            if (!fs.existsSync(out)) throw new Error('audio vacío')
            const buf = await fs.promises.readFile(out)
            if (!buf.length) throw new Error('audio vacío')
            let duracion = 0
            try { duracion = (await probeVideo(out)).duracion } catch {}
            return {
                buffer: buf,
                mimetype: fmt.mimetype,
                seconds: Math.max(1, Math.round(Math.min(maxSeg, duracion || maxSeg)))
            }
        } catch (e) {
            ultimoError = e
        }
    }
    throw ultimoError || new Error('no se pudo extraer el audio del video')
}

// Devuelve { sticker: webpAnimado≤0.96MB, audio: { buffer, mimetype, seconds } }.
// El video y su audio se recortan a los primeros 10 segundos (límite de stickers).
async function stickerConAudio(img, url, extra = {}) {
    if (url) {
        const res = await fetch(url)
        if (res.status !== 200) throw new Error('fetch failed')
        img = await res.buffer()
    }
    const type = (await fileTypeFromBuffer(img)) || { mime: '', ext: 'bin' }
    if (!/video|gif/i.test(type.mime)) throw new Error('el sticker con sonido necesita un video (o gif)')

    const maxSeg = Math.max(1, Math.min(STICKER_MAX_SEG, extra.segundos || STICKER_MAX_SEG))
    const tmp = path.join(__dirname, `../tmp/${+new Date()}sa.${type.ext}`)
    const out = tmp + '.webp'
    const limpiar = () => {
        for (const f of [tmp, out, `${tmp}.audio.ogg`, `${tmp}.audio.m4a`]) {
            try { if (fs.existsSync(f)) fs.unlinkSync(f) } catch {}
        }
    }

    await fs.promises.writeFile(tmp, img)

    // La escalera se recorta al fps de la fuente: pedir 60fps a un video de 24
    // solo duplicaría frames y engordaría el archivo. El piso es el del clásico (8).
    let fpsFuente = 0
    try { fpsFuente = Math.round((await probeVideo(tmp)).fps) } catch {}
    const techo = fpsFuente > 0 ? Math.min(60, fpsFuente) : 60
    const fpsLista = [...new Set(FPS_STEPS_SONIDO)].filter(f => f <= techo).sort((a, b) => b - a)
    const piso = fpsLista[fpsLista.length - 1]

    // FASE 1: se bajan los FPS progresivamente (calidad base).
    // FASE 2: si al piso de fps sigue pesando >0.96MB, se baja la CALIDAD.
    const intentos = fpsLista.map(fps => ({ fps, calidad: 70 }))
    for (const c of CALIDAD_STEPS_SONIDO) intentos.push({ fps: piso, calidad: c })

    let sticker = null // el primero que entra en 0.96MB
    let ultimoGenerado = null // el más liviano producido (último recurso)
    for (const it of intentos) {
        try {
            if (fs.existsSync(out)) fs.unlinkSync(out)
            await convertirAnimado(tmp, out, it.fps, true, false, it.calidad, maxSeg)
            if (!fs.existsSync(out)) continue
            const buf = await fs.promises.readFile(out)
            ultimoGenerado = buf
            if (buf.length <= MAX_BYTES_SONIDO) {
                sticker = buf
                break
            }
        } catch (e) {
            continue
        }
    }
    sticker = sticker || ultimoGenerado
    if (!sticker || !esWebpValido(sticker)) {
        limpiar()
        throw new Error('no se pudo generar el webp del sticker con sonido')
    }

    let audio = null
    try { audio = await prepararAudioSonido(tmp, maxSeg) } catch (e) { audio = null }

    limpiar()
    if (!audio) throw new Error('el video no tiene pista de audio utilizable')
    return { sticker, audio }
}

// ── envío del sticker CON audio (protobuf a mano) ──
const CLAVE_RAW_AUDIO_STICKER = '__audioStickerRaw'

function varint(n) {
    const bytes = []
    while (n > 127) {
        bytes.push((n % 128) | 128)
        n = Math.floor(n / 128)
    }
    bytes.push(n)
    return Buffer.from(bytes)
}

// Campo de tipo "bytes/mensaje" (wire type 2) con número `num`.
const campoProto = (num, datos) => Buffer.concat([varint(num * 8 + 2), varint(datos.length), datos])

// Hace que proto.Message.encode agregue el campo 134 (audioStickerMessage) cuando
// el mensaje lo trae; sin el campo, encode queda exactamente igual que antes.
function instalarParcheAudioSticker(protoMsg) {
    if (!protoMsg || typeof protoMsg.encode !== 'function') return false
    if (protoMsg.__parcheAudioSticker) return true
    const original = protoMsg.encode
    protoMsg.encode = function (mensaje, escritor) {
        const w = original.call(this, mensaje, escritor)
        const crudo = mensaje && mensaje[CLAVE_RAW_AUDIO_STICKER]
        if (crudo && crudo.length) w.uint32(134 * 8 + 2).bytes(crudo)
        return w
    }
    protoMsg.__parcheAudioSticker = true
    return true
}

// Envía el sticker webp con el audio adentro (beta de WhatsApp). Devuelve true;
// si algo falla lanza — el que llama decide el sticker clásico de respaldo.
async function enviarStickerConAudio(conn, jid, stickerBuf, audio, quotedMsg) {
    if (typeof conn?.waUploadToServer !== 'function') throw new Error('el socket no soporta subida de medios')
    const baileys = await import('@whiskeysockets/baileys')
    const protoMsg = baileys.proto?.Message
    if (!instalarParcheAudioSticker(protoMsg)) throw new Error('la librería no expone proto.Message')

    const subida = { upload: conn.waUploadToServer }
    const subidoSticker = await baileys.prepareWAMessageMedia({ sticker: stickerBuf }, subida)
    const stickerMsg = subidoSticker?.stickerMessage
    if (!stickerMsg) throw new Error('no se pudo subir el sticker')
    stickerMsg.isAnimated = true

    const subidoAudio = await baileys.prepareWAMessageMedia(
        { audio: audio.buffer, mimetype: audio.mimetype, seconds: audio.seconds, ptt: false },
        subida
    )
    const audioMsg = subidoAudio?.audioMessage
    if (!audioMsg) throw new Error('no se pudo subir el audio')

    // Armamos el mensaje normal con sticker (así la librería agrega la cita/respuesta
    // al sticker) y después lo convertimos a audioStickerMessage a mano.
    const armado = baileys.generateWAMessageFromContent(
        jid,
        { stickerMessage: stickerMsg },
        { userJid: conn.user?.id || conn.user?.jid, quoted: quotedMsg }
    )
    const mensaje = armado.message
    const stickerConCita = mensaje.stickerMessage || stickerMsg
    delete mensaje.stickerMessage

    const stickerBytes = Buffer.concat([
        Buffer.from(protoMsg.StickerMessage.encode(stickerConCita).finish()),
        campoProto(26, Buffer.from(protoMsg.AudioMessage.encode(audioMsg).finish()))
    ])
    // Message.audioStickerMessage (134) = FutureProofMessage { message(1) = Message { stickerMessage(26) = sticker + audio } }
    mensaje[CLAVE_RAW_AUDIO_STICKER] = campoProto(1, campoProto(26, stickerBytes))

    await conn.relayMessage(jid, mensaje, { messageId: armado.key.id })
    return true
}

async function sticker(img, url, ...args) {
    let lastError
    for (const func of [global.support?.ffmpeg && sticker6, sticker5].filter(Boolean)) {
        try {
            const resultado = await func(img, url, ...args)
            if (!Buffer.isBuffer(resultado)) continue
            if (!esWebpValido(resultado)) continue
            try {
                return await addExif(resultado, ...args)
            } catch (e) {
                return resultado
            }
        } catch (err) {
            lastError = err
            continue
        }
    }
    return lastError
}

const support = {
    ffmpeg: true,
    ffprobe: true,
    ffmpegWebp: true,
    convert: true,
    magick: false,
    gm: false,
    find: false,
}

export { sticker, sticker6, addExif, stickerConAudio, videoTieneAudio, enviarStickerConAudio, support }