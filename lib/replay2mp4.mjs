#!/usr/bin/env node
// ── replay2mp4 — de mania-tracker.com a un video mp4 de la replay ────────────
//
//   node replay2mp4.mjs <link|uploadId|scoreId|archivo.osr> [opciones]
//
// Fuentes de la replay:
//   • https://mania-tracker.com/replay?uploadId=XXXX  (replay subida)
//   • https://mania-tracker.com/replay?scoreId=12345  (score de osu!mania)
//   • un número suelto (scoreId) o el .osr ya descargado (ruta a archivo)
//
// Qué hace:
//   1. Baja el .osr completo (la replay entera, no pedazos) de mania-tracker.
//   2. Resuelve el mapa por el MD5 del .osr con catboy.best.
//   3. Baja el .osz del set (nekoha → sayobot → hinai → catboy → osu.direct)
//      y saca el .osu (notas), el audio y el fondo del mapa.
//   4. Carga una skin .osk o carpeta (notas, receptores, dígitos de score y
//      combo, línea de juicio, posición de columnas del skin.ini).
//   5. Saca el avatar y el rank global del jugador de su página de
//      mania-tracker (la misma fuente que usa el sitio).
//   6. Simula los juicios con las ventanas de osu!stable y CALIBRA los conteos
//      contra la cabecera del .osr, que trae los finales reales — el panel
//      MAX/300/200/100/50/MISS termina EXACTO como en el sitio.
//   7. Renderiza escenario + HUD estilo mania-tracker (score, acc, panel
//      derecho con UR, L/R miss, KPS con pico, combo, tarjeta del jugador con
//      avatar y rank, píldoras de keys/velocidad) frame a frame → ffmpeg mp4
//      con el audio del mapa.
//
// Sin dependencias npm: solo Node (>=18) + ffmpeg/ffprobe en el PATH.
// LZMA adaptado de mania-hub (MIT, © 2026 aleju03). La fórmula del score en
// vivo es la de mania-hub src/lib/mania-score-simulation.ts (ScoreV1 de
// osu!mania, cap 1M) reescalada al score real del .osr, igual que hace el sitio.
// ─────────────────────────────────────────────────────────────────────────────

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import http from 'node:http'
import { Readable } from 'node:stream'
import { pathToFileURL } from 'node:url'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const TRACKER = 'https://mania-tracker.com'
const MANIA_KEY_MASK = (1 << 20) - 1

// ── utilidades ───────────────────────────────────────────────────────────────
const log = (...a) => console.log('·', ...a)
const die = (e) => { const m = e?.message || String(e); console.error('\n✖ ' + m); if (e?.stack) console.error('\n[stack]\n' + e.stack); process.exit(1) }

function fetchConTope(url, opts = {}, ms = 45000) {
  return fetch(url, { ...opts, signal: AbortSignal.timeout(ms), headers: { 'User-Agent': UA, ...(opts.headers || {}) } })
}

async function bajarABuffer(url, ms = 45000) {
  const r = await fetchConTope(url, {}, ms)
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`)
  return Buffer.from(await r.arrayBuffer())
}

const fmtDur = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const hex = (c) => {
  const n = parseInt(c.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// ── LZMA (FORMAT_ALONE) — adaptado de mania-hub (MIT, © 2026 aleju03) ────────
const PROB_INIT = 1024, NB = 11, NMV = 5, BMT = 1 << NB, TOP = 0xff000000 | 0
const NPB = 4, NST = 12, NLTP = 4, NAL = 4, EPMI = 14, NFD = 1 << (EPMI >> 1), MML = 2
const L_LOW = 2, L_MID = L_LOW + (1 << (NPB + 3)), L_HIGH = L_MID + (1 << (NPB + 3)), L_SIZE = L_HIGH + 256
const IS_MATCH = 0, IS_REP = IS_MATCH + (NST << NPB), IS_REP_G0 = IS_REP + NST
const IS_REP_G1 = IS_REP_G0 + NST, IS_REP_G2 = IS_REP_G1 + NST, IS_REP0L = IS_REP_G2 + NST
const POS_SLOT = IS_REP0L + (NST << NPB), POS_DEC = POS_SLOT + (NLTP << 6)
const ALIGN = POS_DEC + 1 + NFD - EPMI, LEN_DEC = ALIGN + (1 << NAL), REP_LEN_DEC = LEN_DEC + L_SIZE
const LITERAL = REP_LEN_DEC + L_SIZE

function readLzmaHeader(b) {
  if (b.length < 13) throw new Error('cabecera LZMA truncada')
  const p = b[0]
  if (p >= 9 * 5 * 5) throw new Error('byte de propiedades LZMA inválido')
  const lc = p % 9, r = Math.floor(p / 9), lp = r % 5, pb = Math.floor(r / 5)
  const dict = b.readUInt32LE(1)
  const decl = b.readBigUInt64LE(5)
  return { lc, lp, pb, dict, decl: decl === 0xffffffffffffffffn ? null : decl }
}

function decodeLzma(buffer) {
  const h = readLzmaHeader(buffer)
  if (h.dict > 64 * 1024 * 1024) throw new Error('diccionario LZMA demasiado grande')
  if (h.decl == null) throw new Error('LZMA sin tamaño declarado')
  const outSize = Number(h.decl)
  if (!Number.isSafeInteger(outSize) || outSize < 0 || outSize > 512 * 1024 * 1024) throw new Error('tamaño LZMA fuera de rango')
  const { lc, lp, pb } = h
  const out = Buffer.allocUnsafe(outSize)
  let o = 0
  const probs = new Uint16Array(LITERAL + (0x300 << (lc + lp))).fill(PROB_INIT)
  if (buffer.length < 18 || buffer[13] !== 0) throw new Error('cabecera del range coder LZMA inválida')
  let code = (buffer[14] << 24) | (buffer[15] << 16) | (buffer[16] << 8) | buffer[17]
  let pos = 18
  let range = -1
  const norm = () => {
    if ((range & TOP) === 0) {
      range <<= 8
      if (pos >= buffer.length) throw new Error('LZMA terminó antes de tiempo')
      code = ((code << 8) | buffer[pos++]) | 0
    }
  }
  const bit = (i) => {
    const prob = probs[i]
    const bound = Math.imul(range >>> NB, prob)
    let b = 0
    if ((code >>> 0) < (bound >>> 0)) { probs[i] = prob + ((BMT - prob) >>> NMV); range = bound }
    else { probs[i] = prob - (prob >>> NMV); code = (code - bound) | 0; range = (range - bound) | 0; b = 1 }
    norm()
    return b
  }
  const direct = (n) => {
    let res = 0
    for (let i = 0; i < n; i++) {
      range >>>= 1
      const t = ((code - range) >>> 31) ^ 1
      if (t === 1) code = (code - range) | 0
      res = (res << 1) | t
      norm()
    }
    return res
  }
  const tree = (off, bits) => { let m = 1; for (let i = 0; i < bits; i++) m = (m << 1) | bit(off + m); return m - (1 << bits) }
  const rtree = (off, bits) => { let m = 1, s = 0; for (let i = 0; i < bits; i++) { const b = bit(off + m); m = (m << 1) | b; s |= b << i } return s }
  const len_ = (base, ps) => {
    if (bit(base) === 0) return tree(base + L_LOW + (ps << 3), 3)
    if (bit(base + 1) === 0) return 8 + tree(base + L_MID + (ps << 3), 3)
    return 16 + tree(base + L_HIGH, 8)
  }
  const posMask = (1 << pb) - 1, litMask = (1 << lp) - 1
  let state = 0, rep0 = 0, rep1 = 0, rep2 = 0, rep3 = 0
  while (o < outSize) {
    const ps = o & posMask
    if (bit(IS_MATCH + (state << NPB) + ps) === 0) {
      const prev = o > 0 ? out[o - 1] : 0
      const base = LITERAL + 0x300 * (((o & litMask) << lc) + (prev >>> (8 - lc)))
      let sym = 1
      if (state >= 7) {
        let mb = out[o - rep0 - 1]
        do {
          const mbit = (mb >>> 7) & 1
          mb <<= 1
          const b2 = bit(base + ((1 + mbit) << 8) + sym)
          sym = (sym << 1) | b2
          if (mbit !== b2) break
        } while (sym < 0x100)
      }
      while (sym < 0x100) sym = (sym << 1) | bit(base + sym)
      out[o++] = sym & 0xff
      state = state < 4 ? 0 : state < 10 ? state - 3 : state - 6
      continue
    }
    let len
    if (bit(IS_REP + state) !== 0) {
      if (o === 0) throw new Error('rep LZMA antes de salida')
      if (bit(IS_REP_G0 + state) === 0) {
        if (bit(IS_REP0L + (state << NPB) + ps) === 0) { state = state < 7 ? 9 : 11; out[o] = out[o - rep0 - 1]; o++; continue }
      } else {
        let dist
        if (bit(IS_REP_G1 + state) === 0) dist = rep1
        else {
          if (bit(IS_REP_G2 + state) === 0) dist = rep2
          else { dist = rep3; rep3 = rep2 }
          rep2 = rep1
        }
        rep1 = rep0; rep0 = dist
      }
      len = len_(REP_LEN_DEC, ps) + MML
      state = state < 7 ? 8 : 11
    } else {
      rep3 = rep2; rep2 = rep1; rep1 = rep0
      len = len_(LEN_DEC, ps) + MML
      state = state < 7 ? 7 : 10
      const slot = tree(POS_SLOT + (Math.min(len - MML, NLTP - 1) << 6), 6)
      if (slot < 4) rep0 = slot
      else {
        const db = (slot >> 1) - 1
        rep0 = (2 | (slot & 1)) << db
        if (slot < EPMI) rep0 += rtree(POS_DEC + rep0 - slot, db)
        else { rep0 = (rep0 + (direct(db - NAL) << NAL)) >>> 0; rep0 = (rep0 + rtree(ALIGN, NAL)) >>> 0 }
        if (rep0 === 0xffffffff) break
      }
    }
    if (rep0 >= o) throw new Error('distancia LZMA fuera de rango')
    if (o + len > outSize) throw new Error('salida LZMA excedió su tamaño')
    let src = o - rep0 - 1
    if (rep0 >= len) { out.copy(out, o, src, src + len); o += len }
    else { for (let i = 0; i < len; i++) out[o++] = out[src++] }
  }
  if (o !== outSize) throw new Error('el stream LZMA acabó antes del tamaño declarado')
  return out
}

// ── lector binario con strings ULEB128 (formato .osr real) ───────────────────
class BinReader {
  constructor(buf) { this.b = buf; this.p = 0 }
  byte() { return this.b[this.p++] }
  u16() { const v = this.b.readUInt16LE(this.p); this.p += 2; return v }
  i32() { const v = this.b.readInt32LE(this.p); this.p += 4; return v }
  i64() { const v = this.b.readBigInt64LE(this.p); this.p += 8; return v }
  string() {
    if (this.byte() !== 0x0b) return ''
    let len = 0, shift = 0, byte
    do { byte = this.byte(); len |= (byte & 0x7f) << shift; shift += 7 } while (byte & 0x80)
    const s = this.b.subarray(this.p, this.p + len).toString('utf8')
    this.p += len
    return s
  }
}

const MODS_BIT = [
  [1 << 0, 'NF'], [1 << 1, 'EZ'], [1 << 3, 'HD'], [1 << 4, 'HR'],
  [1 << 6, 'DT'], [1 << 8, 'HT'], [1 << 10, 'FL'], [1 << 28, 'MR'],
]

function decodificarMods(mods) {
  const out = []
  for (const [bit, nombre] of MODS_BIT) if (mods & bit) out.push(nombre)
  if ((mods & (1 << 6)) && (mods & (1 << 9))) { const i = out.indexOf('DT'); if (i >= 0) out[i] = 'NC' }
  return out
}

// ── 1) .osr: cabecera + frames ───────────────────────────────────────────────
function parsearOsr(buf) {
  const r = new BinReader(buf)
  const modo = r.byte()
  if (modo !== 3) throw new Error(`el .osr no es de mania (modo=${modo}; el modo 3 es osu!mania)`)
  const version = r.i32()
  const beatmapMD5 = r.string()
  const jugador = r.string()
  r.string() // replay MD5
  // conteos FINALES reales de la jugada (u16 x6): MAX/300/200/100/50/miss
  const conteos = {
    max: r.u16(), n300: r.u16(), n200: r.u16(),
    n100: r.u16(), n50: r.u16(), miss: r.u16(),
  }
  const score = r.i32()
  const combo = r.u16()
  r.byte()  // perfect
  const mods = r.i32()
  r.string() // gráfica de vida (t|hp,t|hp,…): no se usa para el HUD en vivo
  r.i64()   // timestamp
  const dlen = r.i32()
  const blob = r.b.subarray(r.p, r.p + dlen)
  const texto = decodeLzma(blob).toString('utf8')

  // frames "dt|x|y|botones,...": en mania x = máscara de columnas; el último
  // frame es "-12345|0|0|seed" y stable mete un fantasma 256|-500 al arranque
  let t = 0, scrollEscala = null
  const eventos = [] // { t, mask } solo cuando cambia la máscara
  const pulsos = []  // cada pulsación individual (para el KPS)
  let prevMask = 0
  for (const pieza of texto.split(',')) {
    const p1 = pieza.indexOf('|')
    if (p1 === 6 && pieza.startsWith('-12345')) continue
    const p2 = pieza.indexOf('|', p1 + 1)
    const p3 = pieza.indexOf('|', p2 + 1)
    if (p1 < 0 || p2 < 0 || p3 < 0) continue
    const dt = +pieza.slice(0, p1)
    const x = +pieza.slice(p1 + 1, p2)
    const y = +pieza.slice(p2 + 1, p3)
    t += dt
    if (y > 0 && scrollEscala == null) scrollEscala = y
    if (x === 256 && y === -500) continue
    const mask = x & MANIA_KEY_MASK
    if (mask !== prevMask) {
      eventos.push({ t, mask })
      for (let c = 0; c < 20; c++) if ((mask & (1 << c)) && !(prevMask & (1 << c))) pulsos.push(t)
      prevMask = mask
    }
  }
  return {
    version, beatmapMD5, jugador, mods, listaMods: decodificarMods(mods), scrollEscala,
    eventos, pulsos, finMs: t, conteos, score, combo,
  }
}

// ── 2) MD5 → mapa (catboy.best) ──────────────────────────────────────────────
async function resolverMapa(md5) {
  try {
    const d = JSON.parse((await bajarABuffer(`https://catboy.best/api/md5/${md5}`)).toString('utf8'))
    if (d?.BeatmapID) return {
      beatmapId: d.BeatmapID, setId: d.ParentSetID, diff: d.DiffName || '',
      keys: d.CS || null, duracionS: d.TotalLength || null, maxCombo: d.MaxCombo || null,
    }
  } catch (e) { log(`catboy /api/md5 falló (${e.message}); pruebo /api/v2/md5`) }
  const d = JSON.parse((await bajarABuffer(`https://catboy.best/api/v2/md5/${md5}`)).toString('utf8'))
  if (!d?.id) throw new Error(`ningún espejo conoce el MD5 ${md5} (¿mapa no rankado o borrado?)`)
  return {
    beatmapId: d.id, setId: d.beatmapset_id, diff: d.version || '',
    keys: d.cs || null, duracionS: d.total_length || null, maxCombo: null,
  }
}

