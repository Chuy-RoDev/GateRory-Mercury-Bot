// ═══════════════════════════════════════════════════════════════════
// LIB/ANTIBAN.JS — Capa anti-detección y anti-ban de Rory Mercury
// ═══════════════════════════════════════════════════════════════════
// Objetivos:
//  1) HUMANIZAR: que WhatsApp no vea el patrón típico de un bot.
//     - Los envíos de texto pasan por "typing..." (composing) con duración
//       proporcional al largo del mensaje, como una persona escribiendo.
//     - Todos los envíos salen espaciados con jitter aleatorio (nunca ráfagas
//       idénticas ni respuesta instantánea al milisegundo).
//  2) PROTEGER DE BAN:
//     - Rate limit por usuario+chat (cooldown + tope por minuto) para que un
//       spammer no use al bot como cañón de mensajes.
//     - Watchdog de reconexión: si la sesión cae en bucle (o por código fatal
//       401/403/405/440/411), NO martilla los servidores de WhatsApp; aplica
//       backoff creciente y pausas largas. Reintentos agresivos con una sesión
//       baneada son la receta clásica para que el número se pierda del todo.
//     - Aviso al owner con la causa exacta cuando la sesión vuelve a abrir.
//  3) SOBRECARGA:
//     - Vigila memoria y lag del event loop; si hay presión, avisa al owner,
//       ensancha temporalmente el espaciado de envíos y registra el evento.
//  4) CIRCUIT BREAKER de plugins: un plugin que crashea repetidamente entra en
//     cuarentena temporal en vez de machacar el proceso con errores.
//
// Diseño: 0 dependencias nuevas (Termux y Cloud Shell safe), auto-arranque sin
// tocar main.js (se envuelven global.reloadHandler y conn.sendMessage), y todo
// desactivable con global.antibanCfg.enabled = false o por variable.
// ═══════════════════════════════════════════════════════════════════

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Configuración (override posible desde config.js: global.antibanCfg) ──
const cfg = {
    enabled: true,
    // Rate limit por usuario
    cooldownMs: 2500,        // mínimo entre comando y comando del mismo usuario+chat
    maxPerMinute: 8,         // tope de comandos por minuto por usuario (luego castigo)
    burstPenaltyMs: 10000,   // cooldown de castigo al superar el tope
    // Humanización
    outboxMinMs: 350,        // espaciado mínimo entre envíos del bot
    outboxMaxMs: 900,        // espaciado máximo
    typingMinMs: 600,        // typing mínimo (aunque el texto sea corto)
    typingMaxMs: 2600,       // typing máximo
    typingPerCharMs: 26,     // ms por carácter de "escritura"
    // Watchdog de conexión
    backoffStepsMs: [1500, 3000, 6000, 12000, 30000, 60000],
    fatalWaitMs: 600000,     // 10 min tras código fatal (401/403/405/440/411)
    maxRetriesBeforeLongWait: 5,
    // Sobrecarga
    heapWarnMB: 450,
    loopLagWarnMs: 2500,
    // Circuit breaker de plugins
    pluginErrWindowMs: 60000,
    pluginErrMax: 5,
    pluginQuarantineMs: 120000,
    ...(global.antibanCfg || {}),
}

const FATAL_CODES = new Set([401, 403, 405, 440, 411])
const STATE_FILE = path.join(__dirname, '..', 'src', 'json', 'antiban-state.json')

// ── Utilidades ───────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms))
const jitter = (min, max) => Math.floor(min + Math.random() * Math.max(1, max - min))
const num = (v, d) => (typeof v === 'number' && !isNaN(v) && v >= 0) ? v : d

const state = {
    // reconexiones
    lastOpenAt: 0,
    failedReconnects: 0,
    lastCloseCode: 0,
    lastCloseAt: 0,
    lastCloseReason: '',
    notifiedOwnerAbout: '',   // dedupe de avisos
    // sobrecarga
    preservedUntil: 0,
    lastLoadWarnAt: 0,
    // breaker de plugins
    pluginErrors: new Map(),  // name -> [{t}]
    quarantined: new Map(),   // name -> untilTs
}

function persistState() {
    try {
        fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
        fs.writeFileSync(STATE_FILE, JSON.stringify({
            lastCloseCode: state.lastCloseCode,
            lastCloseAt: state.lastCloseAt,
            lastCloseReason: state.lastCloseReason,
            failedReconnects: state.failedReconnects,
            savedAt: new Date().toISOString(),
        }, null, 2))
    } catch { /* sin disco: seguimos igual */ }
}

