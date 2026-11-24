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

function convertirAnimado(tmp, out, fps, esVideo, keepScale) {
    return new Promise((resolve, reject) => {
        let cmd = fluent_ffmpeg(tmp)
        if (esVideo) cmd = cmd.inputOptions([`-t`, `${MAX_SEGUNDOS_VIDEO}`])
        
        const vfFiltro = keepScale 
            ? `scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,fps=${fps}`
            : `scale=512:512:force_original_aspect_ratio=increase,crop=512:512,fps=${fps}`;

        cmd.addOutputOptions([
            `-vcodec`, `libwebp`,
            `-vf`, vfFiltro,
            `-lossless`, `0`,
            `-compression_level`, `3`,
            `-q:v`, `70`,
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

// ── sticker con sonido (WhatsApp 2026: sticker con audio que suena al tocar) ──
// El sticker clásico es WebP y no puede llevar audio. El camino que sí funciona
// desde un bot: enviar como sticker un MP4 CON pista de audio (Baileys sube el
// media sin validar el mimetype y WhatsApp lo muestra como sticker animado con
// ícono de sonido; en modo silencio no suena). Reglas de WhatsApp para stickers:
// 512×512 y ≤10 segundos; el audio va en AAC mono barato.
// Para el peso (idea del comando clásico): se bajan los FPS progresivamente
// hasta 30 — piso, no baja más — y si a 30 fps el archivo sigue pesando más de
// 1MB, se baja la CALIDAD (CRF) progresivamente hasta que entre.
const FPS_STEPS_SONIDO = [60, 48, 40, 30] // escalera de fps; 30 es el piso
const CRF_BASE = 30
const CRF_STEPS_SONIDO = [32, 34, 36, 38, 40] // menos calidad = más CRF
const MAX_SIZE_SONIDO = 1024 * 1024 // objetivo 1MB
const STICKER_MAX_SEG = 10

const esMp4Valido = (buf) => !!buf && buf.length > 12 && buf.slice(4, 8).toString() === 'ftyp'

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

const convertirSonido = (tmp, out, fps, maxSeg, crf) => {
    return new Promise((resolve, reject) => {
        fluent_ffmpeg(tmp)
            .inputOptions([`-t`, `${maxSeg}`])
            .addOutputOptions([
                `-vcodec`, `libx264`,
                `-vf`, `scale=512:512:force_original_aspect_ratio=increase,crop=512:512,fps=${fps}`,
                `-pix_fmt`, `yuv420p`,
                `-profile:v`, `baseline`, `-level`, `3.1`,
                `-crf`, `${crf}`, `-preset`, `veryfast`,
                `-c:a`, `aac`, `-b:a`, `48k`, `-ar`, `44100`, `-ac`, `1`,
                `-movflags`, `+faststart`,
                `-f`, `mp4`
            ])
            .on('error', (err) => reject(err))
            .on('end', () => resolve())
            .save(out)
    })
}

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
    const out = tmp + '.mp4'
    const limpiar = () => {
        try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp) } catch {}
        try { if (fs.existsSync(out)) fs.unlinkSync(out) } catch {}
    }

    await fs.promises.writeFile(tmp, img)

    // La escalera se recorta al fps de la fuente: pedir 60fps a un video de 24
    // solo duplicaría frames y engordaría el archivo. El piso absoluto es 30
    // salvo que la fuente tenga menos (ahí no hay nada que bajar).
    let fpsFuente = 0
    try { fpsFuente = Math.round((await probeVideo(tmp)).fps) } catch {}
    const techo = fpsFuente > 0 ? Math.min(60, fpsFuente) : 60
    const fpsLista = [...new Set([techo, ...FPS_STEPS_SONIDO])].filter(f => f <= techo).sort((a, b) => b - a)
    const piso = fpsLista[fpsLista.length - 1]

    // FASE 1: se bajan los FPS progresivamente (con calidad base).
    // FASE 2: si a 30fps sigue pesando >1MB, se baja la CALIDAD progresivamente.
    const intentos = fpsLista.map(fps => ({ fps, crf: CRF_BASE }))
    for (const crf of CRF_STEPS_SONIDO) intentos.push({ fps: piso, crf })

    let resultado = null // el primero que entra en 1MB
    let ultimoGenerado = null // el más liviano producido (último recurso)
    let ultimoError = null
    for (const it of intentos) {
        try {
            if (fs.existsSync(out)) fs.unlinkSync(out)
            await convertirSonido(tmp, out, it.fps, maxSeg, it.crf)
            if (!fs.existsSync(out)) continue
            const buf = await fs.promises.readFile(out)
            ultimoGenerado = buf
            if (buf.length <= MAX_SIZE_SONIDO) {
                resultado = buf
                break
            }
        } catch (e) {
            ultimoError = e
            continue
        }
    }
    limpiar()

    // Si nada entró en 1MB se entrega igual el intento más bajo (piso de fps y
    // máxima calidad bajada) en vez de fallar — el sticker sale aunque pesado.
    const final = resultado || ultimoGenerado
    if (final && esMp4Valido(final)) return final
    throw ultimoError || new Error('no se pudo generar el mp4 del sticker con sonido')
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

export { sticker, sticker6, addExif, stickerConAudio, videoTieneAudio, support }