// ── 3) .osz: descarga por espejos + extracción selectiva del ZIP ─────────────
const ESPEJOS = (setId) => [
  `https://mirror.nekoha.moe/api/download/${setId}`,
  `https://txy1.sayobot.cn/beatmaps/download/full/${setId}`,
  `https://mirror.hinamizawa.ai/api/v1/hinai/d/${setId}`,
  `https://catboy.best/d/${setId}`,
  `https://osu.direct/api/d/${setId}`,
]

async function bajarOsz(setId, destino) {
  let ultimoError = null
  for (const url of ESPEJOS(setId)) {
    try {
      log(`bajando .osz del set ${setId} desde ${new URL(url).host} …`)
      const r = await fetchConTope(url, { redirect: 'follow' }, 300000)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const out = fs.createWriteStream(destino)
      await new Promise((ok, mal) => {
        const nodo = Readable.fromWeb(r.body)
        nodo.pipe(out); nodo.on('error', mal); out.on('finish', ok)
      })
      const sz = fs.statSync(destino).size
      if (sz < 1024) throw new Error(`respuesta sospechosa (${sz} bytes)`)
      return sz
    } catch (e) { ultimoError = e; log(`  falló: ${e.message}`) }
  }
  throw new Error(`ningún espejo sirvió el set ${setId} (${ultimoError?.message})`)
}

// ZIP mínimo: lee el directorio central y extrae solo las entradas pedidas
function entradasZip(buf) {
  const firma = Buffer.from([0x50, 0x4b, 0x05, 0x06])
  let fin = buf.length - 22
  while (fin >= 0 && buf.indexOf(firma, fin) !== fin) fin--
  if (fin < 0) throw new Error('el archivo no parece un ZIP válido')
  const n = buf.readUInt16LE(fin + 10), dir = buf.readUInt32LE(fin + 16)
  const out = []
  let p = dir
  for (let i = 0; i < n; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break
    const metodo = buf.readUInt16LE(p + 10), tamComp = buf.readUInt32LE(p + 20)
    const tam = buf.readUInt32LE(p + 24), nl = buf.readUInt16LE(p + 28), ne = buf.readUInt16LE(p + 30), nc = buf.readUInt16LE(p + 32)
    const offLocal = buf.readUInt32LE(p + 42)
    const nombre = buf.subarray(p + 46, p + 46 + nl).toString('utf8')
    out.push({ nombre, metodo, tamComp, tam, offLocal })
    p += 46 + nl + ne + nc
  }
  return out
}

function extraerZip(buf, entrada) {
  const off = entrada.offLocal
  if (buf.readUInt32LE(off) !== 0x04034b50) throw new Error(`entrada ZIP dañada: ${entrada.nombre}`)
  const nl = buf.readUInt16LE(off + 26), ne = buf.readUInt16LE(off + 28)
  const dato = buf.subarray(off + 30 + nl + ne, off + 30 + nl + ne + entrada.tamComp)
  if (entrada.metodo === 0) return Buffer.from(dato)
  if (entrada.metodo === 8) return zlib.inflateRawSync(dato)
  throw new Error(`compresión ZIP no soportada (${entrada.metodo}) en ${entrada.nombre}`)
}

function buscarZip(entradas, nombre) {
  const objetivo = nombre.toLowerCase()
  return entradas.find(e => e.nombre.toLowerCase() === objetivo)
    || entradas.find(e => e.nombre.toLowerCase().endsWith('/' + objetivo))
}

async function conseguirMapaYAudio(info, dirTemp) {
  const oszPath = path.join(dirTemp, `set_${info.setId}.osz`)
  if (!fs.existsSync(oszPath) || fs.statSync(oszPath).size < 1024) {
    const sz = await bajarOsz(info.setId, oszPath)
    log(`  .osz completo: ${(sz / 1048576).toFixed(1)} MB`)
  } else {
    log(`usando .osz en caché: ${oszPath} (${(fs.statSync(oszPath).size / 1048576).toFixed(1)} MB)`)
  }
  const buf = fs.readFileSync(oszPath)
  const entradas = entradasZip(buf)
  const nombresOsu = entradas.filter(e => e.nombre.toLowerCase().endsWith('.osu')).map(e => e.nombre)
  let osuTexto = null
  for (const nombre of nombresOsu) {
    const texto = extraerZip(buf, buscarZip(entradas, nombre)).toString('utf8')
    const m = texto.match(/^BeatmapID:\s*(\d+)\s*$/m)
    if (m && +m[1] === info.beatmapId) { osuTexto = texto; break }
  }
  if (!osuTexto && info.diff) {
    const candidato = nombresOsu.find(n => n.includes(info.diff))
    if (candidato) osuTexto = extraerZip(buf, buscarZip(entradas, candidato)).toString('utf8')
  }
  if (!osuTexto) throw new Error(`no encontré el .osu del beatmap ${info.beatmapId} (${info.diff}) dentro del set`)
  const audioNombre = osuTexto.match(/^AudioFilename:\s*(.+?)\s*$/m)?.[1]
  if (!audioNombre) throw new Error('el .osu no declara AudioFilename')
  const entradaAudio = buscarZip(entradas, audioNombre)
  if (!entradaAudio) throw new Error(`el audio ${audioNombre} no está dentro del .osz`)
  const audioPath = path.join(dirTemp, 'audio' + path.extname(audioNombre).toLowerCase())
  fs.writeFileSync(audioPath, extraerZip(buf, entradaAudio))

  let fondoBuf = null
  const mFondo = osuTexto.match(/^(?:Background|Video)\s*:\s*\d+\s*,\s*\d+\s*,\s*"?([^",\r\n]+)"?/mi)
  if (mFondo) {
    const entradaFondo = buscarZip(entradas, mFondo[1].trim())
    if (entradaFondo) fondoBuf = extraerZip(buf, entradaFondo)
  }

  log(`mapa: ${nombresOsu.length} dificultades en el set; audio ${audioNombre} (${(fs.statSync(audioPath).size / 1048576).toFixed(1)} MB)`)
  return { osuTexto, audioPath, fondoBuf }
}