function loadPersisted() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const d = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'))
            if (d && typeof d === 'object') {
                state.lastCloseCode = d.lastCloseCode | 0
                state.lastCloseAt = d.lastCloseAt | 0
                state.lastCloseReason = String(d.lastCloseReason || '')
                state.failedReconnects = d.failedReconnects | 0
            }
        }
    } catch { }
}
loadPersisted()

// ── 1) RATE LIMITER por usuario+chat ─────────────────────────────────
const lastCmd = new Map()   // key -> {t, hits, windowStart}
setInterval(() => { // limpieza anti-fuga de memoria
    const cutoff = Date.now() - 120000
    for (const [k, v] of lastCmd) if (v.t < cutoff) lastCmd.delete(k)
}, 120000).unref?.()

function checkCommand(m, ctx = {}) {
    if (!cfg.enabled) return { ok: true }
    // owners y premium nunca limitados (confianza y soporte operativo)
    if (ctx.isROwner || ctx.isPrems) return { ok: true }
    const key = `${m.chat || ''}|${m.sender || ''}`
    const now = Date.now()
    let e = lastCmd.get(key)
    if (!e) { e = { t: 0, hits: 0, windowStart: now }; lastCmd.set(key, e) }
    if (now - e.windowStart > 60000) { e.windowStart = now; e.hits = 0 }
    e.hits++
    const since = now - e.t
    if (e.hits > num(cfg.maxPerMinute, 8)) {
        e.t = now + num(cfg.burstPenaltyMs, 10000) - num(cfg.cooldownMs, 2500)
        return { ok: false, reason: 'burst', retryAfterMs: num(cfg.burstPenaltyMs, 10000) }
    }
    const need = num(cfg.cooldownMs, 2500)
    if (since < need) {
        return { ok: false, reason: 'cooldown', retryAfterMs: need - since }
    }
    e.t = now
    return { ok: true }
}

// ── 2) OUTBOX humanizada (espaciado global de envíos) ────────────────
let outboxTail = Promise.resolve()
function outboxSlot(minMs, maxMs) {
    const wait = jitter(num(minMs, cfg.outboxMinMs), num(maxMs, cfg.outboxMaxMs) + 1)
    const run = outboxTail.then(() => sleep(state.preservedUntil > Date.now() ? wait * 2 : wait))
    // la cola nunca se rompe: si un envío falla, el slot igual se completa
    outboxTail = run.catch(() => { })
    return run
}

// ── 3) TYPING humano antes de enviar texto ───────────────────────────
const typingUntil = new Map() // chat -> ts hasta el que ya estamos "escribiendo"
async function humanTyping(conn, chat, text) {
    if (!cfg.enabled || !conn || typeof conn.sendPresenceUpdate !== 'function') return
    if (typeof chat !== 'string' || chat.endsWith('@newsletter') || chat === 'status@broadcast') return
    const len = Math.min(String(text || '').length, 4000)
    let dur = num(cfg.typingPerCharMs, 26) * len
    dur = Math.max(num(cfg.typingMinMs, 600), Math.min(num(cfg.typingMaxMs, 2600), dur))
    const now = Date.now()
    if ((typingUntil.get(chat) || 0) > now) { // ya estamos escribiendo para este chat
        const rest = typingUntil.get(chat) - now
        typingUntil.set(chat, Date.now() + rest + jitter(100, 400))
        await sleep(Math.min(rest, 3000))
        return
    }
    typingUntil.set(chat, now + dur)
    try {
        await conn.sendPresenceUpdate('composing', chat)
        await sleep(dur)
        await conn.sendPresenceUpdate('paused', chat)
    } catch { /* si el presence falla, el envío sigue normal */ }
}

// ── 4) WRAP del socket: un solo punto por donde sale TODO ────────────
function wrapSocket(conn) {
    if (!cfg.enabled || !conn || conn.__antibanWrapped) return conn
    const origSend = conn.sendMessage?.bind(conn)
    if (typeof origSend !== 'function') return conn

    conn.sendMessage = async function antibanSend(jid, content, options) {
        // reacciones, borrados y ediciones: pasan casi al instante con jitter corto
        if (content && (content.react || content.delete)) {
            await sleep(jitter(60, 250))
            return origSend(jid, content, options)
        }
        // texto normal: typing humano + slot de espaciado
        if (typeof content?.text === 'string' && content.text) {
            await humanTyping(this, jid, content.text)
            await outboxSlot()
            return origSend(jid, content, options)
        }
        // media/otros: solo espaciado (el upload ya tarda lo suyo)
        await outboxSlot()
        return origSend(jid, content, options)
    }
    conn.__antibanWrapped = true
    return conn
}

