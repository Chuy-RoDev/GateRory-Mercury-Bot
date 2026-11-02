// ── osu-replay — /replaymania: replay de mania-tracker → .osr o video mp4 ────
//
//   .replaymania <enlace|scoreId>              → baja el .osr COMPLETO y lo manda
//   .replaymania video <enlace|scoreId>        → además lo renderiza a mp4 (pesado)
//   .replaymania video 720 <enlace>            → video a 720p60 (default 480p30)
//
// Enlaces que acepta: https://mania-tracker.com/replay?uploadId=… o ?scoreId=…,
// un scoreId suelto, o la ruta a un .osr ya bajado en el servidor.
//
// Para renderizar con TU skin: deja tu .osk como  database/skin-mania.osk
//
// El render usa lib/replay2mp4.mjs (sin dependencias npm; solo ffmpeg/ffprobe
// en el PATH — en Termux: pkg install ffmpeg). En un teléfono el render de un
// mapa largo tarda varios minutos: el modo normal (solo .osr) es instantáneo.
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RENDERER = path.join(__dirname, '..', '..', 'lib', 'replay2mp4.mjs')
const SKIN_DEFAULT = path.join(__dirname, '..', '..', 'database', 'skin-mania.osk')

function correr(args, timeoutMs) {
  return new Promise((ok, mal) => {
    const p = spawn(process.execPath, [RENDERER, ...args], { cwd: os.tmpdir() })
    let salida = '', error = ''
    const temporizador = setTimeout(() => { p.kill('SIGKILL'); mal(new Error('el render tardó demasiado y lo cancelé')) }, timeoutMs)
    p.stdout.on('data', (d) => { salida += d })
    p.stderr.on('data', (d) => { error += d })
    p.on('error', (e) => { clearTimeout(temporizador); mal(e) })
    p.on('close', (c) => { clearTimeout(temporizador); c === 0 ? ok(salida) : mal(new Error((salida.split('\n').filter(l => l.includes('✖'))[0] || error || `código ${c}`).trim())) })
  })
}

const lineasUtiles = (salida) => salida.split('\n').filter(l => l.startsWith('·')).map(l => l.replace(/^·\s*/, '')).slice(-6).join('\n')

let handler = async (m, { conn, args, usedPrefix, command }) => {
    const texto = (args || []).join(' ').trim()
    if (!texto) {
        return m.reply(`ꕤ Manda el enlace de la replay de *mania-tracker* y te bajo el .osr completo.

> \`${usedPrefix}${command} https://mania-tracker.com/replay?uploadId=…\`

Con *video* además lo convierto a mp4 estilo mania-tracker (con tu skin si dejaste *database/skin-mania.osk*):
> \`${usedPrefix}${command} video <enlace>\` — 480p30, apto para celulos
> \`${usedPrefix}${command} video 720 <enlace>\` — 720p60, solo PC/servidores

El .osr sirve para osu! o para subirlo de nuevo a mania-tracker. El video necesita *ffmpeg* instalado y CPU: un mapa de 8 min tarda varios minutos.`)
    }

    // modos
    let video = false, alto = 480, fps = 30
    const partes = texto.split(/\s+/)
    while (partes.length && /^(video|720|1080|480|360|p60|60)$/i.test(partes[0])) {
        const p = partes.shift().toLowerCase()
        if (p === 'video') video = true
        else if (/^\d+$/.test(p)) alto = +p
        else if (p === '60' || p === 'p60') fps = 60
    }
    const fuente = partes.join(' ')
    if (!fuente) return m.reply(`ꕥ Falta el enlace o el scoreId después de "${video ? 'video' : ''}".`)

    // ffmpeg disponible (solo hace falta para el video)
    if (video) {
        const probe = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' })
        if (probe.error) {
            return m.reply(`ꕥ Para el video necesito *ffmpeg* y no está instalado aquí.\n> En Termux: \`pkg install ffmpeg\`\n> Mientras tanto: \`${usedPrefix}${command} ${fuente}\` te manda el .osr al instante.`)
        }
    }

    const dirTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'r2mp4-'))
    try {
        if (!video) {
            await conn.reply(m.chat, '⏳ Bajando la replay completa de mania-tracker…', m)
            const salida = path.join(dirTemp, 'replay.osr')
            const salidaLog = await correr(['--solo-osr', '--salida', salida, fuente], 90000)
            const nombre = 'replay.osr'
            const datos = fs.readFileSync(salida)
            await conn.sendMessage(m.chat, {
                document: datos,
                mimetype: 'application/octet-stream',
                fileName: nombre,
                caption: `✰ *Replay completa*\n${lineasUtiles(salidaLog)}`
            }, { quoted: m })
            return
        }

        // modo video
        const estimado = alto >= 720 ? '15-40 min' : alto >= 480 ? '8-25 min' : '4-12 min'
        await conn.reply(m.chat, `⏳ Renderizando el video a *${alto}p${fps}*… según tu CPU tarda *${estimado}*. Te aviso cuando esté.`, m)
        const salida = path.join(dirTemp, 'replay.mp4')
        const extra = []
        if (fs.existsSync(SKIN_DEFAULT)) extra.push('--skin', SKIN_DEFAULT)
        const salidaLog = await correr([
            '--alto', String(alto), '--fps', String(fps),
            '--salida', salida, ...extra, fuente,
        ], 45 * 60 * 1000)
        const datos = fs.readFileSync(salida)
        const peso = (datos.length / 1048576).toFixed(1)
        await conn.sendMessage(m.chat, {
            document: datos,
            mimetype: 'video/mp4',
            fileName: path.basename(salida),
            caption: `✰ *Replay → video (${peso} MB, ${alto}p${fps})*\n${lineasUtiles(salidaLog)}`
        }, { quoted: m })
    } catch (e) {
        m.reply(`ꕥ No pude: ${e.message}`)
    } finally {
        try { fs.rmSync(dirTemp, { recursive: true, force: true }) } catch { /* ya está */ }
    }
}

handler.help = ['replaymania']
handler.tags = ['descargas']
handler.command = ['replaymania', 'maniareplay', 'replay2mp4']

export default handler