// ── 4) .osu → notas ──────────────────────────────────────────────────────────
function parsearOsu(texto) {
  let seccion = ''
  const meta = { audio: '', leadIn: 0, modo: 0, keys: 4, od: 8, titulo: '', artista: '', version: '', creador: '' }
  const notas = []
  for (const cruda of texto.split(/\r?\n/)) {
    const line = cruda.trim()
    if (!line) continue
    if (line.startsWith('[')) { seccion = line; continue }
    const kv = line.match(/^(\w+)\s*:\s*(.*)$/)
    if (kv && !seccion.startsWith('[HitObjects]')) {
      const k = kv[1], v = kv[2]
      if (k === 'AudioFilename') meta.audio = v
      else if (k === 'AudioLeadIn') meta.leadIn = +v || 0
      else if (k === 'Mode') meta.modo = +v || 0
      else if (k === 'CircleSize') meta.keys = Math.round(+v) || 4
      else if (k === 'OverallDifficulty') meta.od = +v || 8
      else if (k === 'Title') meta.titulo = v
      else if (k === 'Artist') meta.artista = v
      else if (k === 'Version') meta.version = v
      else if (k === 'Creator') meta.creador = v
      continue
    }
    if (seccion.startsWith('[HitObjects]') && /^\d/.test(line)) {
      const p = line.split(',')
      if (p.length < 4) continue
      const tipo = +p[3]
      const x = +p[0]
      const t = +p[2]
      const col = Math.max(0, Math.min(meta.keys - 1, Math.floor(x * meta.keys / 512)))
      if (tipo & 128) {
        const fin = +(p[5] || '0').split(':')[0]
        notas.push({ t, fin: Math.max(fin, t + 40), col, ln: true })
      } else if (tipo & 1) {
        notas.push({ t, fin: t, col, ln: false })
      }
    }
  }
  if (meta.modo !== 0 && meta.modo !== 3) throw new Error(`el mapa no es de mania (modo=${meta.modo})`)
  notas.sort((a, b) => a.t - b.t)
  return { meta, notas }
}

// ── imágenes: decodificar PNG/JPG con ffmpeg, escalar, fundir ────────────────
const cacheDecod = new Map()

function probeTam(buf) {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let p = 2
    while (p + 9 < buf.length) {
      if (buf[p] !== 0xff) { p++; continue }
      const marc = buf[p + 1]
      if (marc >= 0xc0 && marc <= 0xcf && marc !== 0xc4 && marc !== 0xc8 && marc !== 0xcc) {
        return { h: buf.readUInt16BE(p + 5), w: buf.readUInt16BE(p + 7) }
      }
      p += 2 + buf.readUInt16BE(p + 2)
    }
  }
  throw new Error('no pude leer las dimensiones de la imagen')
}

function decodeImagen(buf, clave) {
  if (clave && cacheDecod.has(clave)) return Promise.resolve(cacheDecod.get(clave))
  const { w, h } = probeTam(buf)
  const r = spawn('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], { stdio: ['pipe', 'pipe', 'pipe'] })
  const trozos = []
  let mal = null
  r.stderr.on('data', (d) => { mal = (mal || '') + d.toString() })
  r.stdout.on('data', (d) => trozos.push(d))
  const fin = new Promise((ok, no) => {
    r.on('error', no)
    r.on('close', (c) => c === 0 ? ok() : no(new Error(`ffmpeg no decodificó la imagen: ${mal || 'código ' + c}`)))
  })
  r.stdin.end(buf)
  return fin.then(() => {
    const data = Buffer.concat(trozos)
    if (data.length < w * h * 4) throw new Error(`imagen decodificada incompleta (${data.length} < ${w * h * 4})`)
    const img = { w, h, data }
    if (clave) cacheDecod.set(clave, img)
    return img
  })
}

function nuevaImg(w, h) { return { w, h, data: Buffer.alloc(w * h * 4) } }

// escalado bilineal
function escalar(img, tw, th) {
  tw = Math.max(1, Math.round(tw)); th = Math.max(1, Math.round(th))
  if (img.w === tw && img.h === th) return { w: tw, h: th, data: Buffer.from(img.data) }
  const out = nuevaImg(tw, th)
  const sx = img.w / tw, sy = img.h / th
  for (let y = 0; y < th; y++) {
    const fy = Math.min(img.h - 1, (y + 0.5) * sy - 0.5)
    const y0 = Math.max(0, Math.floor(fy)), y1 = Math.min(img.h - 1, y0 + 1), wy = fy - y0
    for (let x = 0; x < tw; x++) {
      const fx = Math.min(img.w - 1, (x + 0.5) * sx - 0.5)
      const x0 = Math.max(0, Math.floor(fx)), x1 = Math.min(img.w - 1, x0 + 1), wx = fx - x0
      const o = (y * tw + x) * 4
      for (let c = 0; c < 4; c++) {
        const a = img.data[(y0 * img.w + x0) * 4 + c], b = img.data[(y0 * img.w + x1) * 4 + c]
        const d = img.data[(y1 * img.w + x0) * 4 + c], e = img.data[(y1 * img.w + x1) * 4 + c]
        out.data[o + c] = (a * (1 - wx) + b * wx) * (1 - wy) + (d * (1 - wx) + e * wx) * wy
      }
    }
  }
  return out
}

// estirado vertical rápido (nearest) para los cuerpos de las LNs
function estirarVertical(img, alto) {
  alto = Math.max(1, Math.round(alto))
  if (img.h === alto) return img
  const out = nuevaImg(img.w, alto)
  const fila = img.w * 4
  for (let y = 0; y < alto; y++) {
    const sy = Math.min(img.h - 1, Math.floor(y * img.h / alto))
    img.data.copy(out.data, y * fila, sy * fila, sy * fila + fila)
  }
  return out
}

function difuminar(img, radio) {
  if (radio <= 0) return img
  const { w, h } = img
  const tmp = nuevaImg(w, h)
  const out = nuevaImg(w, h)
  const pase = (src, dst, horizontal) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, n = 0
        for (let k = -radio; k <= radio; k++) {
          const xx = horizontal ? Math.min(w - 1, Math.max(0, x + k)) : x
          const yy = horizontal ? y : Math.min(h - 1, Math.max(0, y + k))
          const o = (yy * w + xx) * 4
          r += src.data[o]; g += src.data[o + 1]; b += src.data[o + 2]; n++
        }
        const o = (y * w + x) * 4
        dst.data[o] = r / n; dst.data[o + 1] = g / n; dst.data[o + 2] = b / n; dst.data[o + 3] = 255
      }
    }
  }
  pase(img, tmp, true)
  pase(tmp, out, false)
  return out
}

function oscurecer(img, factor) {
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    d[i] *= factor; d[i + 1] *= factor; d[i + 2] *= factor
  }
  return img
}

function circulo(img, tam) {
  const out = nuevaImg(tam, tam)
  const s = escalar(img, tam, tam)
  const R = tam / 2
  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      const dx = x - R + 0.5, dy = y - R + 0.5
      const d = Math.sqrt(dx * dx + dy * dy)
      const a = Math.max(0, Math.min(1, (R - d) / 1.5))
      const o = (y * tam + x) * 4
      out.data[o] = s.data[o]; out.data[o + 1] = s.data[o + 1]; out.data[o + 2] = s.data[o + 2]
      out.data[o + 3] = Math.min(s.data[o + 3], a * 255)
    }
  }
  return out
}

// ── fuente de mapa de bits 5x7 (etiquetas del HUD) ───────────────────────────
const GLIFOS = {
  A: '01110 10001 10001 11111 10001 10001 10001', B: '11110 10001 10001 11110 10001 10001 11110',
  C: '01110 10001 10000 10000 10000 10001 01110', D: '11110 10001 10001 10001 10001 10001 11110',
  E: '11111 10000 10000 11110 10000 10000 11111', F: '11111 10000 10000 11110 10000 10000 10000',
  G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 10001 11111 10001 10001 10001',
  I: '11111 00100 00100 00100 00100 00100 11111', J: '00111 00010 00010 00010 00010 10010 01100',
  K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10101 10001 10001 10001', N: '10001 11001 10101 10011 10001 10001 10001',
  O: '01110 10001 10001 10001 10001 10001 01110', P: '11110 10001 10001 11110 10000 10000 10000',
  Q: '01110 10001 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10100 10010 10001',
  S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100',
  U: '10001 10001 10001 10001 10001 10001 01110', V: '10001 10001 10001 10001 10001 01010 00100',
  W: '10001 10001 10001 10101 10101 11011 10001', X: '10001 01010 00100 00100 00100 01010 10001',
  Y: '10001 01010 00100 00100 00100 00100 00100', Z: '11111 00001 00010 00100 01000 10000 11111',
  0: '01110 10001 10011 10101 11001 10001 01110', 1: '00100 01100 00100 00100 00100 00100 01110',
  2: '01110 10001 00001 00110 01000 10000 11111', 3: '11110 00001 00001 01110 00001 00001 11110',
  4: '00010 00110 01010 10010 11111 00010 00010', 5: '11111 10000 11110 00001 00001 10001 01110',
  6: '00110 01000 10000 11110 10001 10001 01110', 7: '11111 00001 00010 00100 01000 01000 01000',
  8: '01110 10001 10001 01110 10001 10001 01110', 9: '01110 10001 10001 01111 00001 00010 01100',
  '#': '01010 01010 11111 01010 11111 01010 01010', '%': '11001 11010 00010 00100 01000 01011 10011',
  '.': '00000 00000 00000 00000 00000 01100 01100', ',': '00000 00000 00000 00000 01100 00100 01000',
  ':': '00000 01100 01100 00000 01100 01100 00000', '-': '00000 00000 00000 11111 00000 00000 00000',
  '·': '00000 00000 00000 01100 01100 00000 00000', '/': '00001 00010 00010 00100 01000 01000 10000',
  '(': '00010 00100 01000 01000 01000 00100 00010', ')': '01000 00100 00010 00010 00010 00100 01000',
  '+': '00000 00100 00100 11111 00100 00100 00000', "'": '00100 00100 00000 00000 00000 00000 00000',
  ' ': '00000 00000 00000 00000 00000 00000 00000',
}

const cacheGlifo = new Map()