// ── 5) WATCHDOG de conexión: reconexión inteligente sin martillear ───
function installWatchdog(conn) {
    if (!conn || conn.__antibanWd) return
    conn.__antibanWd = true
    conn.ev?.on?.('connection.update', async (u) => {
        try {
            const { connection, lastDisconnect } = u || {}
            const code = lastDisconnect?.error?.output?.statusCode
                || lastDisconnect?.error?.output?.payload?.statusCode || 0
            if (connection === 'open') {
                state.lastOpenAt = Date.now()
                state.failedReconnects = 0
                if (state.lastCloseCode && FATAL_CODES.has(state.lastCloseCode)) {
                    await notifyOwner(conn,
                        `⚠️ *Sesión reestablecida tras cierre crítico*\n\n` +
                        `» Código: ${state.lastCloseCode}\n` +
                        `» Causa: ${state.lastCloseReason || 'desconocida'}\n` +
                        `» Hora: ${new Date(state.lastCloseAt).toLocaleString()}\n\n` +
                        (state.lastCloseCode === 403
                            ? `🚨 403 suele indicar que WhatsApp *limitó o baneó* el número. Revisa tu correo y wa.me/support antes de reusar este número.\n`
                            : `🛡️ El bot ya NO reconecta en bucle con sesiones muertas (evita baneos).\n`) +
                        `\n_Protector anti-ban activo._`)
                    state.lastCloseCode = 0
                    persistState()
                }
            } else if (connection === 'close') {
                state.lastCloseCode = code || state.lastCloseCode
                state.lastCloseAt = Date.now()
                state.lastCloseReason = lastDisconnect?.error?.message || String(lastDisconnect?.error || '').slice(0, 120)
                persistState()
                console.error(`[ANTIBAN] Cierre de sesión (código ${code || '?'}) — ${state.lastCloseReason}`)
            }
        } catch { /* el watchdog jamás debe tumbar la conexión */ }
    })
}

let reloadWrapped = false
function wrapReloadHandler() {
    if (reloadWrapped || typeof global.reloadHandler !== 'function') return
    const orig = global.reloadHandler
    reloadWrapped = true
    global.reloadHandler = async function antibanReload(restatConn) {
        // solo aplicamos política en reconexiones tras un cierre de sesión
        if (restatConn && cfg.enabled && state.lastOpenAt && Date.now() - state.lastOpenAt > 1500) {
            const fatal = FATAL_CODES.has(state.lastCloseCode) && Date.now() - state.lastCloseAt < 3600000
            state.failedReconnects++
            let wait
            if (fatal) {
                wait = num(cfg.fatalWaitMs, 600000)
                console.error(`[ANTIBAN] Código fatal ${state.lastCloseCode}: esperando ${(wait / 60000).toFixed(0)} min antes de reintentar (no martillar servidores con sesión posiblemente baneada).`)
            } else if (state.failedReconnects > num(cfg.maxRetriesBeforeLongWait, 5)) {
                wait = num(cfg.fatalWaitMs, 600000)
                console.error(`[ANTIBAN] ${state.failedReconnects} reconexiones fallidas seguidas: pausa larga de ${(wait / 60000).toFixed(0)} min.`)
            } else {
                const steps = cfg.backoffStepsMs
                wait = steps[Math.min(state.failedReconnects - 1, steps.length - 1)] || 60000
            }
            if (wait > 0) await sleep(wait)
        }
        const r = await orig.call(this, restatConn)
        try {
            installWatchdog(global.conn)
        } catch { }
        return r
    }
}

// ── 6) Aviso al owner (una vez por causa) ────────────────────────────
async function notifyOwner(conn, text) {
    try {
        const ownerJid = String(global.owner?.[0] || '').replace(/[^0-9]/g, '') + '@s.whatsapp.net'
        if (!ownerJid || ownerJid === '@s.whatsapp.net') return
        const sig = text.slice(0, 60)
        if (state.notifiedOwnerAbout === sig && Date.now() - state.lastOpenAt < 3600000) return
        state.notifiedOwnerAbout = sig
        await conn.sendMessage(ownerJid, { text })
    } catch (e) {
        console.error('[ANTIBAN] No pude avisar al owner:', e?.message || e)
    }
}

