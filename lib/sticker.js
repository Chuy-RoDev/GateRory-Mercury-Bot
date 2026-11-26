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

function convertirAnimado(tmp, out, fps, esVideo, keepScale, calidad = 70, maxSeg = MAX_SEGUNDOS_VIDEO, tamano = 512) {
    return new Promise((resolve, reject) => {
        let cmd = fluent_ffmpeg(tmp)
        if (esVideo) cmd = cmd.inputOptions([`-t`, `${maxSeg}`])

        const vfFiltro = keepScale
            ? `scale=${tamano}:${tamano}:force_original_aspect_ratio=decrease,pad=${tamano}:${tamano}:(ow-iw)/2:(oh-ih)/2:color=0x00000000,fps=${fps}`
            : `scale=${tamano}:${tamano}:force_original_aspect_ratio=increase,crop=${tamano}:${tamano},fps=${fps}`;

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
// Reglas que pidió el owner (v2): se arranca a CALIDAD MÁXIMA (q70) con el fps
// de la fuente y si pesa >0.96MB el FPS BAJA DE 5 EN 5 con piso 48 ("baja 5,
// sigue pesando, baja 5... hasta 48 — hasta ahí llega"). Si al piso de fps aún
// pesa, AHÍ sí baja la CALIDAD progresivamente, y como último recurso el
// TAMAÑO por frame (512→384→320→256, último recurso 192px). Tope 30s / 0.96MB.
const PISO_FPS_SONIDO = 48
const CALIDAD_STEPS_SONIDO = [70, 60, 50, 40, 35, 30, 25, 20, 15, 10]
const TAMANO_STEPS_SONIDO = [384, 320, 256] // menos píxeles por frame (solo si la calidad ya no da más)
const MAX_BYTES_SONIDO = 960000 // 0.96MB del MENSAJE completo (webp + audio dentro)
const STICKER_MAX_SEG = 30
// El audio va aparte: opus barato y liviano; aac de respaldo si ffmpeg no tiene libopus.
// 32k mono: WhatsApp usa ~16kbps en notas de voz, así que 32k sobra — y cada KB
// de audio es un KB que le quita al presupuesto del webp (0.96MB es del MENSAJE).
// VBR de libopus se pasaba del 48k declarado (242KB reales a 30s → con 32k bajó ~40%).
const FORMATOS_AUDIO_SONIDO = [
    { ext: 'ogg', mimetype: 'audio/ogg; codecs=opus', args: ['-c:a', 'libopus', '-b:a', '32k', '-ar', '48000', '-ac', '1', '-f', 'ogg'] },
    { ext: 'm4a', mimetype: 'audio/mp4', args: ['-c:a', 'aac', '-b:a', '48k', '-ar', '44100', '-ac', '1', '-f', 'ipod'] }
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

// Encode de 2 segundos para medir los bytes/frame REALES del contenido a 512px
// q50. Devuelve 0 si falla (y entonces no se salta ningún intento de la escalera).
function sondeoPeso(tmp, fps) {
    return new Promise((resolve) => {
        const probeOut = `${tmp}.probe.webp`
        fluent_ffmpeg(tmp)
            .inputOptions(['-t', '2'])
            .addOutputOptions([
                '-vcodec', 'libwebp',
                '-vf', `scale=512:512:force_original_aspect_ratio=increase,crop=512:512,fps=${fps}`,
                '-lossless', '0', '-compression_level', '3', '-q:v', '50', '-loop', '0', '-an', '-f', 'webp'
            ])
            .on('error', () => resolve(0))
            .on('end', () => {
                try { resolve(fs.statSync(probeOut).size / (2 * fps)) } catch { resolve(0) }
            })
            .save(probeOut)
    })
}

// Curva MEDIDA (diag-escalera-sticker.mjs): de q50 a q10 el webp real solo baja
// a ~0.6× — sub-lineal (exponente 0.35), nada que ver con una curva lineal. El
// área pesa al cuadrado. Margen ×1.4 (peor desvío observado de la fórmula).
const estimoBytesSonido = (bpf, fps, calidad, tamano, dur = STICKER_MAX_SEG) =>
    bpf * dur * fps * Math.pow(calidad / 50, 0.35) * Math.pow(tamano / 512, 2) * 1.4

// Pisos de fps de una fuente: baja de 5 en 5 hasta el piso 48 (60→55→50→48). Si
// la fuente ya está en el piso o debajo (30fps típico), no hay fase de fps. 0 =
// fps desconocido (el que llama decide el default).
const pisosFpsSonido = (fuente) => {
    const f = Math.round(fuente || 0)
    if (f <= 0) return 0
    if (f <= PISO_FPS_SONIDO) return f
    const lista = []
    for (let x = Math.min(60, f); x > PISO_FPS_SONIDO; x -= 5) lista.push(x)
    lista.push(PISO_FPS_SONIDO)
    return lista
}

// La escalera COMPLETA de intentos (exportada para las sims):
// fase 1 = fps de 5 en 5 a calidad máx q70, fase 2 = calidad en el piso de fps,
// fase 3 = tamaño. Con `bpf` (bytes/frame del sondeo) se salta lo imposible
// contra el `presupuesto` (0.96MB MENOS el audio: el mensaje es webp+audio).
const construirIntentosSonido = (fuente, bpf, presupuesto = MAX_BYTES_SONIDO, maxSeg = STICKER_MAX_SEG) => {
    const pisos = pisosFpsSonido(fuente)
    const fpsBase = Array.isArray(pisos) ? pisos[pisos.length - 1] : pisos
    let intentos = []
    if (Array.isArray(pisos)) for (const f of pisos) intentos.push({ fps: f, calidad: 70, tamano: 512 })
    if (fpsBase) {
        for (const c of CALIDAD_STEPS_SONIDO) intentos.push({ fps: fpsBase, calidad: c, tamano: 512 })
        for (const tam of TAMANO_STEPS_SONIDO) for (const c of [40, 30, 20, 12]) intentos.push({ fps: fpsBase, calidad: c, tamano: tam })
        for (const c of [30, 15, 8]) intentos.push({ fps: fpsBase, calidad: c, tamano: 192 })
    }
    // dedupe: la fase fps siempre termina en {piso, q70} y la fase calidad
    // arranca igual — sin esto el primer intento de la fase 2 se codifica 2 veces
    const vistos = new Set()
    intentos = intentos.filter(it => {
        const k = `${it.fps}|${it.calidad}|${it.tamano}`
        if (vistos.has(k)) return false
        vistos.add(k)
        return true
    })
    if (bpf) intentos = intentos.filter(it => estimoBytesSonido(bpf, it.fps, it.calidad, it.tamano, maxSeg) <= presupuesto * 1.35)
    if (!intentos.length && fpsBase) intentos = [{ fps: fpsBase, calidad: 12, tamano: 192 }]
    return intentos
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

// Devuelve { sticker, audio } donde sticker+audio TOCAN ≤0.96MB en total:
// WhatsApp manda webp y audio JUNTOS (audioStickerMessage), así que el
// presupuesto del webp es 0.96MB MENOS los bytes del audio. El video y su
// audio se recortan a los primeros 30 segundos (regla del owner). Si con 30s
// nada entra en presupuesto, se baja la DURACIÓN antes que mandar algo pesado.
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
        for (const f of [tmp, out, `${tmp}.audio.ogg`, `${tmp}.audio.m4a`, `${tmp}.probe.webp`]) {
            try { if (fs.existsSync(f)) fs.unlinkSync(f) } catch {}
        }
    }

    await fs.promises.writeFile(tmp, img)

    // El fps viene de la fuente (techo 60; si ffprobe no lo da, 30 = sin fase de
    // fps). Con 30s y 60fps son 1800 frames: antes de la escalera un SONDEO de
    // 2s mide los bytes/frame reales del contenido y con eso se salta cualquier
    // intento imposible — el sticker no tarda minutos en generarse.
    let fpsFuente = 0
    try { fpsFuente = Math.round((await probeVideo(tmp)).fps) } catch {}
    if (!fpsFuente) fpsFuente = 30
    const fuente = Math.min(60, fpsFuente)

    const bpf = await sondeoPeso(tmp, fuente)

    // El audio se prepara ANTES de la escalera: el límite de WhatsApp es para el
    // MENSAJE completo (webp + audio dentro), no solo el webp. 30s de opus 48k
    // son ~180KB — antes el webp salía de 958KB y el mensaje real pesaba ~1.14MB
    // y WhatsApp lo rechazaba ("no se puede ver la información del sticker").
    let audio = null
    try { audio = await prepararAudioSonido(tmp, maxSeg) } catch (e) { audio = null }
    const presupuestoWebp = audio ? Math.max(300000, MAX_BYTES_SONIDO - audio.buffer.length) : MAX_BYTES_SONIDO

    const intentos = construirIntentosSonido(fuente, bpf, presupuestoWebp, maxSeg)

    let sticker = null // el primero que entra en 0.96MB
    let ultimoGenerado = null // el más liviano producido (último recurso)
    const debugEscalera = process.env.DEBUG_ESCALERA === '1' // DEBUG_ESCALERA=1 node index.js
    for (const it of intentos) {
        try {
            if (fs.existsSync(out)) fs.unlinkSync(out)
            await convertirAnimado(tmp, out, it.fps, true, false, it.calidad, maxSeg, it.tamano)
            if (!fs.existsSync(out)) continue
            const buf = await fs.promises.readFile(out)
            ultimoGenerado = buf
            const cabe = buf.length <= presupuestoWebp
            if (debugEscalera) console.log(`[escalera 30s] fps=${it.fps} q=${it.calidad} tam=${it.tamano} → ${buf.length} bytes (límite ${presupuestoWebp}) ${cabe ? '✓ CABE' : '✗'}`)
            if (cabe) {
                sticker = buf
                break
            }
        } catch (e) {
            continue
        }
    }

    // ÚLTIMO RECURSO CON GARANTÍA: si NADA de la escalera entró en presupuesto,
    // se baja la DURACIÓN (24→18→12→8s) antes que mandar un sticker de 1.2MB+
    // que WhatsApp rechaza. El fps se queda en el piso, y el audio se re-extrae
    // más corto en cada paso (así pesa menos y el presupuesto del webp crece).
    if (!sticker) {
        const pisos = pisosFpsSonido(fuente)
        const fpsPiso = Array.isArray(pisos) ? pisos[pisos.length - 1] : pisos
        const mini = [
            { fps: fpsPiso, calidad: 40, tamano: 512 }, { fps: fpsPiso, calidad: 40, tamano: 384 },
            { fps: fpsPiso, calidad: 30, tamano: 256 }, { fps: fpsPiso, calidad: 20, tamano: 192 },
            { fps: fpsPiso, calidad: 12, tamano: 192 }, { fps: fpsPiso, calidad: 8, tamano: 192 }
        ]
        for (const dur of [24, 18, 12, 8]) {
            const seg = Math.min(dur, maxSeg)
            let audioCorto = null
            try { audioCorto = await prepararAudioSonido(tmp, seg) } catch (e) { break }
            const presupuestoCorto = Math.max(300000, MAX_BYTES_SONIDO - audioCorto.buffer.length)
            let intentosCortos = bpf ? mini.filter(it => estimoBytesSonido(bpf, it.fps, it.calidad, it.tamano, seg) <= presupuestoCorto * 1.35) : mini
            if (!intentosCortos.length) intentosCortos = [mini[mini.length - 1]]
            for (const it of intentosCortos) {
                try {
                    if (fs.existsSync(out)) fs.unlinkSync(out)
                    await convertirAnimado(tmp, out, it.fps, true, false, it.calidad, seg, it.tamano)
                    if (!fs.existsSync(out)) continue
                    const buf = await fs.promises.readFile(out)
                    const cabe = buf.length <= presupuestoCorto
                    if (debugEscalera) console.log(`[escalera ${seg}s] fps=${it.fps} q=${it.calidad} tam=${it.tamano} → ${buf.length} bytes (límite ${presupuestoCorto}) ${cabe ? '✓ CABE' : '✗'}`)
                    if (cabe) {
                        sticker = buf
                        audio = audioCorto
                        break
                    }
                } catch (e) { continue }
            }
            if (sticker) break
        }
    }

    sticker = sticker || null
    if (!sticker || !esWebpValido(sticker)) {
        limpiar()
        throw new Error('no alcancé a meter el sticker en 0.96MB ni recortando duración — manda un video más liviano')
    }

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

export { sticker, sticker6, addExif, stickerConAudio, videoTieneAudio, enviarStickerConAudio, construirIntentosSonido, pisosFpsSonido, support }