function glifoRgba(car, escala, color) {
  const clave = `${car}|${escala}|${color}`
  if (cacheGlifo.has(clave)) return cacheGlifo.get(clave)
  const filas = (GLIFOS[car] || GLIFOS[' ']).split(' ')
  const [r, g, b] = hex(color)
  const w = 5 * escala, h = 7 * escala
  const img = nuevaImg(w, h)
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 5; x++) {
      if (filas[y][x] !== '1') continue
      for (let dy = 0; dy < escala; dy++) {
        for (let dx = 0; dx < escala; dx++) {
          const o = ((y * escala + dy) * w + x * escala + dx) * 4
          img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255
        }
      }
    }
  }
  cacheGlifo.set(clave, img)
  return img
}

function anchoTexto(texto, escala) {
  let w = 0
  for (const car of texto) w += (car === ' ' ? 5 : 6) * escala
  return Math.max(0, w - escala)
}

// funde `img` sobre `frame` (objeto {w,h,data}) en (x, y) con mezcla alfa
function fundir(frame, img, x, y, alpha = 1) {
  const W = frame.w, H = frame.h
  const xa = Math.max(0, x), xb = Math.min(W, x + img.w)
  const ya = Math.max(0, y), yb = Math.min(H, y + img.h)
  if (xb <= xa || yb <= ya) return
  for (let yy = ya; yy < yb; yy++) {
    const fy = yy - y
    let off = (yy * W + xa) * 4
    let io = (fy * img.w + (xa - x)) * 4
    for (let xx = xa; xx < xb; xx++, off += 4, io += 4) {
      const a = (img.data[io + 3] / 255) * alpha
      if (a <= 0) continue
      if (a >= 1) {
        frame.data[off] = img.data[io]; frame.data[off + 1] = img.data[io + 1]
        frame.data[off + 2] = img.data[io + 2]; frame.data[off + 3] = 255
      } else {
        const inv = 1 - a
        frame.data[off] = img.data[io] * a + frame.data[off] * inv
        frame.data[off + 1] = img.data[io + 1] * a + frame.data[off + 1] * inv
        frame.data[off + 2] = img.data[io + 2] * a + frame.data[off + 2] * inv
        frame.data[off + 3] = 255
      }
    }
  }
}

// rectángulo sólido con alfa sobre el frame crudo
function fundirRect(data, W, x, y, w, h, r, g, b, a) {
  const xa = Math.max(0, x), xb = Math.min(W, x + w)
  const ya = Math.max(0, y), yb = Math.min(data.length / (W * 4), y + h)
  if (xb <= xa || yb <= ya) return
  const IA = 1 - a
  for (let yy = ya; yy < yb; yy++) {
    let off = (yy * W + xa) * 4
    for (let xx = xa; xx < xb; xx++, off += 4) {
      data[off] = r * a + data[off] * IA
      data[off + 1] = g * a + data[off + 1] * IA
      data[off + 2] = b * a + data[off + 2] * IA
      data[off + 3] = 255
    }
  }
}

function textoAFrame(frame, texto, x, y, escala, color, align = 'izq') {
  texto = String(texto).toUpperCase() // la fuente 5x7 solo tiene mayúsculas
  const ancho = anchoTexto(texto, escala)
  let px = align === 'der' ? x - ancho : align === 'centro' ? Math.round(x - ancho / 2) : x
  for (const car of texto) {
    const g = glifoRgba(car, escala, color)
    fundir(frame, g, px, y)
    px += (car === ' ' ? 5 : 6) * escala
  }
}

// ── skin (.osk / carpeta) ────────────────────────────────────────────────────
function parsearSkinIni(texto) {
  const secciones = []
  let actual = null
  for (const cruda of texto.split(/\r?\n/)) {
    const line = cruda.trim()
    if (!line || line.startsWith('//')) continue
    const m = line.match(/^\[([^\]]+)\]$/)
    if (m) { actual = { nombre: m[1], kv: [] }; secciones.push(actual); continue }
    if (!actual) continue
    const kv = line.match(/^([^:]+?)\s*:\s*(.*)$/)
    if (kv) actual.kv.push([kv[1].trim(), kv[2].trim()])
  }
  return secciones
}

async function cargarSkin(rutaSkin, keys) {
  let abrir
  let zipBuf = null
  const stat = fs.statSync(rutaSkin)
  if (stat.isDirectory()) {
    abrir = (nombre) => {
      const p = path.join(rutaSkin, nombre)
      return fs.existsSync(p) ? fs.readFileSync(p) : null
    }
  } else {
    zipBuf = fs.readFileSync(rutaSkin)
    const entradas = entradasZip(zipBuf)
    abrir = (nombre) => {
      const e = buscarZip(entradas, nombre)
      return e ? extraerZip(zipBuf, e) : null
    }
  }
  const iniBuf = abrir('skin.ini')
  if (!iniBuf) throw new Error('la skin no tiene skin.ini')
  const secciones = parsearSkinIni(iniBuf.toString('utf8'))
  const mania = secciones.filter(s => s.nombre === 'Mania')
  const keysDe = (s) => +(s.kv.find(([k]) => k === 'Keys')?.[1] || -1)
  let sec = mania.find(s => keysDe(s) === keys)
  if (!sec) {
    sec = mania.filter(s => keysDe(s) <= keys).sort((a, b) => keysDe(b) - keysDe(a))[0]
    if (sec) log(`la skin no tiene sección exacta de ${keys}K; uso la de ${keysDe(sec)}K`)
  }
  if (!sec) throw new Error('la skin no tiene sección [Mania] utilizable')
  const fonts = secciones.find(s => s.nombre === 'Fonts')?.kv || []
  const valor = (k, def) => sec.kv.find(([x]) => x === k)?.[1] ?? def
  const lista = (k, def) => String(valor(k, def)).split(',').map(s => s.trim())
  const fvalor = (k, def) => fonts.find(([x]) => x === k)?.[1] ?? def

  // resuelve un recurso de la skin con variantes @2x; 1x1 = invisible a propósito
  const pedir = async (base) => {
    if (!base || /^blank/i.test(base)) return null
    for (const sufijo of ['', '@2x']) {
      const buf = abrir(base + sufijo + '.png')
      if (buf) {
        const img = await decodeImagen(buf, `skin:${base}${sufijo}`)
        if (img.w === 1 && img.h === 1) return null
        return { img, factor: sufijo === '@2x' ? 0.5 : 1 }
      }
    }
    return null
  }

  const skin = {
    ruta: rutaSkin,
    colW: lista('ColumnWidth', '30').map(Number),
    colStart: +valor('ColumnStart', 136),
    colLineW: lista('ColumnLineWidth', '1').map(Number),
    hitPos: +valor('HitPosition', 413),
    comboPos: +valor('ComboPosition', 110),
    juicioLinea: +valor('JudgementLine', 1) !== 0,
    teclasBajoNotas: +valor('KeysUnderNotes', 0) !== 0,
    colorLinea: lista('ColourLine', '255,255,255,255').map(Number),
    luzW: lista('LightingNWidth', '0').map(Number),
    notas: [], cabezas: [], cuerpos: [], colas: [], teclas: [], teclasD: [],
    luz: null, digitos: [], digitosCombo: [], dPunto: null, dComa: null, dPct: null,
    overlap: +fvalor('ScoreOverlap', 0),
    overlapCombo: +fvalor('ComboOverlap', 0),
  }
  for (let c = 0; c < keys; c++) {
    skin.notas.push(await pedir(valor(`NoteImage${c}`, '') || `mania-note${c + 1}`))
    skin.cabezas.push(await pedir(valor(`NoteImage${c}H`, '') || skin.notas[c] ? valor(`NoteImage${c}H`, '') : ''))
    skin.cuerpos.push(await pedir(valor(`NoteImage${c}L`, '')))
    skin.colas.push(await pedir(valor(`NoteImage${c}T`, '')))
    skin.teclas.push(await pedir(valor(`KeyImage${c}`, '')))
    skin.teclasD.push(await pedir(valor(`KeyImage${c}D`, '')))
  }
  skin.luz = await pedir(valor('LightingN', '') || 'lighting')
  const scorePrefix = fvalor('ScorePrefix', 'score')
  const comboPrefix = fvalor('ComboPrefix', 'combo')
  for (let d = 0; d <= 9; d++) {
    skin.digitos.push(await pedir(`${scorePrefix}-${d}`))
    skin.digitosCombo.push(await pedir(`${comboPrefix}-${d}`))
  }
  skin.dPunto = await pedir(`${scorePrefix}-dot`)
  skin.dComa = await pedir(`${scorePrefix}-comma`)
  skin.dPct = await pedir(`${scorePrefix}-percent`)
  const n2 = (arr) => arr.filter(Boolean).length
  log(`skin: ${path.basename(rutaSkin)} — notas ${n2(skin.notas)}/${keys}, receptores ${n2(skin.teclas)}/${keys}, dígitos ${n2(skin.digitos)}/10, combo ${n2(skin.digitosCombo)}/10, hitPos ${skin.hitPos}, ancho col ${skin.colW.join('/')}`)
  return skin
}