// ── 7) Vigilante de sobrecarga (memoria + event loop) ────────────────
function startLoadWatchdog() {
    let last = Date.now()
    setInterval(() => {
        try {
            const now = Date.now()
            const lag = now - last - 5000
            last = now
            const heapMB = (process.memoryUsage().heapUsed / 1048576) | 0
            const over = heapMB > num(cfg.heapWarnMB, 450) || lag > num(cfg.loopLagWarnMs, 2500)
            if (over) {
                state.preservedUntil = Date.now() + 5 * 60000 // modo preservación: envíos más espaciados 5 min
                if (Date.now() - state.lastLoadWarnAt > 3600000) { // aviso máx 1/hora
                    state.lastLoadWarnAt = Date.now()
                    console.warn(`[ANTIBAN] SOBRECARGA: heap ${heapMB}MB, lag ${lag}ms — espaciando envíos para no disparar filtros de WhatsApp.`)
                    const conn = global.conn
                    if (conn?.user) notifyOwner(conn,
                        `🩺 *Sobrecarga detectada*\n\n» RAM: ${heapMB} MB\n» Lag: ${lag} ms\n\n🛡️ Activé modo preservación: envíos más espaciados durante 5 min para evitar detección/ban. Si se repite mucho, revisa plugins que descargan archivos grandes.`)
                }
            }
        } catch { }
    }, 5000).unref?.()
}

// ── 8) Circuit breaker de plugins ────────────────────────────────────
function reportCommandResult(name, err) {
    if (!err) return
    const now = Date.now()
    let arr = state.pluginErrors.get(name) || []
    arr = arr.filter(t => now - t < num(cfg.pluginErrWindowMs, 60000))
    arr.push(now)
    state.pluginErrors.set(name, arr)
    if (arr.length >= num(cfg.pluginErrMax, 5)) {
        state.quarantined.set(name, now + num(cfg.pluginQuarantineMs, 120000))
        state.pluginErrors.set(name, [])
        console.error(`[ANTIBAN] Plugin "${name}" en CUARENTENA ${num(cfg.pluginQuarantineMs, 120000) / 1000}s: ${arr.length} errores seguidos.`)
        const conn = global.conn
        if (conn?.user) notifyOwner(conn, `🔒 *Plugin en cuarentena*\n\n» Plugin: ${name}\n» Errores: ${arr.length} en ${num(cfg.pluginErrWindowMs, 60000) / 1000}s\n\n🛡️ Lo desactivé temporalmente para proteger el bot. Revisa su código si el problema persiste.`)
    }
}
function isQuarantined(name) {
    const until = state.quarantined.get(name) || 0
    if (until > Date.now()) return true
    if (until) state.quarantined.delete(name)
    return false
}

// ── Arranque autocontenido (sin tocar main.js) ───────────────────────
function start() {
    if (global.__antibanStarted) return
    global.__antibanStarted = true
    if (!cfg.enabled) {
        console.log('[ANTIBAN] desactivado por configuración')
        return
    }
    startLoadWatchdog()
    // envolver reloadHandler en cuanto exista (main.js lo define)
    if (typeof global.reloadHandler === 'function') wrapReloadHandler()
    else {
        const iv = setInterval(() => {
            if (typeof global.reloadHandler === 'function') {
                clearInterval(iv)
                wrapReloadHandler()
            }
        }, 300)
        iv.unref?.()
    }
    console.log('[ANTIBAN] Protector anti-ban activo: typing humano, espaciado de envíos, rate limit, watchdog de reconexión y breaker de plugins.')
}

const api = {
    cfg,
    state,
    checkCommand,
    wrapSocket,
    humanTyping,
    reportCommandResult,
    isQuarantined,
    notifyOwner,
    start,
    // helpers de test
    __reset: () => { lastCmd.clear(); state.pluginErrors.clear(); state.quarantined.clear(); state.failedReconnects = 0; state.lastOpenAt = 0 },
}
global.__antiban = api
start()

export default api
export { checkCommand, wrapSocket, humanTyping, reportCommandResult, isQuarantined, notifyOwner, cfg }
