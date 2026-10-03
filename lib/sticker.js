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

export { sticker, sticker6, addExif, support }