// ── avatar + rank del jugador (página de mania-tracker) ──────────────────────
async function conseguirJugador(nombre, keys) {
  const info = { nombre, avatar: null, rankGlobal: null, rankKeys: null, pais: '' }
  let html = null
  for (let intento = 0; intento < 2 && !html; intento++) {
    try { html = (await bajarABuffer(`${TRACKER}/player/${encodeURIComponent(nombre)}`, 20000)).toString('utf8') }
    catch (e) { if (intento === 1) log(`no pude conseguir la tarjeta del jugador (${e.message}); va sin avatar ni rank`) }
  }
  if (html) {
    try {
      const mAvatar = html.match(/avatar_url:"(https:\/\/a\.ppy\.sh\/[^"]+)"/) || html.match(/"avatar_url":"(https:\/\/a\.ppy\.sh\/[^"]+)"/)
      if (mAvatar) {
        try { info.avatar = await decodeImagen(await bajarABuffer(mAvatar[1], 20000), `avatar:${nombre}`) } catch { /* sin avatar */ }
      }
      for (const m of html.matchAll(/title="#([\d,]+) global\s*[•&][^"]*country"><span[^>]*>\s*(\d+)\s*k/gi)) {
        info[`rank${m[2]}k`] = +m[1].replace(/,/g, '')
      }
      const mGlobal = html.match(/Global<\/div><div[^>]*>#([\d,]+)/)
      if (mGlobal) info.rankGlobal = +mGlobal[1].replace(/,/g, '')
      const mPais = html.match(/"country_code":"([A-Z]{2})"/) || html.match(/countryCode:"([A-Z]{2})"/)
      if (mPais) info.pais = mPais[1]
      info.rankKeys = info[`rank${keys}k`] || null
      log(`jugador: ${nombre}${info.pais ? ' (' + info.pais + ')' : ''} — rank ${keys}K ${info.rankKeys ? '#' + info.rankKeys.toLocaleString('en-US') : 'n/d'}, global ${info.rankGlobal ? '#' + info.rankGlobal.toLocaleString('en-US') : 'n/d'}, avatar ${info.avatar ? 'sí' : 'no'}`)
    } catch (e) {
      log(`tarjeta del jugador incompleta (${e.message}); va con lo que haya`)
    }
  }
  return info
}

// ── 5) judge simplificado + calibración contra la cabecera del .osr ──────────
// Ventanas de osu!stable (ms): MAX 16 fijo; resto 34/67/97/121/158 + 3·(10−OD),
// × velocidad (DT 1.5, HT 0.75). Índices: 1=MAX 2=300 3=200 4=100 5=50 6=MISS.
function ventanas(od, mods) {
  const lista = mods || []
  let m = 1
  if (lista.includes('DT') || lista.includes('NC')) m *= 1.5
  if (lista.includes('HT')) m *= 0.75
  let eod = od
  if (lista.includes('HR')) eod = Math.min(10, od * 1.4)
  if (lista.includes('EZ')) eod = od * 0.75
  const base = (v) => Math.floor(v * m) + 0.5
  return {
    1: base(16),
    2: base(34 + 3 * (10 - eod)),
    3: base(67 + 3 * (10 - eod)),
    4: base(97 + 3 * (10 - eod)),
    5: base(121 + 3 * (10 - eod)),
    miss: base(158 + 3 * (10 - eod)),
  }
}


function juzgar(notas, eventos, pulsos, keys, od, mods, conteos, totalEsperado) {
  const w = ventanas(od, mods)
  // segmentos de pulsación por columna desde los cambios de máscara
  const segs = Array.from({ length: keys }, () => [])
  const activa = new Array(keys).fill(null)
  let maskActual = 0
  for (const ev of eventos) {
    for (let c = 0; c < keys; c++) {
      const antes = (maskActual >> c) & 1, ahora = (ev.mask >> c) & 1
      if (ahora && !antes) activa[c] = { inicio: ev.t }
      if (!ahora && antes && activa[c]) { segs[c].push({ inicio: activa[c].inicio, fin: ev.t }); activa[c] = null }
    }
    maskActual = ev.mask
  }
  for (let c = 0; c < keys; c++) if (activa[c]) segs[c].push({ inicio: activa[c].inicio, fin: Infinity })

  const juicios = [] // { t, col, j, dt } — dt solo en hits; 1=MAX..5=50, 6=miss
  const notasPorCol = Array.from({ length: keys }, () => [])
  for (const n of notas) notasPorCol[n.col].push(n)
  const nivel = (dt) => {
    // regla de stable (getStableHeadJudgmentForOffset de mania-hub): un press
    // TARDÍO más allá de la ventana "ok" es MISS, no 50; hacia el lado temprano
    // la ventana "meh" completa sí cuenta como 50
    if (dt > w[4]) return 6
    const a = Math.abs(dt)
    return a <= w[1] ? 1 : a <= w[2] ? 2 : a <= w[3] ? 3 : a <= w[4] ? 4 : 5
  }
  for (let c = 0; c < keys; c++) {
    let iSeg = 0
    for (const n of notasPorCol[c]) {
      while (iSeg < segs[c].length && segs[c][iSeg].fin !== Infinity && segs[c][iSeg].fin < n.t - w.miss - 5) iSeg++
      let mejor = null
      for (let i = iSeg; i < segs[c].length; i++) {
        const s = segs[c][i]
        if (s.inicio > n.t + w.miss + 5) break
        const dt = s.inicio - n.t
        if (dt >= -w[5] - 0.5 && dt <= w[5] + 0.5) {
          if (!mejor || Math.abs(dt) < Math.abs(mejor.dt)) mejor = { dt, seg: s }
        }
      }
      if (n.ln) {
        // stable combina LN en UN juicio: el release decide (y sobrescribe al
        // head — por eso la cabecera del .osr suma exactamente el nº de objetos)
        if (!mejor) {
          juicios.push({ t: n.t + w[5], col: c, j: 6, dt: null })
        } else {
          // soltar dentro de la cola = cola perfecta; soltar antes, por delta
          const dr = mejor.seg.fin >= n.fin ? 0 : mejor.seg.fin - n.fin
          const jt = dr >= -w[4] ? Math.min(nivel(mejor.dt), dr >= 0 ? 1 : nivel(dr)) : 6
          juicios.push({ t: Math.max(n.t + w[5], Math.min(mejor.seg.fin, n.fin + w[5])), col: c, j: jt, dt: mejor.dt })
        }
      } else if (!mejor) {
        juicios.push({ t: n.t + w[5], col: c, j: 6, dt: null })
      } else {
        juicios.push({ t: n.t + mejor.dt, col: c, j: nivel(mejor.dt), dt: mejor.dt })
      }
    }
  }
  juicios.sort((a, b) => a.t - b.t)

  // NOTA: el HUD en vivo usa la simulación CRUDA, igual que mania-hub para
  // replays de stable (su ReplayCanvas no reconcilia en stable; solo fija el
  // score al real). Los conteos REALES de la jugada son los de la cabecera.
  const final = {}
  for (let j = 1; j <= 6; j++) final[j] = juicios.reduce((n, e) => n + (e.j === j ? 1 : 0), 0)
  log(`HUD en vivo (judge, como el sitio): MAX ${final[1]} · 300 ${final[2]} · 200 ${final[3]} · 100 ${final[4]} · 50 ${final[5]} · miss ${final[6]}`)
  log(`conteos reales del .osr: MAX ${conteos.max} · 300 ${conteos.n300} · 200 ${conteos.n200} · 100 ${conteos.n100} · 50 ${conteos.n50} · miss ${conteos.miss}`)
  const totalJ = juicios.length
  if (totalJ !== totalEsperado) log(`  (aviso: ${totalJ} juicios vs ${totalEsperado} del mapa — LN con fin recortado o mapa raro)`)

  // prefijos para el HUD en vivo: acc, score V1 (fórmula de mania-hub), combo,
  // UR, L/R miss. unit = 500000/notas; el bonus counter va 0..100.
  const PESO = { 1: 300, 2: 300, 3: 200, 4: 100, 5: 50, 6: 0 }
  const VALOR = { 1: 320, 2: 300, 3: 200, 4: 100, 5: 50, 6: 0 }
  const BONO_VALOR = { 1: 32, 2: 32, 3: 16, 4: 8, 5: 4, 6: 0 }
  const BONO = { 1: 2, 2: 1, 3: 0, 4: 0, 5: 0 }
  const CASTIGO = { 1: 0, 2: 0, 3: 0, 4: 8, 5: 24 }
  const unit = totalJ > 0 ? 500000 / totalJ : 0
  let bonus = 100, raw = 0, peso = 0, n = 0, combo = 0
  let s1 = 0, s2 = 0
  let missL = 0, missR = 0
  const mitad = Math.ceil(keys / 2)
  const pref = []
  for (const e of juicios) {
    if (e.j === 6) {
      bonus = 0; combo = 0
      if (e.col < mitad) missL++; else missR++
    } else {
      bonus = Math.max(0, Math.min(100, bonus + BONO[e.j] - CASTIGO[e.j]))
      raw += unit * (VALOR[e.j] / 320) + unit * (BONO_VALOR[e.j] * Math.sqrt(bonus) / 320)
      peso += PESO[e.j]; n++; combo++
      s1 += e.dt; s2 += e.dt * e.dt
    }
    pref.push({
      t: e.t, score: raw, peso, n, combo, missL, missR,
      ur: n > 1 ? 10 * Math.sqrt(Math.max(0, s2 / n - (s1 / n) ** 2)) : 0,
    })
  }

  // pico de KPS por pulsación (prefijo, como buildReplayPeakKps de mania-hub)
  const pulsosOrd = [...pulsos].sort((a, b) => a - b)
  const peaks = new Uint32Array(pulsosOrd.length)
  { let ini = 0, pico = 0
    for (let fin = 0; fin < pulsosOrd.length; fin++) {
      const lim = pulsosOrd[fin] - 1000
      while (ini <= fin && pulsosOrd[ini] < lim) ini++
      pico = Math.max(pico, fin - ini + 1)
      peaks[fin] = pico
    } }

  return { juicios, pref, w, eventos, pulsosOrd, peaks, final }
}

// ── 6) sprites del HUD: píldoras, reloj, dígitos de la skin ──────────────────
function pilaRedonda(w, h, radio, color, alpha) {
  const img = nuevaImg(w, h)
  const [r, g, b] = Array.isArray(color) ? color : hex(color)
  const a = Math.round(alpha * 255)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x < radio ? radio - x : x >= w - radio ? x - (w - radio - 1) : 0
      const dy = y < radio ? radio - y : y >= h - radio ? y - (h - radio - 1) : 0
      if (dx * dx + dy * dy > radio * radio) continue
      const o = (y * w + x) * 4
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = a
    }
  }
  return img
}

function relojSprite(tam, color) {
  const img = nuevaImg(tam, tam)
  const [r, g, b] = hex(color)
  const c = tam / 2
  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      const dx = x - c + 0.5, dy = y - c + 0.5
      const d = Math.sqrt(dx * dx + dy * dy)
      let a = 0
      if (d <= c - 1 && d >= c - 2.5) a = 1
      else if (d <= c - 3 && d > c - 4.2 && (Math.abs(dx) < 1.2 || Math.abs(dy) < 1.2)) a = 0.9
      if (a <= 0) continue
      const o = (y * tam + x) * 4
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = a * 255
    }
  }
  return img
}

// número con los dígitos de la skin; si falta alguno, texto de mapa de bits
function pintarNumero(frame, skin, texto, x, y, escala, align = 'izq', color = '#ffffff') {
  const piezas = []
  for (const car of texto) {
    const d = car >= '0' && car <= '9' ? skin.digitos[+car]
      : car === '.' ? skin.dPunto : car === ',' ? skin.dComa : car === '%' ? skin.dPct : null
    if (!d) {
      textoAFrame(frame, texto, x, y + Math.round(2 * escala), Math.max(2, Math.round(escala * 1.6)), color, align)
      return
    }
    piezas.push(d)
  }
  const esc = piezas.map(p => escalar(p.img, Math.round(p.img.w * p.factor * escala), Math.round(p.img.h * p.factor * escala)))
  const ov = Math.round(skin.overlap * escala)
  let total = ov
  for (const e of esc) total += e.w - ov
  let px = align === 'der' ? Math.round(x - total) : align === 'centro' ? Math.round(x - total / 2) : Math.round(x)
  for (const e of esc) {
    fundir(frame, e, px, Math.round(y))
    px += e.w - ov
  }
}

function pintarCombo(frame, skin, texto, x, y, escala) {
  const piezas = []
  for (const car of texto) {
    const d = car >= '0' && car <= '9' ? skin.digitosCombo[+car] : null
    if (!d) { textoAFrame(frame, texto, x, y + Math.round(2 * escala), Math.max(3, Math.round(escala * 1.4)), '#ffffff', 'centro'); return }
    piezas.push(d)
  }
  const esc = piezas.map(p => escalar(p.img, Math.round(p.img.w * p.factor * escala), Math.round(p.img.h * p.factor * escala)))
  const ov = Math.round(skin.overlapCombo * escala)
  let total = ov
  for (const e of esc) total += e.w - ov
  let px = Math.round(x - total / 2)
  for (const e of esc) {
    fundir(frame, e, px, Math.round(y))
    px += e.w - ov
  }
}

// ── 7) render → ffmpeg ───────────────────────────────────────────────────────
const COLORES_NOTA = [
  [240, 98, 146], [126, 200, 240], [186, 220, 120], [255, 190, 100],
  [178, 132, 255], [120, 226, 214], [255, 140, 105], [156, 220, 255],
]

const bSearchT = (arr, t) => {
  let lo = 0, hi = arr.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (arr[mid].t <= t) lo = mid + 1; else hi = mid }
  return lo
}

function contarPulsos(arr, a, b) {
  let lo = 0, hi = arr.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (arr[mid] < a) lo = mid + 1; else hi = mid }
  const ini = lo
  lo = ini
  hi = arr.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (arr[mid] <= b) lo = mid + 1; else hi = mid }
  return lo - ini
}

function renderizar(notas, judge, skin, jugador, opts, audioPath, salida) {
  const { ancho: W, alto: H, fps } = opts
  const keys = opts.keys
  const esc = H / 720 // el HUD se diseña a 720 y escala
  const k = H / 480   // osu!pixels → pantalla
  const ventana = opts.ventana
  const t0 = opts.desde, t1 = opts.hasta
  const totalFrames = Math.max(1, Math.ceil((t1 - t0) / (1000 / fps)))

  // geometría del escenario
  const colWs = Array.from({ length: keys }, (_, c) => Math.max(24, Math.round((skin?.colW[Math.min(c, skin.colW.length - 1)] ?? 70) * k)))
  const pfW = colWs.reduce((a, b) => a + b, 0)
  const pfX = Math.floor((W - pfW) / 2)
  const colX = []
  { let acc = 0; for (let c = 0; c < keys; c++) { colX.push(acc); acc += colWs[c] } }
  const receptorY = Math.max(H * 0.40, Math.min(H * 0.94, (skin?.hitPos ?? 413) * k))
  const pxPorMs = receptorY / ventana

  const { juicios, pref, eventos, pulsosOrd, peaks } = judge
  const prefCnt = []
  { const a = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
    for (const e of juicios) { a[e.j]++; prefCnt.push({ ...a }) } }

  // score V1 reescalado para terminar EXACTO en el score real del .osr
  const scoreSim = pref.length ? pref[pref.length - 1].score : 0
  const escScore = opts.scoreFinal > 0 && scoreSim > 0 ? opts.scoreFinal / scoreSim : 1

  // recursos pre-horneados
  const fondo = opts.fondoImg
  const luzCol = skin?.luz ? Array.from({ length: keys }, (_, c) => {
    const frac = (skin.luzW[c] || 60) / (skin.colW[c] || 64)
    return escalar(skin.luz.img, Math.max(1, Math.round(colWs[c] * Math.min(1, frac))), receptorY)
  }) : null
  const escTecla = (p) => p ? escalar(p.img, colWs[0], Math.round(colWs[0] * p.img.h / p.img.w)) : null
  const receptorImg = escTecla(skin?.teclas[0])
  const receptorImgD = escTecla(skin?.teclasD[0]) || receptorImg
  const notaImg = [], cabezaImg = [], colaImg = []
  for (let c = 0; c < keys; c++) {
    const nota = skin?.notas[c] ?? null
    notaImg.push(nota ? escalar(nota.img, colWs[c], Math.round(colWs[c] * nota.img.h / nota.img.w)) : null)
    const cab = skin?.cabezas[c] ?? nota
    cabezaImg.push(cab ? escalar(cab.img, colWs[c], Math.round(colWs[c] * cab.img.h / cab.img.w)) : notaImg[c])
    const cola = skin?.colas[c] ?? null
    colaImg.push(cola ? escalar(cola.img, colWs[c], Math.round(colWs[c] * cola.img.h / cola.img.w)) : null)
  }
  const cuerpoBase = skin?.cuerpos.find(Boolean) || null
  const avatar = jugador?.avatar ? circulo(jugador.avatar, Math.round(46 * esc)) : null
  const reloj = relojSprite(Math.max(8, Math.round(30 * esc)), '#ffffff')
  const pilaKeys = pilaRedonda(Math.round(92 * esc), Math.round(27 * esc), Math.round(13 * esc), [255, 255, 255], 0.14)
  const pilaMs = pilaRedonda(Math.round(104 * esc), Math.round(27 * esc), Math.round(13 * esc), [255, 95, 160], 0.92)
  const cardBg = pilaRedonda(Math.round(236 * esc), Math.round(62 * esc), Math.round(10 * esc), [8, 9, 14], 0.55)

  const frame = { w: W, h: H, data: Buffer.allocUnsafe(W * H * 4) }

  // colores del panel (como la página de mania-tracker)
  const C = { max: '#e05fff', n300: '#6fb7ff', n200: '#7be36f', n100: '#5f8fff', n50: '#ffb44f', miss: '#ff4f5f', ur: '#9aa3ad', blanco: '#ffffff', gris: '#c8ccd4', pink: '#ff69b4', negro: '#0b0c12' }

  return new Promise((ok, mal) => {
    const ff = spawn('ffmpeg', [
      '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-video_size', `${W}x${H}`,
      '-framerate', String(fps), '-i', 'pipe:0',
      '-ss', (t0 / 1000).toFixed(3), '-i', audioPath,
      '-map', '0:v', '-map', '1:a',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart',
      salida,
    ], { stdio: ['pipe', 'inherit', 'inherit'] })
    ff.stdin.on('error', () => null) // EPIPE si ffmpeg muere: el 'close' reporta
    ff.on('error', mal)
    ff.on('close', (c) => c === 0 ? ok() : mal(new Error(`ffmpeg salió con código ${c}`)))

    // estado del render
    let frameN = 0, iNota = 0, iEv = 0, maskActual = 0
    const mascara = new Array(keys).fill(false)
    const brillo = new Array(keys).fill(0)
    const cacheCuerpos = new Map()

    const paso = async () => {
      while (frameN < totalFrames) {
        const t = t0 + frameN * (1000 / fps)
        // 1) fondo
        if (fondo) frame.data.set(fondo.data)
        else fundirRect(frame.data, W, 0, 0, W, H, 14, 14, 20, 1)
        // teclas de la replay → máscara + brillo
        while (iEv < eventos.length && eventos[iEv].t <= t) {
          const nueva = eventos[iEv].mask
          for (let c = 0; c < keys; c++) {
            const antes = (maskActual >> c) & 1, ahora = (nueva >> c) & 1
            if (ahora && !antes) { mascara[c] = true; brillo[c] = 1 }
            if (!ahora && antes) mascara[c] = false
          }
          maskActual = nueva
          iEv++
        }
        // 2) escenario
        fundirRect(frame.data, W, pfX, 0, pfW, H, 8, 9, 14, 0.90)
        if (luzCol) {
          for (let c = 0; c < keys; c++) {
            if (brillo[c] <= 0) continue
            fundir(frame, luzCol[c], pfX + colX[c], 0, 0.55 * brillo[c])
          }
        }
        const dibujarReceptores = () => {
          for (let c = 0; c < keys; c++) {
            const img = mascara[c] && receptorImgD ? receptorImgD : receptorImg
            if (img) fundir(frame, img, pfX + colX[c], receptorY - (img.h >> 1) + Math.round(4 * esc))
          }
        }
        if (skin?.teclasBajoNotas) dibujarReceptores()
        // 3) notas
        for (let i = iNota; i < notas.length; i++) {
          const n = notas[i]
          if (n.t - t > ventana + 200) break
          if (n.fin < t - 60) { if (i === iNota) iNota++; continue }
          const x0 = pfX + colX[n.col], cw = colWs[n.col]
          const [nr, ng, nb] = COLORES_NOTA[n.col % COLORES_NOTA.length]
          if (n.ln) {
            const yCabeza = receptorY - (n.t - t) * pxPorMs
            const yCola = receptorY - (n.fin - t) * pxPorMs
            const altoCuerpo = Math.max(1, Math.round(yCabeza - yCola))
            if (cuerpoBase) {
              const clave = `${n.col}x${cw}x${altoCuerpo}`
              let cuerpo = cacheCuerpos.get(clave)
              if (!cuerpo) {
                cuerpo = estirarVertical(escalar(cuerpoBase.img, cw, cuerpoBase.img.h), altoCuerpo)
                if (cacheCuerpos.size < 6000) cacheCuerpos.set(clave, cuerpo)
              }
              fundir(frame, cuerpo, x0, Math.round(yCola))
            } else {
              fundirRect(frame.data, W, x0 + (cw * 0.14 | 0), Math.max(0, Math.round(yCola)), Math.ceil(cw * 0.72), Math.min(Math.round(yCabeza), receptorY) - Math.max(0, Math.round(yCola)), nr * 0.55 | 0, ng * 0.55 | 0, nb * 0.55 | 0, 1)
            }
            const cab = cabezaImg[n.col]
            if (cab) {
              if (cab === notaImg[n.col] && !skin?.cabezas[n.col]) fundirRect(frame.data, W, x0 + 2, Math.min(Math.round(yCabeza) - 8, receptorY - 8), cw - 4, 8, nr, ng, nb, 1)
              else fundir(frame, cab, x0, Math.round(yCabeza - cab.h / 2))
            }
            const cola = colaImg[n.col]
            if (cola) fundir(frame, cola, x0, Math.round(yCola - cola.h / 2))
          } else {
            const yC = receptorY - (n.t - t) * pxPorMs
            const img = notaImg[n.col]
            if (img) fundir(frame, img, x0, Math.round(yC - img.h / 2))
            else fundirRect(frame.data, W, x0 + 2, Math.round(yC - cw * 0.3), cw - 4, Math.max(8, Math.round(cw * 0.3)), nr, ng, nb, 1)
          }
        }
        if (!skin?.teclasBajoNotas) dibujarReceptores()
        // línea de juicio + bordes del escenario
        if (!skin || skin.juicioLinea) {
          fundirRect(frame.data, W, pfX, receptorY, pfW, Math.max(2, Math.round(2 * esc)), skin?.colorLinea[0] ?? 255, skin?.colorLinea[1] ?? 255, skin?.colorLinea[2] ?? 255, 0.45)
        }
        fundirRect(frame.data, W, pfX - 1, 0, 1, H, 255, 255, 255, 0.08)
        fundirRect(frame.data, W, pfX + pfW, 0, 1, H, 255, 255, 255, 0.08)

        // ── HUD (estilo mania-tracker) ──
        if (!opts.sinHud) {
          const idx = bSearchT(pref, t)
          const p = idx > 0 ? pref[idx - 1] : { score: 0, peso: 0, n: 0, combo: 0, ur: 0, missL: 0, missR: 0 }
          const pc = idx > 0 ? prefCnt[idx - 1] : { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
          // score arriba-derecha
          const scoreTxt = String(Math.min(99999999, Math.round(p.score * escScore))).padStart(8, '0')
          pintarNumero(frame, skin, scoreTxt, W - Math.round(16 * esc), Math.round(16 * esc), 1.5 * esc, 'der')
          // acc arriba-izquierda: reloj + %
          fundir(frame, reloj, Math.round(16 * esc), Math.round(20 * esc))
          const acc = p.n ? (p.peso / (300 * p.n)) * 100 : 100
          pintarNumero(frame, skin, (acc >= 100 ? '100.00' : acc.toFixed(2)) + '%', Math.round(56 * esc), Math.round(24 * esc), 1.1 * esc, 'izq')
          // tarjeta del jugador (avatar + rank)
          if (cardBg) fundir(frame, cardBg, Math.round(16 * esc), Math.round(64 * esc))
          if (avatar) fundir(frame, avatar, Math.round(24 * esc), Math.round(72 * esc))
          const txX = Math.round(80 * esc)
          textoAFrame(frame, jugador.nombre.slice(0, 16), txX, Math.round(76 * esc), Math.max(2, Math.round(2 * esc)), C.blanco)
          const rankBits = []
          if (jugador.rankKeys) rankBits.push(`#${jugador.rankKeys.toLocaleString('en-US')} ${keys}K`)
          else if (jugador.rankGlobal) rankBits.push(`#${jugador.rankGlobal.toLocaleString('en-US')} GLOBAL`)
          else rankBits.push('RANK N/D')
          if (jugador.pais) rankBits.push(jugador.pais)
          textoAFrame(frame, rankBits.join(' · ').slice(0, 26), txX, Math.round(99 * esc), Math.max(1, Math.round(1.6 * esc)), C.gris)
          // panel derecho
          const filas = [
            ['MAX', pc[1], C.max], ['300', pc[2], C.n300], ['200', pc[3], C.n200],
            ['100', pc[4], C.n100], ['50', pc[5], C.n50], ['MISS', pc[6], C.miss],
          ]
          let fy = Math.round(112 * esc)
          const filaAlto = Math.round(33 * esc)
          for (const [etq, val, col] of filas) {
            textoAFrame(frame, etq, W - Math.round(152 * esc), fy + Math.round(7 * esc), Math.max(1, Math.round(1.8 * esc)), col)
            pintarNumero(frame, skin, String(val), W - Math.round(16 * esc), fy, 0.85 * esc, 'der')
            fy += filaAlto
          }
          textoAFrame(frame, 'UR', W - Math.round(152 * esc), fy + Math.round(7 * esc), Math.max(1, Math.round(1.8 * esc)), C.ur)
          pintarNumero(frame, skin, String(Math.round(p.ur)), W - Math.round(16 * esc), fy, 0.85 * esc, 'der')
          // L/R miss abajo-izquierda
          const yLR = H - Math.round(150 * esc)
          textoAFrame(frame, 'L MISS', Math.round(22 * esc), yLR, Math.max(1, Math.round(1.8 * esc)), C.blanco)
          pintarNumero(frame, skin, String(p.missL), Math.round(36 * esc), yLR + Math.round(24 * esc), 1.4 * esc, 'izq')
          textoAFrame(frame, 'R MISS', Math.round(112 * esc), yLR, Math.max(1, Math.round(1.8 * esc)), C.pink)
          pintarNumero(frame, skin, String(p.missR), Math.round(126 * esc), yLR + Math.round(24 * esc), 1.4 * esc, 'izq')
          // KPS + pico
          const kps = contarPulsos(pulsosOrd, t - 1000, t)
          const iPulso = (() => { let lo = 0, hi = pulsosOrd.length; while (lo < hi) { const m2 = (lo + hi) >>> 1; if (pulsosOrd[m2] <= t) lo = m2 + 1; else hi = m2 } return lo - 1 })()
          const picoKps = iPulso >= 0 ? peaks[iPulso] : 0
          textoAFrame(frame, 'KPS', Math.round(22 * esc), H - Math.round(212 * esc), Math.max(1, Math.round(1.6 * esc)), C.gris)
          pintarNumero(frame, skin, String(kps), Math.round(68 * esc), H - Math.round(216 * esc), 1.0 * esc, 'izq')
          textoAFrame(frame, `PICO ${picoKps}`, Math.round(112 * esc), H - Math.round(210 * esc), Math.max(1, Math.round(1.3 * esc)), C.gris)
          // combo centrado sobre las teclas
          const comboY = Math.max(Math.round(30 * esc), receptorY - Math.round(210 * k) - Math.round(24 * esc))
          pintarCombo(frame, skin, String(p.combo), pfX + pfW / 2, comboY, 1.15 * esc)
          // píldoras abajo-derecha: "N Keys" y velocidad "500.0ms"
          const bx = W - Math.round(16 * esc)
          fundir(frame, pilaKeys, bx - pilaKeys.w, H - Math.round(80 * esc))
          textoAFrame(frame, `${keys} Keys`, bx - pilaKeys.w / 2, H - Math.round(73 * esc), Math.max(1, Math.round(1.4 * esc)), C.blanco, 'centro')
          fundir(frame, pilaMs, bx - pilaMs.w, H - Math.round(46 * esc))
          textoAFrame(frame, `${ventana.toFixed(1)}ms`, bx - pilaMs.w / 2, H - Math.round(39 * esc), Math.max(1, Math.round(1.4 * esc)), C.negro, 'centro')
        }
        // dump de depuración (R2MP4_DUMP=número de frame)
        if (process.env.R2MP4_DUMP && +process.env.R2MP4_DUMP === frameN) {
          const ppm = Buffer.from(`P6\n${W} ${H}\n255\n`)
          const rgb = Buffer.allocUnsafe(W * H * 3)
          for (let q = 0; q < W * H; q++) { rgb[q * 3] = frame.data[q * 4]; rgb[q * 3 + 1] = frame.data[q * 4 + 1]; rgb[q * 3 + 2] = frame.data[q * 4 + 2] }
          fs.writeFileSync(`frame_${frameN}.ppm`, Buffer.concat([ppm, rgb]))
          console.error(`[dump] frame ${frameN} t=${Math.round(t)}ms`)
        }
        // contrapresión: esperar a que ffmpeg copie el frame antes de reusar
        await new Promise((bien) => ff.stdin.write(frame.data, bien))
        frameN++
        if (frameN % (fps * 10) === 0) {
          log(`  ${fmtDur(t - t0)} / ${fmtDur(t1 - t0)} renderizado (${Math.round(100 * frameN / totalFrames)}%)`)
          if (typeof opts.progreso === 'function') opts.progreso(frameN, totalFrames, t - t0, t1 - t0)
        }
      }
      ff.stdin.end()
    }
    paso().catch(mal)
  })
}

// ── orquestación ─────────────────────────────────────────────────────────────
async function bajarOsr(url) {
  try {
    return await bajarABuffer(url, 60000)
  } catch (e) {
    if (/\b404\b/.test(e.message)) throw new Error('mania-tracker/osu! no tiene archivo de replay para ese score (404): el score es muy viejo, fue fallado, o el id no existe')
    if (/\b502\b/.test(e.message)) throw new Error('no se pudo bajar la replay desde osu! ahora mismo (502) — reintenta en un rato')
    throw e
  }
}

async function conseguirOsr(argumento, dirTemp) {
  if (/^\d{4,}$/.test(argumento)) {
    log(`scoreId ${argumento} → pidiendo el .osr a mania-tracker…`)
    return bajarOsr(`${TRACKER}/api/replay-file?scoreId=${argumento}`)
  }
  if (fs.existsSync(argumento) && fs.statSync(argumento).size > 0) {
    log(`leyendo .osr local: ${argumento}`)
    return fs.readFileSync(argumento)
  }
  const u = new URL(argumento)
  const uploadId = u.searchParams.get('uploadId')
  const scoreId = u.searchParams.get('scoreId')
  if (uploadId) {
    log(`uploadId ${uploadId} → bajando el .osr de mania-tracker…`)
    return bajarOsr(`${TRACKER}/api/replay-upload?id=${encodeURIComponent(uploadId)}`)
  }
  if (scoreId) return conseguirOsr(scoreId, dirTemp)
  throw new Error('el enlace no trae uploadId ni scoreId (¿es de mania-tracker.com/replay?)')
}

function parsearArgs(argv) {
  const o = {
    fuente: null, salida: null, fps: 60, alto: 720, ventana: 500,
    desde: null, hasta: null, soloOsr: false, web: null, dirTemp: null,
    skin: null, sinHud: false, sinFondo: false, sinSkin: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--fps') o.fps = +argv[++i] || 60
    else if (a === '--alto') o.alto = +argv[++i] || 720
    else if (a === '--ventana') o.ventana = +argv[++i] || 500
    else if (a === '--desde') o.desde = (+argv[++i]) * 1000
    else if (a === '--hasta') o.hasta = (+argv[++i]) * 1000
    else if (a === '--salida') o.salida = argv[++i]
    else if (a === '--solo-osr') o.soloOsr = true
    else if (a === '--skin') o.skin = argv[++i]
    else if (a === '--sin-hud') o.sinHud = true
    else if (a === '--sin-fondo') o.sinFondo = true
    else if (a === '--sin-skin') o.sinSkin = true
    else if (a === '--web') o.web = +argv[i + 1] > 0 ? +argv[++i] : 8080
    else if (a === '--temp') o.dirTemp = argv[++i]
    else if (!o.fuente) o.fuente = a
  }
  return o
}

function saneaNombre(s) {
  return s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'replay'
}

async function pipeline(fuente, opts, progreso) {
  const dirTemp = opts.dirTemp || fs.mkdtempSync(path.join('/tmp', 'r2mp4-'))
  fs.mkdirSync(dirTemp, { recursive: true })
  const osrBuf = await conseguirOsr(fuente, dirTemp)
  const osrPath = path.join(dirTemp, 'replay.osr')
  fs.writeFileSync(osrPath, osrBuf)

  const replay = parsearOsr(osrBuf)
  log(`replay: ${replay.jugador} · mapa MD5 ${replay.beatmapMD5.slice(0, 12)}… · ${fmtDur(replay.finMs)} de juego · mods ${replay.listaMods.join(',') || 'NM'} · score ${replay.score}`)

  const destinoOsr = opts.salida ? opts.salida.replace(/\.mp4$/i, '') + '.osr' : saneaNombre(`${replay.jugador} - replay.osr`)
  fs.copyFileSync(osrPath, destinoOsr)
  log(`.osr completo guardado en: ${path.resolve(destinoOsr)}`)
  if (opts.soloOsr) return { osr: path.resolve(destinoOsr) }

  const info = await resolverMapa(replay.beatmapMD5)
  log(`mapa: beatmap ${info.beatmapId} (set ${info.setId}) · ${info.diff} · ${info.duracionS}s · maxCombo ${info.maxCombo ?? '?'}`)

  const mapaYAudio = await conseguirMapaYAudio(info, dirTemp)
  const { meta, notas } = parsearOsu(mapaYAudio.osuTexto)
  const od = meta.od || 8
  log(`notas: ${notas.length} en ${meta.keys}K · OD ${od} · primera a ${fmtDur(notas[0]?.t || 0)} · LN: ${notas.filter(n => n.ln).length}`)

  // skin + jugador (en paralelo con la decodificación del fondo)
  let skin = null
  const tareas = []
  if (opts.skin && !opts.sinSkin) tareas.push(cargarSkin(opts.skin, meta.keys).then(s => { skin = s }))
  let jugador = { nombre: replay.jugador, avatar: null, rankKeys: null, rankGlobal: null, pais: '' }
  tareas.push(conseguirJugador(replay.jugador, meta.keys).then(j => { jugador = j }))
  const fondoBuf = mapaYAudio.fondoBuf
  let fondoImg = null
  if (fondoBuf && !opts.sinFondo) {
    tareas.push((async () => {
      try {
        const bruta = await decodeImagen(fondoBuf, `bg:${info.setId}`)
        // difuminar en chico y escalar a cubrir con recorte centrado
        const mini = escalar(bruta, Math.max(160, Math.round(bruta.w / 3)), Math.max(90, Math.round(bruta.h / 3)))
        const dif = difuminar(mini, 6)
        const escCover = Math.max(opts.ancho / dif.w, opts.alto / dif.h)
        const fin = escalar(dif, Math.round(dif.w * escCover), Math.round(dif.h * escCover))
        const x0 = Math.floor((fin.w - opts.ancho) / 2), y0 = Math.floor((fin.h - opts.alto) / 2)
        const out = nuevaImg(opts.ancho, opts.alto)
        for (let y = 0; y < opts.alto; y++) {
          const sy = y0 + y
          fin.data.copy(out.data, y * opts.ancho * 4, (sy * fin.w + x0) * 4, (sy * fin.w + x0 + opts.ancho) * 4)
        }
        oscurecer(out, 0.38)
        fondoImg = out
        log('fondo del mapa aplicado (difuminado y oscurecido, como la página)')
      } catch (e) { log(`  fondo no usable (${e.message}); sigo con degradado`) }
    })())
  }
  await Promise.all(tareas)

  // judge + calibración (stable: cada objeto = 1 juicio, LN combinado)
  const totalEsperado = notas.length
  const judge = juzgar(notas, replay.eventos, replay.pulsos, meta.keys, od, replay.listaMods, replay.conteos, totalEsperado)

  const scoreSim = judge.pref.length ? judge.pref[judge.pref.length - 1].score : 0
  const scoreEscala = replay.score > 0 && scoreSim > 0 ? replay.score / scoreSim : 1
  log(`score: simulado ${Math.round(scoreSim)} → reescalado al real del .osr ${replay.score} (×${scoreEscala.toFixed(3)})`)

  const base = opts.salida || saneaNombre(`${replay.jugador} - ${meta.artista} - ${meta.titulo} [${meta.version}]`) + '.mp4'
  const desde = opts.desde ?? Math.max(0, (notas[0]?.t || 0) - 1200)
  const hasta = opts.hasta ?? Math.max(replay.finMs, (notas[notas.length - 1]?.fin || 0)) + 1200
  log(`renderizando ${fmtDur(hasta - desde)} a ${opts.fps}fps ${opts.ancho}x${opts.alto} → ${base}`)
  await renderizar(notas, judge, skin, jugador, {
    ...opts, keys: meta.keys, desde, hasta, progreso,
    fondoImg, scoreFinal: replay.score,
  }, mapaYAudio.audioPath, base)
  log(`✔ mp4 listo: ${path.resolve(base)}`)
  return { mp4: path.resolve(base), osr: path.resolve(destinoOsr) }
}

// ── modo web ─────────────────────────────────────────────────────────────────
function modoWeb(puerto) {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>replay2mp4</title>
<style>
body{background:#101018;color:#e8e8f0;font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px}
h1{font-size:1.4rem}input,button{font-size:1rem;padding:10px;border-radius:8px;border:1px solid #333}
input{width:100%;box-sizing:border-box;background:#1a1a26;color:#e8e8f0}
button{background:#7e6bff;border:0;color:#fff;cursor:pointer;margin-top:10px;width:100%}
pre{background:#0a0a12;padding:12px;border-radius:8px;white-space:pre-wrap;min-height:120px}
a{color:#9f8cff}
.fila{display:flex;gap:8px;margin-top:8px}.fila input{width:80px}
</style></head><body>
<h1>🎯 replay2mp4 — mania-tracker → mp4</h1>
<p>Pega el enlace de la replay (mania-tracker.com/replay?uploadId=… o ?scoreId=…) o un scoreId suelto. Si quieres tu skin, pon la ruta del .osk.</p>
<input id="link" placeholder="https://mania-tracker.com/replay?uploadId=…">
<input id="skin" placeholder="ruta de tu skin .osk (opcional)">
<div class="fila">
  <input id="fps" value="60" title="fps"> <input id="alto" value="720" title="alto px">
  <input id="ventana" value="500" title="ms de notas visibles">
</div>
<button onclick="mandar()">Renderizar</button>
<pre id="log">Listo. El primer render baja el mapa completo (.osz): puede tardar según tu conexión.
El render en sí depende de tu CPU: un mapa largo de 8 min tarda varios minutos.</pre>
<div id="fin"></div>
<script>
async function mandar(){
  const log=document.getElementById('log'); log.textContent=''; document.getElementById('fin').innerHTML='';
  const r=await fetch('/render',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({fuente:document.getElementById('link').value,
      skin:document.getElementById('skin').value||null,
      fps:+document.getElementById('fps').value||60, alto:+document.getElementById('alto').value||720,
      ventana:+document.getElementById('ventana').value||500})});
  const lector=r.body.getReader(); const dec=new TextDecoder();
  for(;;){const {done,value}=await lector.read(); if(done)break; log.textContent+=dec.decode(value); log.scrollTop=log.scrollHeight;}
  try{const j=JSON.parse(log.textContent.trim().split('\\n').pop());
    if(j.mp4) document.getElementById('fin').innerHTML='<p>✔ <a href="'+j.mp4+'">descargar el mp4</a></p>';
  }catch(e){}
}
</script></body></html>`
  let n = 0
  http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      return res.end(html)
    }
    if (req.method === 'POST' && req.url === '/render') {
      let cuerpo = ''
      req.on('data', (c) => cuerpo += c)
      req.on('end', async () => {
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
        const emitir = (t) => { res.write(t + '\n') }
        try {
          const { fuente, fps, alto, ventana, skin } = JSON.parse(cuerpo || '{}')
          if (!fuente) throw new Error('falta el enlace')
          const salida = path.resolve(`render_${++n}.mp4`)
          const altoFinal = +alto || 720
          const resultado = await pipeline(fuente, {
            fps: +fps || 60, alto: altoFinal,
            ancho: (altoFinal === 720 ? 1280 : altoFinal === 480 ? 854 : altoFinal === 1080 ? 1920 : Math.round(altoFinal * 16 / 9)) & ~1,
            ventana: +ventana || 500, skin: skin || null, salida,
          }, (f, tot, t, tt) => emitir(`  ${Math.round(100 * f / tot)}% — ${fmtDur(t)} / ${fmtDur(tt)}`))
          res.end(JSON.stringify(resultado))
        } catch (e) {
          emitir('✖ ' + e.message)
          res.end(JSON.stringify({ error: e.message }))
        }
      })
      return
    }
    if (req.method === 'GET' && /^\/render_\d+\.mp4$/.test(req.url)) {
      const p = path.resolve('.' + req.url)
      if (!fs.existsSync(p)) { res.writeHead(404); return res.end('aún no existe') }
      res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': fs.statSync(p).size })
      return fs.createReadStream(p).pipe(res)
    }
    res.writeHead(404); res.end('no encontrado')
  }).listen(puerto, () => log(`web local abierta en http://localhost:${puerto}`))
}

// ── main ─────────────────────────────────────────────────────────────────────
export const _interno = { parsearOsr, parsearOsu, juzgar, ventanas, resolverMapa, conseguirMapaYAudio, cargarSkin, conseguirJugador, pipeline, decodificarMods, renderizar }

const esMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (esMain) {
  const opts = parsearArgs(process.argv.slice(2))
  if (opts.web) { modoWeb(opts.web) } else {
  if (!opts.fuente) {
    console.log(`Uso: node replay2mp4.mjs <link|uploadId|scoreId|archivo.osr> [opciones]
  --fps N        fps del video (60)
  --alto N       alto en px (720 → 1280x720; 480 → 854x480; 1080 → 1920x1080)
  --ventana N    ms de notas visibles (500, como el default de mania-tracker)
  --skin RUTA    tu skin .osk o carpeta extraída (notas, receptores, dígitos)
  --sin-hud      sin score/acc/paneles (solo el escenario)
  --sin-fondo    sin el fondo del mapa difuminado
  --sin-skin     notas de colores planos, sin skin
  --desde S      recortar desde el segundo S
  --hasta S      recortar hasta el segundo S
  --solo-osr     solo bajar/guardar el .osr sin renderizar
  --temp RUTA    carpeta de caché para el .osz
  --web [puerto] mini página local (8080) para pegar el enlace`)
    process.exit(0)
  }
  opts.ancho = (opts.alto === 720 ? 1280 : opts.alto === 480 ? 854 : opts.alto === 1080 ? 1920 : Math.round(opts.alto * 16 / 9)) & ~1
  pipeline(opts.fuente, opts).catch(die)
}
}
