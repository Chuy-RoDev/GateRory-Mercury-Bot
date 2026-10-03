import { promises as fs } from 'fs'
import fetch from 'node-fetch'
import axios from 'axios'
import crypto from 'crypto'

// ═══════════════════════════════════════════════════════════════
// CONFIG CENTRALIZADA
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
    FILE_PATH: './src/json/characters.json',
    BACKUP_DIR: './src/json/backups',
    CACHE_FILE: './src/json/.gacha_cache3.json',
    MAX_IMG_POR_PERSONAJE: 20,
    DELAY_MS: 1200,
    TIMEOUT_API: 8000,
    MAX_REINTENTOS: 3,
    DELAY_REINTENTO: 2000,
    CONCURRENT_REQUESTS: 2,
    MIN_SAFE_IMAGES: 3,
    MIN_R34_IMAGES: 5,
    MIN_PINTEREST_IMAGES: 12,
    VALIDAR_URLS: true,
    CREAR_BACKUP: true,
    USE_CACHE: true,
    CACHE_EXPIRY_HOURS: 24,
    LOG_LEVEL: 'info', // 'debug' | 'info' | 'warn' | 'error'
    SOLO_NUEVOS: true,   // salta el refresco de existentes (solo agrega)
}

// ═══════════════════════════════════════════════════════════════
// LOGGER MEJORADO
// ═══════════════════════════════════════════════════════════════
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
const LOG_COLORS = {
    debug: '\x1b[36m',    // Cyan
    info: '\x1b[32m',     // Green
    warn: '\x1b[33m',     // Yellow
    error: '\x1b[31m',    // Red
    reset: '\x1b[0m'
}

const logger = {
    log(level, msg, data = '') {
        if (LEVELS[level] >= LEVELS[CONFIG.LOG_LEVEL]) {
            const color = LOG_COLORS[level]
            const icon = { debug: '🔧', info: '✓', warn: '⚠', error: '✗' }[level]
            const time = new Date().toLocaleTimeString()
            console.log(`${color}[${time}] ${icon} ${msg}${data}${LOG_COLORS.reset}`)
        }
    },
    debug: (msg, data) => logger.log('debug', msg, data),
    info: (msg, data) => logger.log('info', msg, data),
    warn: (msg, data) => logger.log('warn', msg, data),
    error: (msg, data) => logger.log('error', msg, data)
}

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE CACHE
// ═══════════════════════════════════════════════════════════════
class CacheManager {
    constructor() {
        this.cache = {}
        this.timestamps = {}
    }

    async cargar() {
        try {
            const data = await fs.readFile(CONFIG.CACHE_FILE, 'utf-8')
            const cached = JSON.parse(data)
            this.cache = cached.data || {}
            this.timestamps = cached.timestamps || {}
            logger.info(`Cache cargado con ${Object.keys(this.cache).length} entradas`)
        } catch {
            logger.debug('No hay cache previo, comenzando fresco')
        }
    }

    async guardar() {
        try {
            await fs.writeFile(CONFIG.CACHE_FILE, JSON.stringify({ data: this.cache, timestamps: this.timestamps }, null, 2))
        } catch (e) {
            logger.warn('No se pudo guardar cache:', e.message)
        }
    }

    obtener(key) {
        if (!CONFIG.USE_CACHE) return null
        const timestamp = this.timestamps[key]
        const now = Date.now()
        if (timestamp && (now - timestamp) < CONFIG.CACHE_EXPIRY_HOURS * 3600 * 1000) {
            const valor = this.cache[key]
            // No servir resultados vacíos cacheados (de corridas viejas con tags malos)
            if (Array.isArray(valor) && valor.length === 0) return null
            return valor
        }
        return null
    }

    establecer(key, value) {
        this.cache[key] = value
        this.timestamps[key] = Date.now()
    }

    limpiar() {
        this.cache = {}
        this.timestamps = {}
    }
}

// ═══════════════════════════════════════════════════════════════
// VALIDADOR DE URLs
// ═══════════════════════════════════════════════════════════════
class URLValidator {
    constructor() {
        this.validadas = new Map()
    }

    async validar(url, timeout = 5000) {
        if (!CONFIG.VALIDAR_URLS) return true
        if (this.validadas.has(url)) return this.validadas.get(url)

        try {
            const res = await fetch(url, { method: 'HEAD', timeout })
            const valida = res.status === 200 || res.status === 304
            this.validadas.set(url, valida)
            return valida
        } catch {
            this.validadas.set(url, false)
            return false
        }
    }

    async filtrarValidas(urls) {
        const resultados = await Promise.all(urls.map(async u => ({
            url: u,
            valida: await this.validar(u, 4000)
        })))
        return resultados.filter(r => r.valida).map(r => r.url)
    }
}

// ═══════════════════════════════════════════════════════════════
// RETRY LOGIC CON BACKOFF
// ═══════════════════════════════════════════════════════════════
async function conReintentos(fn, maxIntentos = CONFIG.MAX_REINTENTOS) {
    for (let i = 0; i < maxIntentos; i++) {
        try {
            return await fn()
        } catch (err) {
            if (i === maxIntentos - 1) throw err
            const delay = CONFIG.DELAY_REINTENTO * Math.pow(2, i)
            logger.debug(`Reintentando en ${delay}ms...`)
            await new Promise(r => setTimeout(r, delay))
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// GENERADOR DE CANDIDATOS DE TAG (compartido por todos los boorus)
// ═══════════════════════════════════════════════════════════════
// Los boorus etiquetan personajes como "personaje_(serie)" usando el
// título OFICIAL de la serie, que a veces lleva puntuación:
//   kafka + "Honkai Star Rail" →
//     kafka_(honkai:_star_rail)  ← la variante con ':' es la real
// Esta función genera candidatos en orden de probabilidad:
//   1. El tag curado tal cual llegó (si ya trae paréntesis)
//   2. personaje_(titulo_oficial_con_puntuacion)
//   3. personaje_(serie_normalizada)
//   4. personaje_(serie_con_:_insertado)
//   5. personaje suelto (último recurso)
function generarCandidatosTag(name, serieTag, serieName) {
    const base = name.replace(/\(.*\)/g, '').replace(/_+/g, '_').replace(/_$/, '').trim()
    if (!base) return [name]

    const norm = (serieTag || '').toLowerCase()
    // Conserva ':' y "'" del título oficial: "Honkai: Star Rail" → honkai:_star_rail
    const punct = (serieName || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_:'-]/g, '')
    // Variante insertando ':' tras la primera palabra
    const colon = norm.includes(':') ? norm : norm.replace('_', ':')

    const conSerie = []
    if (punct) conSerie.push(`${base}_(${punct})`)
    if (norm && norm !== punct) conSerie.push(`${base}_(${norm})`)
    if (colon && colon !== norm && colon !== punct) conSerie.push(`${base}_(${colon})`)

    // Si el tag curado ya trae paréntesis (series manuales), va primero
    if (name.includes('(')) {
        return [...new Set([name, ...conSerie, base])].slice(0, 5)
    }
    // Si no, primero las variantes con serie y el nombre suelto al final
    return [...new Set([...conSerie, base, name])].slice(0, 5)
}

// ═══════════════════════════════════════════════════════════════
// BÚSQUEDA DE IMÁGENES — DANBOORU (con candidatos)
// ═══════════════════════════════════════════════════════════════
async function fetchDanbooru(name, serieTag, serieName, cache, validator) {
    const cacheKey = `danbooru_${name}_${serieTag}`
    const cached = cache.obtener(cacheKey)
    if (cached) return cached

    const candidatos = generarCandidatosTag(name, serieTag, serieName)
    logger.debug(`Danbooru candidatos para "${name}": ${candidatos.join(' | ')}`)

    for (const tag of candidatos) {
        try {
            const urls = await conReintentos(async () => {
                const url = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tag)}&limit=10`
                const res = await fetch(url, { timeout: CONFIG.TIMEOUT_API })
                if (!res.ok) throw new Error(`HTTP ${res.status}`)  // sí reintentar
                const text = await res.text()
                if (!text.trim()) return []
                const data = JSON.parse(text)
                if (Array.isArray(data) && data.length > 0) {
                    return data.slice(0, 3)
                        .map(p => p.file_url || p.large_file_url)
                        .filter(u => u && /\.(jpe?g|png|gif|webp)$/i.test(u))
                }
                return []
            })
            if (urls.length > 0) {
                logger.debug(`Danbooru "${tag}" → ${urls.length} imgs`)
                cache.establecer(cacheKey, urls)
                return urls
            }
        } catch (err) {
            logger.debug(`Danbooru error para "${tag}": ${err.message}`)
        }
        await new Promise(r => setTimeout(r, 250))
    }
    return []
}

// ═══════════════════════════════════════════════════════════════
// BÚSQUEDA DE IMÁGENES — SAFEBOORU (con candidatos)
// ═══════════════════════════════════════════════════════════════
async function fetchSafebooru(name, serieTag, serieName, cache, validator) {
    const cacheKey = `safebooru_${name}_${serieTag}`
    const cached = cache.obtener(cacheKey)
    if (cached) return cached

    const candidatos = generarCandidatosTag(name, serieTag, serieName)
    logger.debug(`Safebooru candidatos para "${name}": ${candidatos.join(' | ')}`)

    for (const tag of candidatos) {
        try {
            const urls = await conReintentos(async () => {
                const url = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tag)}&limit=5`
                const res = await fetch(url, { timeout: CONFIG.TIMEOUT_API })
                if (!res.ok) throw new Error(`HTTP ${res.status}`)  // sí reintentar
                const text = await res.text()
                if (!text.trim()) return []  // body vacío = 0 resultados

                // Safebooru (DAPI) puede responder XML aunque pidas json=1
                let posts = []
                if (text.trim().startsWith('<')) {
                    let m
                    const re = /<post\b([^>]*?)\/?>/g
                    while ((m = re.exec(text)) !== null) posts.push(m[1])
                } else {
                    const data = JSON.parse(text)
                    posts = Array.isArray(data) ? data : []
                }

                return posts.slice(0, 3).map(p => {
                    if (typeof p === 'string') {
                        const d = p.match(/\bdirectory="([^"]*)"/)?.[1]
                        const i = p.match(/\bimage="([^"]*)"/)?.[1]
                        const id = p.match(/\bid="([^"]*)"/)?.[1]
                        return d && i ? `https://safebooru.org//images/${d}/${i}${id ? '?' + id : ''}` : null
                    }
                    return p.directory && p.image ? `https://safebooru.org//images/${p.directory}/${p.image}?${p.id}` : null
                }).filter(Boolean)
            })
            if (urls.length > 0) {
                logger.debug(`Safebooru "${tag}" → ${urls.length} imgs`)
                cache.establecer(cacheKey, urls)
                return urls
            }
        } catch (err) {
            logger.debug(`Safebooru error para "${tag}": ${err.message}`)
        }
        await new Promise(r => setTimeout(r, 250))
    }
    return []
}

// ═══════════════════════════════════════════════════════════════
// RULE34 — resolución de tags por candidatos
// ═══════════════════════════════════════════════════════════════
const R34_API_KEY = "a4e807dd6d4c9e55768772996946e4074030ec02c49049d291e5edb8808a97b004190660b4b36c3d21699144c823ad93491d066e73682a632a38f9b6c3cf951b"
const R34_USER_ID = "5753302"
const R34_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Accept': 'application/json'
}

async function fetchRule34(name, serieTag, serieName, cache, validator) {
    const cacheKey = `rule34_${name}_${serieTag}`
    const cached = cache.obtener(cacheKey)
    if (cached) return cached

    const candidatos = generarCandidatosTag(name, serieTag, serieName)
    logger.debug(`R34 candidatos para "${name}": ${candidatos.join(' | ')}`)

    let acumuladas = []

    for (const tag of candidatos) {
        if (acumuladas.length >= CONFIG.MIN_R34_IMAGES) break
        try {
            const urls = await conReintentos(async () => {
                const url = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&limit=600&tags=${encodeURIComponent(tag)}&api_key=${R34_API_KEY}&user_id=${R34_USER_ID}`
                const res = await fetch(url, {
                    timeout: CONFIG.TIMEOUT_API,
                    headers: R34_HEADERS
                })
                if (!res.ok) throw new Error(`HTTP ${res.status}`)  // sí reintentar
                const text = await res.text()
                if (!text.trim()) return []  // body vacío = 0 resultados, no es error

                let posts = []
                if (text.trim().startsWith('<')) {
                    // R34 devuelve XML incluso con json=1 cuando no hay resultados
                    let m
                    const re = /<post\b([^>]*?)\/?>/g
                    while ((m = re.exec(text)) !== null) {
                        const u = m[1].match(/\bfile_url="([^"]*)"/)?.[1]
                            || m[1].match(/\bsample_url="([^"]*)"/)?.[1]
                            || m[1].match(/\bpreview_url="([^"]*)"/)?.[1]
                        if (u) posts.push(u)
                    }
                } else {
                    const json = JSON.parse(text)
                    posts = Array.isArray(json) ? json : json?.post || json?.data || []
                    posts = posts.map(p => p.file_url || p.sample_url || p.preview_url)
                }
                return posts.filter(u => u && /\.(jpe?g|png|gif|webp)$/i.test(u))
            })
            acumuladas = [...new Set([...acumuladas, ...urls])]
            if (urls.length > 0) logger.debug(`R34 "${tag}" → ${urls.length} imgs`)
        } catch (err) {
            logger.debug(`Rule34 error para "${tag}": ${err.message}`)
            continue
        }
        await new Promise(r => setTimeout(r, 300))
    }

    const resultado = acumuladas.slice(0, CONFIG.MIN_R34_IMAGES)
    cache.establecer(cacheKey, resultado)
    return resultado
}

// ─── HELPER FUNCTIONS PINTEREST ───
async function pinterestSearch(query) {
    const link = `https://id.pinterest.com/resource/BaseSearchResource/get/?source_url=%2Fsearch%2Fpins%2F%3Fq%3D${encodeURIComponent(query)}%26rs%3Dtyped&data=%7B%22options%22%3A%7B%22applied_unified_filters%22%3Anull%2C%22appliedProductFilters%22%3A%22---%22%2C%22article%22%3Anull%2C%22auto_correction_disabled%22%3Afalse%2C%22corpus%22%3Anull%2C%22customized_rerank_type%22%3Anull%2C%22domains%22%3Anull%2C%22dynamicPageSizeExpGroup%22%3A%22control%22%2C%22filters%22%3Anull%2C%22journey_depth%22%3Anull%2C%22page_size%22%3Anull%2C%22price_max%22%3Anull%2C%22price_min%22%3Anull%2C%22query_pin_sigs%22%3Anull%2C%22query%22%3A%22${encodeURIComponent(query)}%22%2C%22redux_normalize_feed%22%3Atrue%2C%22request_params%22%3Anull%2C%22rs%22%3A%22typed%22%2C%22scope%22%3A%22pins%22%2C%22selected_one_bar_modules%22%3Anull%2C%22seoDrawerEnabled%22%3Afalse%2C%22source_id%22%3Anull%2C%22source_module_id%22%3Anull%2C%22source_url%22%3A%22%2Fsearch%2Fpins%2F%3Fq%3D${encodeURIComponent(query)}%26rs%3Dtyped%22%2C%22top_pin_id%22%3Anull%2C%22top_pin_ids%22%3Anull%7D%2C%22context%22%3A%7B%7D%7D`
    const headers = {
        'accept': 'application/json, text/javascript, */*; q=0.01',
        'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'priority': 'u=1, i',
        'referer': 'https://id.pinterest.com/',
        'screen-dpr': '1',
        'sec-ch-ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133")',
        'sec-ch-ua-full-version-list': '"Not(A:Brand";v="99.0.0.0", "Google Chrome";v="133.0.6943.142", "Chromium";v="133.0.6943.142")',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-model': '""',
        'sec-ch-ua-platform': '"Windows"',
        'sec-ch-ua-platform-version': '"10.0.0"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',

        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
        'x-app-version': 'c056fb7',
        'x-pinterest-appstate': 'active',
        'x-pinterest-pws-handler': 'www/index.js',
        'x-pinterest-source-url': '/',
        'x-requested-with': 'XMLHttpRequest'
    }
    try {
        const res = await axios.get(link, { headers, timeout: CONFIG.TIMEOUT_API })
        if (res.data && res.data.resource_response && res.data.resource_response.data && res.data.resource_response.data.results) {
            return res.data.resource_response.data.results
                .map(item => {
                    if (item.images?.orig?.url) {
                        return item.images.orig.url
                    }
                    return null
                })
                .filter(url => url !== null)
        }
        return []
    } catch (error) {
        logger.debug(`Pinterest search error: ${error.message}`)
        return []
    }
}

async function fetchPinterest(name, serieName, cache, validator) {
    const cacheKey = `pinterest_${name}_${serieName}`
    const cached = cache.obtener(cacheKey)
    if (cached) return cached

    const nameClean = name.replace(/\(.*\)/g, '').replace(/_/g, ' ').trim()
    const query = `${nameClean} ${serieName} anime`

    try {
        let urls = []
        try {
            urls = await conReintentos(async () => {
                const resultado = await pinterestSearch(query)
                if (!resultado || resultado.length === 0) {
                    throw new Error(`No Pinterest results for: ${query}`)
                }
                return resultado
            })
        } catch (retryErr) {
            logger.debug(`Pinterest retry exhausted for "${query}": ${retryErr.message}`)
            // Intenta búsqueda alternativa (solo personaje)
            try {
                urls = await pinterestSearch(nameClean)
                if (!urls || urls.length === 0) {
                    throw new Error('Fallback also failed')
                }
            } catch {
                return []
            }
        }
        
        const resultado = urls.slice(0, CONFIG.MIN_PINTEREST_IMAGES)
        cache.establecer(cacheKey, resultado)
        return resultado
    } catch (err) {
        logger.debug(`Pinterest error: ${err.message}`)
        return []
    }
}

// ═══════════════════════════════════════════════════════════════
// BÚSQUEDA DE IMÁGENES COMBINADAS (mejorada)
// ═══════════════════════════════════════════════════════════════
async function buscarImagenes(nameForSearch, serieTag, serieName, esMujer, cache, validator) {
    // Orden: Pinterest 12, R34 5, Danbooru 3, Safebooru 3
    const pin = await fetchPinterest(nameForSearch, serieName, cache, validator)
    const r34 = esMujer ? await fetchRule34(nameForSearch, serieTag, serieName, cache, validator) : []
    const dan = await fetchDanbooru(nameForSearch, serieTag, serieName, cache, validator)
    const safe = await fetchSafebooru(nameForSearch, serieTag, serieName, cache, validator)

    const combinadas = new Set([...pin, ...r34, ...dan, ...safe])
    let final = [...combinadas].slice(0, CONFIG.MAX_IMG_POR_PERSONAJE)

    // Validar URLs si está habilitado
    if (CONFIG.VALIDAR_URLS && final.length > 0) {
        final = await validator.filtrarValidas(final)
    }

    const stats = `Pin:${pin.length} R34:${esMujer ? r34.length : 'skip'} Dan:${dan.length} Safe:${safe.length}`
    process.stdout.write(`${stats} → ${final.length} imgs`)
    return final
}

// ═══════════════════════════════════════════════════════════════
// JIKAN (MyAnimeList) — fuente de personajes (AniList fuera)
// ═══════════════════════════════════════════════════════════════
const JIKAN_BASE = 'https://api.jikan.moe/v4'
const JIKAN_DELAY = 900          // respetuoso entre requests
const JIKAN_REINTENTOS = 8       // MAL falla ~50-60% → necesitamos muchos tiros
const JIKAN_ESPERA = 4000        // entre reintentos (MAL se calma con pausas)
const MAX_CHARS_JIKAN = 30

const jikanSleep = ms => new Promise(r => setTimeout(r, ms))

async function jikanGet(path, cache) {
    const cacheKey = `jikan_${path}`
    const cached = cache.obtener(cacheKey)
    if (cached !== null && cached !== undefined) return cached

    for (let i = 0; i < JIKAN_REINTENTOS; i++) {
        try {
            const res = await fetch(`${JIKAN_BASE}${path}`, { timeout: CONFIG.TIMEOUT_API })
            if (res.status === 429) {                    // rate limit Jikan
                await new Promise(r => setTimeout(r, 2000 * (i + 1)))
                continue
            }
            if (res.status === 504 || res.status === 503 || res.status === 500) {
                // MAL intermitente → esperar y disparar de nuevo
                await new Promise(r => setTimeout(r, JIKAN_ESPERA))
                continue
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`)

            const json = await res.json()
            // Jikan a veces responde 200 con el error adentro (como viste en curl)
            if (json?.status === 504 || (json?.error && !json?.data)) {
                await new Promise(r => setTimeout(r, JIKAN_ESPERA))
                continue
            }
            cache.establecer(cacheKey, json)
            await new Promise(r => setTimeout(r, JIKAN_DELAY))
            return json
        } catch (err) {
            if (i === JIKAN_REINTENTOS - 1) {
                logger.debug(`Jikan error en ${path}: ${err.message}`)
                return null
            }
            await new Promise(r => setTimeout(r, JIKAN_ESPERA))
        }
    }
    return null
}

async function fetchJikanSerie(serieName, cache) {
    // 1) Buscar la serie
    const busqueda = await jikanGet(`/anime?q=${encodeURIComponent(serieName)}&limit=1`, cache)
    const anime = busqueda?.data?.[0]
    if (!anime) return null

    // 2) Lista de personajes (Main primero)
    const chars = await jikanGet(`/anime/${anime.mal_id}/characters`, cache)
    const lista = (chars?.data || [])
        .sort((a, b) => (a.role === 'Main' ? -1 : 1) - (b.role === 'Main' ? -1 : 1))
        .slice(0, MAX_CHARS_JIKAN)
    if (lista.length === 0) return null

    const titulo = anime.title_english || anime.title || serieName

    // 3) Detalle por personaje → género + favoritos reales
    const personajes = []
    for (const n of lista) {
        const det = await jikanGet(`/characters/${n.character.mal_id}/full`, cache)
        const d = det?.data
        // MAL trae "Apellido, Nombre" → invertir a "Nombre Apellido"
        const nombre = n.character.name.includes(', ')
            ? n.character.name.split(', ').reverse().join(' ')
            : n.character.name
        personajes.push({
            name: nombre,
            gender: d?.gender || null,     // 'Female' | 'Male' | null
            favourites: d?.favorites || 0
        })
    }

    return { titulo, personajes }
}

// ═══════════════════════════════════════════════════════════════
// UTILIDADES DE JSON
// ═══════════════════════════════════════════════════════════════
function deduplicarSerie(characters) {
    const vistos = new Map()
    for (const char of characters) {
        const key = char.name.toLowerCase().trim()
        if (!vistos.has(key)) {
            vistos.set(key, char)
        }
    }
    return [...vistos.values()]
}

function getNextSeriesKey(json) {
    const keys = Object.keys(json).map(Number).filter(n => !isNaN(n))
    return keys.length > 0 ? Math.max(...keys) + 1 : 100001
}

function getNextCharId(json) {
    let maxId = 1000
    for (const series of Object.values(json)) {
        for (const char of (series.characters || [])) {
            const n = parseInt(char.id)
            if (!isNaN(n) && n > maxId) maxId = n
        }
    }
    return maxId + 1
}

function calcularValor(favourites) {
    if (!favourites || favourites === 0) return 1000
    if (favourites < 100) return 2000
    if (favourites < 500) return 5000
    if (favourites < 1000) return 8000
    if (favourites < 5000) return 12000
    if (favourites < 10000) return 18000
    if (favourites < 30000) return 25000
    if (favourites < 60000) return 40000
    if (favourites < 100000) return 60000
    return 100000
}

// ═══════════════════════════════════════════════════════════════
// BACKUP AUTOMÁTICO
// ═══════════════════════════════════════════════════════════════
async function crearBackup(json) {
    if (!CONFIG.CREAR_BACKUP) return
    try {
        await fs.mkdir(CONFIG.BACKUP_DIR, { recursive: true })
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const hash = crypto.createHash('md5').update(JSON.stringify(json)).digest('hex').slice(0, 8)
        const backupPath = `${CONFIG.BACKUP_DIR}/characters_${timestamp}_${hash}.json`
        await fs.writeFile(backupPath, JSON.stringify(json, null, 2))
        logger.info(`Backup creado: ${backupPath}`)
    } catch (err) {
        logger.warn(`No se pudo crear backup: ${err.message}`)
    }
}

// ═══════════════════════════════════════════════════════════════
// SERIES MANUALES (de tu código original)
// ═══════════════════════════════════════════════════════════════
const SERIES_MANUALES = [
    {
        name: "Vocaloid",
        tags: ["vocaloid", "virtual_singer"],
        characters: [
            { name: "Hatsune Miku", gender: "Mujer", tags: ["hatsune_miku"] },
            { name: "Kagamine Rin", gender: "Mujer", tags: ["kagamine_rin"] },
            { name: "Kagamine Len", gender: "Hombre", tags: ["kagamine_len"] },
            { name: "Megurine Luka", gender: "Mujer", tags: ["megurine_luka"] },
            { name: "KAITO", gender: "Hombre", tags: ["kaito"] },
            { name: "MEIKO", gender: "Mujer", tags: ["meiko"] },
            { name: "Gumi", gender: "Mujer", tags: ["gumi"] },
            { name: "IA", gender: "Mujer", tags: ["ia_vocaloid"] },
            { name: "Kasane Teto", gender: "Mujer", tags: ["kasane_teto"] },
            { name: "Akita Neru", gender: "Mujer", tags: ["akita_neru"] },
            { name: "Yowane Haku", gender: "Mujer", tags: ["yowane_haku"] },
        ]
    },
    {
        name: "Genshin Impact",
        tags: ["genshin_impact", "genshin"],
        characters: [
            { name: "Lumine", gender: "Mujer", tags: ["lumine_(genshin_impact)"] },
            { name: "Hu Tao", gender: "Mujer", tags: ["hu_tao_(genshin_impact)"] },
            { name: "Ganyu", gender: "Mujer", tags: ["ganyu_(genshin_impact)"] },
            { name: "Keqing", gender: "Mujer", tags: ["keqing_(genshin_impact)"] },
            { name: "Raiden Shogun", gender: "Mujer", tags: ["raiden_shogun_(genshin_impact)"] },
            { name: "Yae Miko", gender: "Mujer", tags: ["yae_miko_(genshin_impact)"] },
            { name: "Furina", gender: "Mujer", tags: ["furina_(genshin_impact)"] },
            { name: "Arlecchino", gender: "Mujer", tags: ["arlecchino_(genshin_impact)"] },
            { name: "Navia", gender: "Mujer", tags: ["navia_(genshin_impact)"] },
            { name: "Clorinde", gender: "Mujer", tags: ["clorinde_(genshin_impact)"] },
            { name: "Xilonen", gender: "Mujer", tags: ["xilonen_(genshin_impact)"] },
            { name: "Mavuika", gender: "Mujer", tags: ["mavuika_(genshin_impact)"] },
            { name: "Citlali", gender: "Mujer", tags: ["citlali_(genshin_impact)"] },
            { name: "Yoimiya", gender: "Mujer", tags: ["yoimiya_(genshin_impact)"] },
            { name: "Yelan", gender: "Mujer", tags: ["yelan_(genshin_impact)"] },
            { name: "Shenhe", gender: "Mujer", tags: ["shenhe_(genshin_impact)"] },
            { name: "Sangonomiya Kokomi", gender: "Mujer", tags: ["sangonomiya_kokomi"] },
            { name: "Eula", gender: "Mujer", tags: ["eula_(genshin_impact)"] },
            { name: "Dehya", gender: "Mujer", tags: ["dehya_(genshin_impact)"] },
            { name: "Candace", gender: "Mujer", tags: ["candace_(genshin_impact)"] },
            { name: "Layla", gender: "Mujer", tags: ["layla_(genshin_impact)"] },
            { name: "Faruzan", gender: "Mujer", tags: ["faruzan_(genshin_impact)"] },
            { name: "Chasca", gender: "Mujer", tags: ["chasca_(genshin_impact)"] },
            { name: "Emilie", gender: "Mujer", tags: ["emilie_(genshin_impact)"] },
            { name: "Kujou Sara", gender: "Mujer", tags: ["kujou_sara"] },
            { name: "Kuki Shinobu", gender: "Mujer", tags: ["kuki_shinobu"] },
            { name: "Sayu", gender: "Mujer", tags: ["sayu_(genshin_impact)"] },
            { name: "Yanfei", gender: "Mujer", tags: ["yanfei_(genshin_impact)"] },
            { name: "Yun Jin", gender: "Mujer", tags: ["yun_jin_(genshin_impact)"] },
            { name: "Xinyan", gender: "Mujer", tags: ["xinyan_(genshin_impact)"] },
            { name: "Beidou", gender: "Mujer", tags: ["beidou_(genshin_impact)"] },
            { name: "Ningguang", gender: "Mujer", tags: ["ningguang_(genshin_impact)"] },
            { name: "Lisa", gender: "Mujer", tags: ["lisa_(genshin_impact)"] },
            { name: "Jean", gender: "Mujer", tags: ["jean_(genshin_impact)"] },
            { name: "Barbara", gender: "Mujer", tags: ["barbara_(genshin_impact)"] },
            { name: "Mona", gender: "Mujer", tags: ["mona_(genshin_impact)"] },
            { name: "Rosaria", gender: "Mujer", tags: ["rosaria_(genshin_impact)"] },
            { name: "Sucrose", gender: "Mujer", tags: ["sucrose_(genshin_impact)"] },
            { name: "Amber", gender: "Mujer", tags: ["amber_(genshin_impact)"] },
            { name: "Noelle", gender: "Mujer", tags: ["noelle_(genshin_impact)"] },
            { name: "Xiangling", gender: "Mujer", tags: ["xiangling_(genshin_impact)"] },
            { name: "Sigewinne", gender: "Mujer", tags: ["sigewinne_(genshin_impact)"] },
            { name: "Iansan", gender: "Mujer", tags: ["iansan_(genshin_impact)"] },
            { name: "Varesa", gender: "Mujer", tags: ["varesa_(genshin_impact)"] },
            { name: "Ayaka", gender: "Mujer", tags: ["kamisato_ayaka"] },
            { name: "Fischl", gender: "Mujer", tags: ["fischl_(genshin_impact)"] },
            { name: "Nahida", gender: "Mujer", tags: ["nahida_(genshin_impact)"] },
            { name: "Nilou", gender: "Mujer", tags: ["nilou_(genshin_impact)"] },
            { name: "Zhongli", gender: "Hombre", tags: ["zhongli_(genshin_impact)"] },
            { name: "Kazuha", gender: "Hombre", tags: ["kaedehara_kazuha"] },
            { name: "Neuvillette", gender: "Hombre", tags: ["neuvillette_(genshin_impact)"] },
            { name: "Alhaitham", gender: "Hombre", tags: ["alhaitham_(genshin_impact)"] },
            { name: "Wriothesley", gender: "Hombre", tags: ["wriothesley_(genshin_impact)"] },
            { name: "Arataki Itto", gender: "Hombre", tags: ["arataki_itto"] },
            { name: "Kinich", gender: "Hombre", tags: ["kinich_(genshin_impact)"] },
            { name: "Xiao", gender: "Hombre", tags: ["xiao_(genshin_impact)"] },
            { name: "Venti", gender: "Hombre", tags: ["venti_(genshin_impact)"] },
            { name: "Tartaglia", gender: "Hombre", tags: ["tartaglia_(genshin_impact)"] },
            { name: "Kaeya", gender: "Hombre", tags: ["kaeya_(genshin_impact)"] },
            { name: "Diluc", gender: "Hombre", tags: ["diluc_(genshin_impact)"] },
            { name: "Lyney", gender: "Hombre", tags: ["lyney_(genshin_impact)"] },
            { name: "Albedo", gender: "Hombre", tags: ["albedo_(genshin_impact)"] },
        ]
    },
    {
        name: "Honkai Star Rail",
        tags: ["honkai_star_rail", "starrail"],
        characters: [
            { name: "Stelle", gender: "Mujer", tags: ["stelle_(honkai:_star_rail)"] },
            { name: "Bronya", gender: "Mujer", tags: ["bronya_(honkai:_star_rail)"] },
            { name: "Seele", gender: "Mujer", tags: ["seele_(honkai:_star_rail)"] },
            { name: "Kafka", gender: "Mujer", tags: ["kafka_(honkai:_star_rail)"] },
            { name: "Silver Wolf", gender: "Mujer", tags: ["silver_wolf_(honkai:_star_rail)"] },
            { name: "Jingliu", gender: "Mujer", tags: ["jingliu_(honkai:_star_rail)"] },
            { name: "Robin", gender: "Mujer", tags: ["robin_(honkai:_star_rail)"] },
            { name: "Firefly", gender: "Mujer", tags: ["firefly_(honkai:_star_rail)"] },
            { name: "Acheron", gender: "Mujer", tags: ["acheron_(honkai:_star_rail)"] },
            { name: "Black Swan", gender: "Mujer", tags: ["black_swan_(honkai:_star_rail)"] },
            { name: "Sparkle", gender: "Mujer", tags: ["sparkle_(honkai:_star_rail)"] },
            { name: "Topaz", gender: "Mujer", tags: ["topaz_(honkai:_star_rail)"] },
            { name: "Himeko", gender: "Mujer", tags: ["himeko_(honkai:_star_rail)"] },
            { name: "Herta", gender: "Mujer", tags: ["herta_(honkai:_star_rail)"] },
            { name: "The Herta", gender: "Mujer", tags: ["the_herta_(honkai:_star_rail)"] },
            { name: "Feixiao", gender: "Mujer", tags: ["feixiao_(honkai:_star_rail)"] },
            { name: "Fugue", gender: "Mujer", tags: ["fugue_(honkai:_star_rail)"] },
            { name: "Castorice", gender: "Mujer", tags: ["castorice_(honkai:_star_rail)"] },
            { name: "Aglaea", gender: "Mujer", tags: ["aglaea_(honkai:_star_rail)"] },
            { name: "Rappa", gender: "Mujer", tags: ["rappa_(honkai:_star_rail)"] },
            { name: "Lingsha", gender: "Mujer", tags: ["lingsha_(honkai:_star_rail)"] },
            { name: "Tribbie", gender: "Mujer", tags: ["tribbie_(honkai:_star_rail)"] },
            { name: "Hyacine", gender: "Mujer", tags: ["hyacine_(honkai:_star_rail)"] },
            { name: "Cipher", gender: "Mujer", tags: ["cipher_(honkai:_star_rail)"] },
            { name: "Serval", gender: "Mujer", tags: ["serval_(honkai:_star_rail)"] },
            { name: "Natasha", gender: "Mujer", tags: ["natasha_(honkai:_star_rail)"] },
            { name: "Hook", gender: "Mujer", tags: ["hook_(honkai:_star_rail)"] },
            { name: "Bailu", gender: "Mujer", tags: ["bailu_(honkai:_star_rail)"] },
            { name: "Qingque", gender: "Mujer", tags: ["qingque_(honkai:_star_rail)"] },
            { name: "Guinaifen", gender: "Mujer", tags: ["guinaifen_(honkai:_star_rail)"] },
            { name: "Lynx", gender: "Mujer", tags: ["lynx_(honkai:_star_rail)"] },
            { name: "Hanya", gender: "Mujer", tags: ["hanya_(honkai:_star_rail)"] },
            { name: "Xueyi", gender: "Mujer", tags: ["xueyi_(honkai:_star_rail)"] },
            { name: "Yukong", gender: "Mujer", tags: ["yukong_(honkai:_star_rail)"] },
            { name: "Aventurine", gender: "Hombre", tags: ["aventurine_(honkai:_star_rail)"] },
            { name: "Boothill", gender: "Hombre", tags: ["boothill_(honkai:_star_rail)"] },
            { name: "Sunday", gender: "Hombre", tags: ["sunday_(honkai:_star_rail)"] },
            { name: "Mydei", gender: "Hombre", tags: ["mydei_(honkai:_star_rail)"] },
            { name: "Dan Heng", gender: "Hombre", tags: ["dan_heng_(honkai:_star_rail)"] },
            { name: "Jing Yuan", gender: "Hombre", tags: ["jing_yuan_(honkai:_star_rail)"] },
            { name: "Blade", gender: "Hombre", tags: ["blade_(honkai:_star_rail)"] },
            { name: "Luocha", gender: "Hombre", tags: ["luocha_(honkai:_star_rail)"] },
            { name: "Gepard", gender: "Hombre", tags: ["gepard_(honkai:_star_rail)"] },
            { name: "Sampo", gender: "Hombre", tags: ["sampo_(honkai:_star_rail)"] },
            { name: "Argenti", gender: "Hombre", tags: ["argenti_(honkai:_star_rail)"] },
        ]
    },
    {
        name: "Blue Archive",
        tags: ["blue_archive"],
        characters: [
            { name: "Hina", gender: "Mujer", tags: ["hina_(blue_archive)"] },
            { name: "Shiroko", gender: "Mujer", tags: ["shiroko_(blue_archive)"] },
            { name: "Aru", gender: "Mujer", tags: ["aru_(blue_archive)"] },
            { name: "Yuuka", gender: "Mujer", tags: ["yuuka_(blue_archive)"] },
            { name: "Karin", gender: "Mujer", tags: ["karin_(blue_archive)"] },
            { name: "Mika", gender: "Mujer", tags: ["mika_(blue_archive)"] },
            { name: "Arona", gender: "Mujer", tags: ["arona_(blue_archive)"] },
            { name: "Hoshino", gender: "Mujer", tags: ["hoshino_(blue_archive)"] },
            { name: "Asuna", gender: "Mujer", tags: ["asuna_(blue_archive)"] },
            { name: "Iori", gender: "Mujer", tags: ["iori_(blue_archive)"] },
            { name: "Hifumi", gender: "Mujer", tags: ["hifumi_(blue_archive)"] },
            { name: "Kazusa", gender: "Mujer", tags: ["kazusa_(blue_archive)"] },
            { name: "Hanako", gender: "Mujer", tags: ["hanako_(blue_archive)"] },
            { name: "Azusa", gender: "Mujer", tags: ["azusa_(blue_archive)"] },
            { name: "Koharu", gender: "Mujer", tags: ["koharu_(blue_archive)"] },
            { name: "Wakamo", gender: "Mujer", tags: ["wakamo_(blue_archive)"] },
            { name: "Neru", gender: "Mujer", tags: ["neru_(blue_archive)"] },
            { name: "Hasumi", gender: "Mujer", tags: ["hasumi_(blue_archive)"] },
            { name: "Noa", gender: "Mujer", tags: ["noa_(blue_archive)"] },
            { name: "Seia", gender: "Mujer", tags: ["seia_(blue_archive)"] },
            { name: "Ibuki", gender: "Mujer", tags: ["ibuki_(blue_archive)"] },
            { name: "Saki", gender: "Mujer", tags: ["saki_(blue_archive)"] },
            { name: "Miyako", gender: "Mujer", tags: ["miyako_(blue_archive)"] },
            { name: "Miyu", gender: "Mujer", tags: ["miyu_(blue_archive)"] },
            { name: "Moe", gender: "Mujer", tags: ["moe_(blue_archive)"] },
            { name: "Kayoko", gender: "Mujer", tags: ["kayoko_(blue_archive)"] },
            { name: "Haruka", gender: "Mujer", tags: ["haruka_(blue_archive)"] },
            { name: "Mutsuki", gender: "Mujer", tags: ["mutsuki_(blue_archive)"] },
            { name: "Hare", gender: "Mujer", tags: ["hare_(blue_archive)"] },
            { name: "Serika", gender: "Mujer", tags: ["serika_(blue_archive)"] },
            { name: "Nonomi", gender: "Mujer", tags: ["nonomi_(blue_archive)"] },
            { name: "Ayane", gender: "Mujer", tags: ["ayane_(blue_archive)"] },
            { name: "Yuzu", gender: "Mujer", tags: ["yuzu_(blue_archive)"] },
            { name: "Momoi", gender: "Mujer", tags: ["momoi_(blue_archive)"] },
            { name: "Midori", gender: "Mujer", tags: ["midori_(blue_archive)"] },
            { name: "Izuna", gender: "Mujer", tags: ["izuna_(blue_archive)"] },
            { name: "Ui", gender: "Mujer", tags: ["ui_(blue_archive)"] },
        ]
    },
    {
        name: "Fate Series",
        tags: ["fate", "fate_stay_night", "fate_grand_order"],
        characters: [
            { name: "Saber Artoria", gender: "Mujer", tags: ["artoria_pendragon_(fate)"] },
            { name: "Rin Tohsaka", gender: "Mujer", tags: ["tohsaka_rin"] },
            { name: "Medusa Rider", gender: "Mujer", tags: ["medusa_(fate)"] },
            { name: "Tamamo no Mae", gender: "Mujer", tags: ["tamamo_no_mae_(fate)"] },
            { name: "Scathach", gender: "Mujer", tags: ["scathach_(fate)"] },
            { name: "Jeanne d'Arc", gender: "Mujer", tags: ["jeanne_d'arc_(fate)"] },
            { name: "Nero Claudius", gender: "Mujer", tags: ["nero_claudius_(fate)"] },
            { name: "Jeanne Alter", gender: "Mujer", tags: ["jeanne_alter_(fate)"] },
            { name: "Artoria Alter", gender: "Mujer", tags: ["artoria_pendragon_alter"] },
            { name: "Okita Souji", gender: "Mujer", tags: ["okita_souji_(fate)"] },
            { name: "Oda Nobunaga", gender: "Mujer", tags: ["oda_nobunaga_(fate)"] },
            { name: "Mash Kyrielight", gender: "Mujer", tags: ["mash_kyrielight_(fate)"] },
            { name: "Ishtar", gender: "Mujer", tags: ["ishtar_(fate)"] },
            { name: "Ereshkigal", gender: "Mujer", tags: ["ereshkigal_(fate)"] },
            { name: "Kama", gender: "Mujer", tags: ["kama_(fate)"] },
            { name: "Miyamoto Musashi", gender: "Mujer", tags: ["miyamoto_musashi_(fate)"] },
            { name: "Minamoto no Raikou", gender: "Mujer", tags: ["minamoto_no_raikou_(fate)"] },
            { name: "Shuten Douji", gender: "Mujer", tags: ["shuten_douji_(fate)"] },
            { name: "Ibaraki Douji", gender: "Mujer", tags: ["ibaraki_douji_(fate)"] },
            { name: "BB", gender: "Mujer", tags: ["bb_(fate)"] },
            { name: "Meltryllis", gender: "Mujer", tags: ["meltryllis_(fate)"] },
            { name: "Passionlip", gender: "Mujer", tags: ["passionlip_(fate)"] },
            { name: "Illyasviel von Einzbern", gender: "Mujer", tags: ["illyasviel_von_einzbern_(fate)"] },
            { name: "Chloe von Einzbern", gender: "Mujer", tags: ["chloe_von_einzbern_(fate)"] },
            { name: "Kiara Sessyoin", gender: "Mujer", tags: ["kiara_sessyoin_(fate)"] },
            { name: "Abigail Williams", gender: "Mujer", tags: ["abigail_williams_(fate)"] },
            { name: "Yang Guifei", gender: "Mujer", tags: ["yang_guifei_(fate)"] },
            { name: "Space Ishtar", gender: "Mujer", tags: ["space_ishtar_(fate)"] },
            { name: "Van Gogh", gender: "Mujer", tags: ["van_gogh_(fate)"] },
            { name: "Morgan", gender: "Mujer", tags: ["morgan_(fate)"] },
            { name: "Barghest", gender: "Mujer", tags: ["barghest_(fate)"] },
            { name: "Baobhan Sith", gender: "Mujer", tags: ["baobhan_sith_(fate)"] },
            { name: "Melusine", gender: "Mujer", tags: ["melusine_(fate)"] },
            { name: "Artoria Caster", gender: "Mujer", tags: ["artoria_caster_(fate)"] },
            { name: "Scathach Skadi", gender: "Mujer", tags: ["scathach_skadi_(fate)"] },
            { name: "Hassan of Serenity", gender: "Mujer", tags: ["hassan_of_serenity_(fate)"] },
            { name: "Nitocris", gender: "Mujer", tags: ["nitocris_(fate)"] },
            { name: "Gilgamesh", gender: "Hombre", tags: ["gilgamesh_(fate)"] },
            { name: "Astolfo", gender: "Hombre", tags: ["astolfo_(fate)"] },
            { name: "Cu Chulainn", gender: "Hombre", tags: ["cu_chulainn_(fate)"] },
            { name: "Emiya", gender: "Hombre", tags: ["emiya_(fate)"] },
        ]
    },
    {
        name: "Honkai Impact 3rd",
        tags: ["honkai_impact_3rd", "hi3"],
        characters: [
            { name: "Kiana Kaslana", gender: "Mujer", tags: ["kiana_kaslana"] },
            { name: "Mei Raiden", gender: "Mujer", tags: ["raiden_mei"] },
            { name: "Bronya Zaychik", gender: "Mujer", tags: ["bronya_zaychik"] },
            { name: "Yae Sakura", gender: "Mujer", tags: ["yae_sakura"] },
            { name: "Theresa Apocalypse", gender: "Mujer", tags: ["theresa_apocalypse"] },
            { name: "Murata Himeko", gender: "Mujer", tags: ["murata_himeko"] },
            { name: "Seele Vollerei", gender: "Mujer", tags: ["seele_vollerei"] },
            { name: "Cocolia Rand", gender: "Mujer", tags: ["cocolia_rand"] },
            { name: "Fu Hua", gender: "Mujer", tags: ["fu_hua"] },
            { name: "Raven", gender: "Mujer", tags: ["raven_(honkai_impact)"] },
            { name: "Sirin", gender: "Mujer", tags: ["sirin_(honkai_impact)"] },
            { name: "Durandal", gender: "Mujer", tags: ["durandal_(honkai_impact)"] },
            { name: "Elysia", gender: "Mujer", tags: ["elysia_(honkai_impact)"] },
            { name: "Eden", gender: "Mujer", tags: ["eden_(honkai_impact)"] },
            { name: "Aponia", gender: "Mujer", tags: ["aponia_(honkai_impact)"] },
            { name: "Vill-V", gender: "Mujer", tags: ["vill-v_(honkai_impact)"] },
            { name: "Mobius", gender: "Mujer", tags: ["mobius_(honkai_impact)"] },
            { name: "Griseo", gender: "Mujer", tags: ["griseo_(honkai_impact)"] },
            { name: "Kallen Kaslana", gender: "Mujer", tags: ["kallen_kaslana"] },
            { name: "Rita Rossweisse", gender: "Mujer", tags: ["rita_rossweisse"] },
        ]
    },
    {
        name: "Zenless Zone Zero",
        tags: ["zenless_zone_zero", "zzz"],
        characters: [
            { name: "Ellen Joe", gender: "Mujer", tags: ["ellen_joe_(zenless_zone_zero)"] },
            { name: "Jane Doe", gender: "Mujer", tags: ["jane_doe_(zenless_zone_zero)"] },
            { name: "Miyabi", gender: "Mujer", tags: ["miyabi_(zenless_zone_zero)"] },
            { name: "Caesar", gender: "Mujer", tags: ["caesar_(zenless_zone_zero)"] },
            { name: "Burnice", gender: "Mujer", tags: ["burnice_(zenless_zone_zero)"] },
            { name: "Yanagi", gender: "Mujer", tags: ["yanagi_(zenless_zone_zero)"] },
            { name: "Astra Yao", gender: "Mujer", tags: ["astra_yao_(zenless_zone_zero)"] },
            { name: "Piper", gender: "Mujer", tags: ["piper_(zenless_zone_zero)"] },
            { name: "Koleda", gender: "Mujer", tags: ["koleda_(zenless_zone_zero)"] },
            { name: "Soukaku", gender: "Mujer", tags: ["soukaku_(zenless_zone_zero)"] },
            { name: "Qingyi", gender: "Mujer", tags: ["qingyi_(zenless_zone_zero)"] },
            { name: "Vivian", gender: "Mujer", tags: ["vivian_(zenless_zone_zero)"] },
            { name: "Trigger", gender: "Mujer", tags: ["trigger_(zenless_zone_zero)"] },
            { name: "Pulchra", gender: "Mujer", tags: ["pulchra_(zenless_zone_zero)"] },
            { name: "Rina Shields", gender: "Mujer", tags: ["rina_(zenless_zone_zero)"] },
            { name: "Nicole Demara", gender: "Mujer", tags: ["nicole_demara_(zenless_zone_zero)"] },
            { name: "Zhu Yuan", gender: "Mujer", tags: ["zhu_yuan_(zenless_zone_zero)"] },
            { name: "Grace Howard", gender: "Mujer", tags: ["grace_howard_(zenless_zone_zero)"] },
            { name: "Evelyn", gender: "Mujer", tags: ["evelyn_(zenless_zone_zero)"] },
            { name: "Anby Demara", gender: "Mujer", tags: ["anby_demara_(zenless_zone_zero)"] },
            { name: "Lucy", gender: "Mujer", tags: ["lucy_(zenless_zone_zero)"] },
            { name: "Lycaon", gender: "Hombre", tags: ["lycaon_(zenless_zone_zero)"] },
            { name: "Ben Bigger", gender: "Hombre", tags: ["ben_bigger_(zenless_zone_zero)"] },
            { name: "Seth", gender: "Hombre", tags: ["seth_(zenless_zone_zero)"] },
            { name: "Harumasa", gender: "Hombre", tags: ["harumasa_(zenless_zone_zero)"] },
            { name: "Lighter", gender: "Hombre", tags: ["lighter_(zenless_zone_zero)"] },
        ]
    },
    {
        name: "Tears of Themis",
        tags: ["tears_of_themis", "tot"],
        characters: [
            { name: "Marius", gender: "Hombre", tags: ["marius_(tot)"] },
            { name: "Artem", gender: "Hombre", tags: ["artem_(tot)"] },
            { name: "Luke", gender: "Hombre", tags: ["luke_(tot)"] },
            { name: "Vyn", gender: "Hombre", tags: ["vyn_(tot)"] },
            { name: "Rosa Elegance", gender: "Mujer", tags: ["rosa_elegance"] },
            { name: "Celestine", gender: "Mujer", tags: ["celestine_(tot)"] },
            { name: "Talia", gender: "Mujer", tags: ["talia_(tot)"] },
        ]
    },
    {
        name: "GATE",
        tags: ["gate_jieitai_kanochi_nite", "gate"],
        characters: [
            { name: "Rory Mercury", gender: "Mujer", tags: ["rory_mercury_(gate)"] },
            { name: "Tuka Luna Marceau", gender: "Mujer", tags: ["tuka_luna_marceau_(gate)"] },
            { name: "Lelei La Lalena", gender: "Mujer", tags: ["lelei_la_lalena_(gate)"] },
            { name: "Yao Ro Dushi", gender: "Mujer", tags: ["yao_ro_dushi_(gate)"] },
            { name: "Pina Co Lada", gender: "Mujer", tags: ["pina_co_lada_(gate)"] },
            { name: "Shino Kuribayashi", gender: "Mujer", tags: ["shino_kuribayashi_(gate)"] },
            { name: "Mari Kurokawa", gender: "Mujer", tags: ["mari_kurokawa_(gate)"] },
            { name: "Hamilton Uni Rose", gender: "Mujer", tags: ["hamilton_uni_rose_(gate)"] },
            { name: "Myuute Luna Sires", gender: "Mujer", tags: ["myuute_luna_sires_(gate)"] },
            { name: "Delilah", gender: "Mujer", tags: ["delilah_(gate)"] },
            { name: "Itami Youji", gender: "Hombre", tags: ["itami_youji_(gate)"] },
        ]
    },
    {
        name: "The Quintessential Quintuplets",
        tags: ["go-toubun_no_hanayome", "quintessential_quintuplets"],
        characters: [
            { name: "Ichika Nakano", gender: "Mujer", tags: ["ichika_nakano_(go-toubun_no_hanayome)"] },
            { name: "Nino Nakano", gender: "Mujer", tags: ["nino_nakano_(go-toubun_no_hanayome)"] },
            { name: "Miku Nakano", gender: "Mujer", tags: ["miku_nakano_(go-toubun_no_hanayome)"] },
            { name: "Yotsuba Nakano", gender: "Mujer", tags: ["yotsuba_nakano_(go-toubun_no_hanayome)"] },
            { name: "Itsuki Nakano", gender: "Mujer", tags: ["itsuki_nakano_(go-toubun_no_hanayome)"] },
        ]
    },
    {
        name: "The 100 Girlfriends",
        tags: ["the_100_girlfriends_who_really_really_really_really_really_love_you"],
        characters: [
            { name: "Hakari Hanazono", gender: "Mujer", tags: ["hakari_hanazono"] },
            { name: "Karane Inda", gender: "Mujer", tags: ["karane_inda"] },
            { name: "Shizuka Yoshimoto", gender: "Mujer", tags: ["shizuka_yoshimoto"] },
            { name: "Nano Eiai", gender: "Mujer", tags: ["nano_eiai"] },
            { name: "Kusuri Yakuzen", gender: "Mujer", tags: ["kusuri_yakuzen"] },
            { name: "Hahari Hanazono", gender: "Mujer", tags: ["hahari_hanazono"] },
            { name: "Kurumi Haraga", gender: "Mujer", tags: ["kurumi_haraga"] },
            { name: "Mei Meido", gender: "Mujer", tags: ["mei_meido"] },
            { name: "Iku Sutou", gender: "Mujer", tags: ["iku_sutou"] },
            { name: "Mimimi Utsukushigi", gender: "Mujer", tags: ["mimimi_utsukushigi"] },
            { name: "Meme Kakure", gender: "Mujer", tags: ["meme_kakure"] },
            { name: "Chiyo Rimu", gender: "Mujer", tags: ["chiyo_rimu"] },
            { name: "Rentarou Aijou", gender: "Hombre", tags: ["rentarou_aijou"] },
        ]
    },
    {
        name: "Wuthering Waves",
        tags: ["wuthering_waves", "wuwa"],
        characters: [
            { name: "Jinhsi", gender: "Mujer", tags: ["jinhsi_(wuthering_waves)"] },
            { name: "Yinlin", gender: "Mujer", tags: ["yinlin_(wuthering_waves)"] },
            { name: "Changli", gender: "Mujer", tags: ["changli_(wuthering_waves)"] },
            { name: "Camellya", gender: "Mujer", tags: ["camellya_(wuthering_waves)"] },
            { name: "Shorekeeper", gender: "Mujer", tags: ["shorekeeper_(wuthering_waves)"] },
            { name: "Zhezhi", gender: "Mujer", tags: ["zhezhi_(wuthering_waves)"] },
            { name: "Xiangli Yao", gender: "Mujer", tags: ["xiangli_yao_(wuthering_waves)"] },
            { name: "Carlotta", gender: "Mujer", tags: ["carlotta_(wuthering_waves)"] },
            { name: "Phoebe", gender: "Mujer", tags: ["phoebe_(wuthering_waves)"] },
            { name: "Verina", gender: "Mujer", tags: ["verina_(wuthering_waves)"] },
            { name: "Encore", gender: "Mujer", tags: ["encore_(wuthering_waves)"] },
            { name: "Sanhua", gender: "Mujer", tags: ["sanhua_(wuthering_waves)"] },
            { name: "Baizhi", gender: "Mujer", tags: ["baizhi_(wuthering_waves)"] },
            { name: "Danjin", gender: "Mujer", tags: ["danjin_(wuthering_waves)"] },
            { name: "Taoqi", gender: "Mujer", tags: ["taoqi_(wuthering_waves)"] },
            { name: "Lumi", gender: "Mujer", tags: ["lumi_(wuthering_waves)"] },
            { name: "Youhu", gender: "Mujer", tags: ["youhu_(wuthering_waves)"] },
            { name: "Cantarella", gender: "Mujer", tags: ["cantarella_(wuthering_waves)"] },
            { name: "Roccia", gender: "Mujer", tags: ["roccia_(wuthering_waves)"] },
            { name: "Zani", gender: "Mujer", tags: ["zani_(wuthering_waves)"] },
            { name: "Ciaccona", gender: "Mujer", tags: ["ciaccona_(wuthering_waves)"] },
            { name: "Cartethyia", gender: "Mujer", tags: ["cartethyia_(wuthering_waves)"] },
            { name: "Lupa", gender: "Mujer", tags: ["lupa_(wuthering_waves)"] },
            { name: "Phrolova", gender: "Mujer", tags: ["phrolova_(wuthering_waves)"] },
            { name: "Augusta", gender: "Mujer", tags: ["augusta_(wuthering_waves)"] },
            { name: "Iuno", gender: "Mujer", tags: ["iuno_(wuthering_waves)"] },
            { name: "Rover", gender: "Mujer", tags: ["rover_(wuthering_waves)"] },
            { name: "Jiyan", gender: "Hombre", tags: ["jiyan_(wuthering_waves)"] },
            { name: "Calcharo", gender: "Hombre", tags: ["calcharo_(wuthering_waves)"] },
            { name: "Mortefi", gender: "Hombre", tags: ["mortefi_(wuthering_waves)"] },
            { name: "Aalto", gender: "Hombre", tags: ["aalto_(wuthering_waves)"] },
            { name: "Yuanwu", gender: "Hombre", tags: ["yuanwu_(wuthering_waves)"] },
            { name: "Brant", gender: "Hombre", tags: ["brant_(wuthering_waves)"] },
        ]
    },
    {
        name: "Umamusume",
        tags: ["umamusume", "umamusume_pretty_derby"],
        characters: [
            { name: "Matikanetannhauser", gender: "Mujer", tags: ["matikanetannhauser_(umamusume)"] },
            { name: "Meisho Doto", gender: "Mujer", tags: ["meisho_doto_(umamusume)"] },
            { name: "Agnes Tachyon", gender: "Mujer", tags: ["agnes_tachyon_(umamusume)"] },
            { name: "Still in Love", gender: "Mujer", tags: ["still_in_love_(umamusume)"] },
            { name: "Special Week", gender: "Mujer", tags: ["special_week_(umamusume)"] },
            { name: "Silence Suzuka", gender: "Mujer", tags: ["silence_suzuka_(umamusume)"] },
            { name: "Tokai Teio", gender: "Mujer", tags: ["tokai_teio_(umamusume)"] },
            { name: "Maruzensky", gender: "Mujer", tags: ["maruzensky_(umamusume)"] },
            { name: "Gold Ship", gender: "Mujer", tags: ["gold_ship_(umamusume)"] },
            { name: "Vodka", gender: "Mujer", tags: ["vodka_(umamusume)"] },
            { name: "Daiwa Scarlet", gender: "Mujer", tags: ["daiwa_scarlet_(umamusume)"] },
            { name: "Sakura Bakushin O", gender: "Mujer", tags: ["sakura_bakushin_o_(umamusume)"] },
            { name: "Haru Urara", gender: "Mujer", tags: ["haru_urara_(umamusume)"] },
            { name: "El Condor Pasa", gender: "Mujer", tags: ["el_condor_pasa_(umamusume)"] },
            { name: "Grass Wonder", gender: "Mujer", tags: ["grass_wonder_(umamusume)"] },
            { name: "Hishi Amazon", gender: "Mujer", tags: ["hishi_amazon_(umamusume)"] },
            { name: "Air Groove", gender: "Mujer", tags: ["air_groove_(umamusume)"] },
            { name: "Super Creek", gender: "Mujer", tags: ["super_creek_(umamusume)"] },
            { name: "Symboli Rudolf", gender: "Mujer", tags: ["symboli_rudolf_(umamusume)"] },
            { name: "Mejiro McQueen", gender: "Mujer", tags: ["mejiro_mcqueen_(umamusume)"] },
            { name: "Mejiro Ryan", gender: "Mujer", tags: ["mejiro_ryan_(umamusume)"] },
            { name: "Mejiro Palmer", gender: "Mujer", tags: ["mejiro_palmer_(umamusume)"] },
            { name: "Mejiro Dober", gender: "Mujer", tags: ["mejiro_dober_(umamusume)"] },
            { name: "Mejiro Ardan", gender: "Mujer", tags: ["mejiro_ardan_(umamusume)"] },
            { name: "Kitasan Black", gender: "Mujer", tags: ["kitasan_black_(umamusume)"] },
            { name: "Satono Diamond", gender: "Mujer", tags: ["satono_diamond_(umamusume)"] },
            { name: "Cheval Grand", gender: "Mujer", tags: ["cheval_grand_(umamusume)"] },
            { name: "Duramente", gender: "Mujer", tags: ["duramente_(umamusume)"] },
            { name: "Gentildonna", gender: "Mujer", tags: ["gentildonna_(umamusume)"] },
            { name: "Rice Shower", gender: "Mujer", tags: ["rice_shower_(umamusume)"] },
            { name: "King Halo", gender: "Mujer", tags: ["king_halo_(umamusume)"] },
            { name: "Seiun Sky", gender: "Mujer", tags: ["seiun_sky_(umamusume)"] },
            { name: "Taiki Shuttle", gender: "Mujer", tags: ["taiki_shuttle_(umamusume)"] },
            { name: "Smart Falcon", gender: "Mujer", tags: ["smart_falcon_(umamusume)"] },
            { name: "Curren Chan", gender: "Mujer", tags: ["curren_chan_(umamusume)"] },
            { name: "Fine Motion", gender: "Mujer", tags: ["fine_motion_(umamusume)"] },
            { name: "Twin Turbo", gender: "Mujer", tags: ["twin_turbo_(umamusume)"] },
            { name: "Sweep Tosho", gender: "Mujer", tags: ["sweep_tosho_(umamusume)"] },
            { name: "Winning Ticket", gender: "Mujer", tags: ["winning_ticket_(umamusume)"] },
            { name: "Nice Nature", gender: "Mujer", tags: ["nice_nature_(umamusume)"] },
            { name: "Matikanefukukitaru", gender: "Mujer", tags: ["matikanefukukitaru_(umamusume)"] },
            { name: "Biwa Hayahide", gender: "Mujer", tags: ["biwa_hayahide_(umamusume)"] },
            { name: "Narita Taishin", gender: "Mujer", tags: ["narita_taishin_(umamusume)"] },
            { name: "Narita Brian", gender: "Mujer", tags: ["narita_brian_(umamusume)"] },
            { name: "Mihono Bourbon", gender: "Mujer", tags: ["mihono_bourbon_(umamusume)"] },
            { name: "Inari One", gender: "Mujer", tags: ["inari_one_(umamusume)"] },
            { name: "Yukino Bijin", gender: "Mujer", tags: ["yukino_bijin_(umamusume)"] },
            { name: "Kawakami Princess", gender: "Mujer", tags: ["kawakami_princess_(umamusume)"] },
            { name: "Biko Pegasus", gender: "Mujer", tags: ["biko_pegasus_(umamusume)"] },
            { name: "Mr. C.B.", gender: "Mujer", tags: ["mr_c.b._(umamusume)"] },
            { name: "Tamamo Cross", gender: "Mujer", tags: ["tamamo_cross_(umamusume)"] },
            { name: "Oguri Cap", gender: "Mujer", tags: ["oguri_cap_(umamusume)"] },
            { name: "Heart's Cry", gender: "Mujer", tags: ["heart's_cry_(umamusume)"] },
            { name: "Air Shakur", gender: "Mujer", tags: ["air_shakur_(umamusume)"] },
            { name: "Yaeno Muteki", gender: "Mujer", tags: ["yaeno_muteki_(umamusume)"] },
            { name: "Sirius Symboli", gender: "Mujer", tags: ["sirius_symboli_(umamusume)"] },
            { name: "Sakura Laurel", gender: "Mujer", tags: ["sakura_laurel_(umamusume)"] },
            { name: "Eishin Flash", gender: "Mujer", tags: ["eishin_flash_(umamusume)"] },
            { name: "Admire Vega", gender: "Mujer", tags: ["admire_vega_(umamusume)"] },
            { name: "Copano Rickey", gender: "Mujer", tags: ["copano_rickey_(umamusume)"] },
            { name: "Wonder Acute", gender: "Mujer", tags: ["wonder_acute_(umamusume)"] },
            { name: "Shinko Windy", gender: "Mujer", tags: ["shinko_windy_(umamusume)"] },
            { name: "Daitaku Helios", gender: "Mujer", tags: ["daitaku_helios_(umamusume)"] },
            { name: "Daiichi Ruby", gender: "Mujer", tags: ["daiichi_ruby_(umamusume)"] },
            { name: "Wonder Lobby", gender: "Mujer", tags: ["wonder_lobby_(umamusume)"] },
            { name: "Tosen Jordan", gender: "Mujer", tags: ["tosen_jordan_(umamusume)"] },
            { name: "Danon Premium", gender: "Mujer", tags: ["danon_premium_(umamusume)"] },
            { name: "Symboli Kris S", gender: "Mujer", tags: ["symboli_kris_s_(umamusume)"] },
            { name: "Zenno Rob Roy", gender: "Mujer", tags: ["zenno_rob_roy_(umamusume)"] },
            { name: "Tap Dance City", gender: "Mujer", tags: ["tap_dance_city_(umamusume)"] },
            { name: "Cesario", gender: "Mujer", tags: ["cesario_(umamusume)"] },
            { name: "Gran Alegria", gender: "Mujer", tags: ["gran_alegria_(umamusume)"] },
            { name: "Almond Eye", gender: "Mujer", tags: ["almond_eye_(umamusume)"] },
            { name: "Fuji Kiseki", gender: "Mujer", tags: ["fuji_kiseki_(umamusume)"] },
            { name: "T M Opera O", gender: "Mujer", tags: ["t_m_opera_o_(umamusume)"] },
            { name: "Narita Top Road", gender: "Mujer", tags: ["narita_top_road_(umamusume)"] },
            { name: "Sakura Chiyono O", gender: "Mujer", tags: ["sakura_chiyono_o_(umamusume)"] },
            { name: "Air Messiah", gender: "Mujer", tags: ["air_messiah_(umamusume)"] },
            { name: "Sweep Tosho", gender: "Mujer", tags: ["sweep_tosho_(umamusume)"] },
        ]
    },
    {
        name: "Dragon Ball",
        tags: ["dragon_ball", "dragon_ball_z", "dragon_ball_super"],
        characters: [
            { name: "Bulma", gender: "Mujer", tags: ["bulma_(dragon_ball)"] },
            { name: "Chi Chi", gender: "Mujer", tags: ["chi_chi_(dragon_ball)"] },
            { name: "Android 18", gender: "Mujer", tags: ["android_18_(dragon_ball)"] },
            { name: "Videl", gender: "Mujer", tags: ["videl_(dragon_ball)"] },
            { name: "Pan", gender: "Mujer", tags: ["pan_(dragon_ball)"] },
            { name: "Bra", gender: "Mujer", tags: ["bra_(dragon_ball)"] },
            { name: "Launch", gender: "Mujer", tags: ["launch_(dragon_ball)"] },
            { name: "Kale", gender: "Mujer", tags: ["kale_(dragon_ball)"] },
            { name: "Caulifla", gender: "Mujer", tags: ["caulifla_(dragon_ball)"] },
            { name: "Kefla", gender: "Mujer", tags: ["kefla_(dragon_ball)"] },
            { name: "Android 21", gender: "Mujer", tags: ["android_21_(dragon_ball)"] },
            { name: "Towa", gender: "Mujer", tags: ["towa_(dragon_ball)"] },
            { name: "Zangya", gender: "Mujer", tags: ["zangya_(dragon_ball)"] },
            { name: "Mai", gender: "Mujer", tags: ["mai_(dragon_ball)"] },
            { name: "Goku", gender: "Hombre", tags: ["goku_(dragon_ball)"] },
            { name: "Vegeta", gender: "Hombre", tags: ["vegeta_(dragon_ball)"] },
            { name: "Gohan", gender: "Hombre", tags: ["gohan_(dragon_ball)"] },
            { name: "Trunks", gender: "Hombre", tags: ["trunks_(dragon_ball)"] },
            { name: "Piccolo", gender: "Hombre", tags: ["piccolo_(dragon_ball)"] },
            { name: "Frieza", gender: "Hombre", tags: ["frieza_(dragon_ball)"] },
            { name: "Cell", gender: "Hombre", tags: ["cell_(dragon_ball)"] },
            { name: "Majin Buu", gender: "Hombre", tags: ["majin_buu_(dragon_ball)"] },
            { name: "Beerus", gender: "Hombre", tags: ["beerus_(dragon_ball)"] },
            { name: "Broly", gender: "Hombre", tags: ["broly_(dragon_ball)"] },
            { name: "Jiren", gender: "Hombre", tags: ["jiren_(dragon_ball)"] },
            { name: "Goku Black", gender: "Hombre", tags: ["goku_black_(dragon_ball)"] },
            { name: "Krillin", gender: "Hombre", tags: ["krillin_(dragon_ball)"] },
        ]
    },
]

// ═══════════════════════════════════════════════════════════════
// SERIES DE ANILIST
// ═══════════════════════════════════════════════════════════════
const SERIES = [
    "Date A Live", "Sword Art Online", "Re:Zero", "Overlord",
    "No Game No Life", "Hunter x Hunter", "Demon Slayer", "Jujutsu Kaisen",
    "Attack on Titan", "Fairy Tail", "Naruto", "One Piece", "Dragon Ball",
    "Bleach", "Black Clover", "The Rising of the Shield Hero", "Konosuba",
    "That Time I Got Reincarnated as a Slime", "Highschool DxD", "Danmachi",
    "Tower of God", "Mushoku Tensei", "Chainsaw Man", "Spy x Family",
    "My Hero Academia", "Fullmetal Alchemist Brotherhood", "Steins;Gate", "Code Geass",
    "Neon Genesis Evangelion", "Cowboy Bebop", "Trigun", "Inuyasha",
    "Sailor Moon", "Dragon Ball Z", "Yu Yu Hakusho", "Rurouni Kenshin",
    "Ghost in the Shell", "Berserk", "Hellsing", "Death Note",
    "Elfen Lied", "Claymore", "Gurren Lagann", "Clannad", "Anohana",
    "Toradora", "Chuunibyou", "Angel Beats", "K-On", "Lucky Star",
    "The Melancholy of Haruhi Suzumiya", "Shakugan no Shana",
    "Log Horizon", "Accel World", "Arifureta", "Cautious Hero",
    "Isekai Maou to Shoukan Shoujo", "Skeleton Knight in Another World",
    "Trapped in a Dating Sim", "Seirei Gensouki", "Jobless Reincarnation",
    "I've Been Killing Slimes", "Ascendance of a Bookworm",
    "My Next Life as a Villainess", "Reincarnated as a Sword",
    "Black Lagoon", "Vinland Saga", "Dororo", "Goblin Slayer",
    "Made in Abyss", "Akame ga Kill", "Seven Deadly Sins",
    "The Promised Neverland", "Samurai Champloo", "Katekyo Hitman Reborn",
    "Fullmetal Alchemist", "Soul Eater", "Rosario to Vampire",
    "To Love Ru", "Highschool of the Dead",
    "Is It Wrong to Try to Pick Up Girls in a Dungeon",
    "Quintessential Quintuplets", "Rent-a-Girlfriend", "Domestic Girlfriend",
    "My Dress-Up Darling", "Kaguya-sama Love is War", "Oregairu",
    "Nisekoi", "Citrus", "Blend S", "Gabriel DropOut",
    "Eromanga Sensei", "Monster Musume", "Trinity Seven",
    "Prison School", "Food Wars",
    "Fruits Basket", "Ouran Host Club", "Vampire Knight",
    "Cardcaptor Sakura", "Darling in the FranXX", "Cross Ange",
    "Parasyte", "Tokyo Ghoul", "Another", "Higurashi",
    "Mirai Nikki", "Deadman Wonderland",
    "Haikyuu", "Kuroko no Basket", "Yuri on Ice",
    "Puella Magi Madoka Magica", "Strike Witches", "Symphogear",
    "Oshi no Ko", "Frieren Beyond Journey's End",
    "Jujutsu Kaisen Season 2", "Dr Stone", "Fire Force",
    "Toilet Bound Hanako-kun", "Lycoris Recoil",
    "Classroom of the Elite", "Blue Lock", "Bocchi the Rock",
    "Eminence in Shadow", "Dungeon Meshi", "Solo Leveling", "Kaiju No 8",
]

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
async function main() {
    console.clear()
    console.log('\n╔════════════════════════════════════════════╗')
    console.log('║   🎮 SHIROKO — POBLADOR v2.1 (ADVANCED) 🎮 ║')
    console.log('║   Gacha Character Database Builder v2.1    ║')
    console.log('╚════════════════════════════════════════════╝\n')

    const stats = {
        duplicadosEliminados: 0,
        personajesRefrescados: 0,
        personajesNuevos: 0,
        imagenesFallidas: 0,
        tiempoInicio: Date.now()
    }

    const cache = new CacheManager()
    const validator = new URLValidator()

    // Cargar cache
    await cache.cargar()

    // Cargar JSON existente
    let json = {}
    try {
        const data = await fs.readFile(CONFIG.FILE_PATH, 'utf-8')
        json = JSON.parse(data)
        logger.info(`characters.json cargado. Series: ${Object.keys(json).length}`)
    } catch {
        logger.warn('No se encontró characters.json, se creará uno nuevo.')
    }

    // ── PASO 1: DEDUPLICAR ──────────────────────────────────
    console.log('\n━━━ PASO 1: DEDUPLICANDO ━━━')
    for (const key of Object.keys(json)) {
        const antes = json[key].characters?.length || 0
        json[key].characters = deduplicarSerie(json[key].characters || [])
        const despues = json[key].characters.length
        if (antes !== despues) {
            const eliminados = antes - despues
            logger.info(`${json[key].name}: -${eliminados} duplicados`)
            stats.duplicadosEliminados += eliminados
        }
    }

    // ── PASO 2: REFRESCAR EXISTENTES ────────────────────────
    console.log('\n━━━ PASO 2: REFRESCANDO IMÁGENES ━━━')
    let nextSeriesKey = getNextSeriesKey(json)
    let nextCharId = getNextCharId(json)
    const nombresGlobales = new Set()

    for (const series of Object.values(json)) {
        for (const char of (series.characters || [])) {
            nombresGlobales.add(char.name.toLowerCase().trim())
        }
    }

    if (CONFIG.SOLO_NUEVOS) {
        console.log('(saltado por SOLO_NUEVOS)')
    } else for (const key of Object.keys(json)) {
        const serie = json[key]
        const serieTag = (serie.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_')
        logger.info(`${serie.name} (${serie.characters?.length || 0} personajes)`)

        for (const char of (serie.characters || [])) {
            const esMujer = char.gender === 'Mujer'
            const nameForSearch = (char.tags?.[0] || char.name.toLowerCase().replace(/\s+/g, '_'))
            process.stdout.write(`   ↻ ${char.name.padEnd(25)} | `)

            try {
                char.img = await buscarImagenes(nameForSearch, serieTag, serie.name, esMujer, cache, validator)
                stats.personajesRefrescados++
                console.log(' ✓')
            } catch (err) {
                logger.error(`Error en ${char.name}: ${err.message}`)
                stats.imagenesFallidas++
                console.log(' ✗')
            }

            await fs.writeFile(CONFIG.FILE_PATH, JSON.stringify(json, null, 2))
            await new Promise(r => setTimeout(r, CONFIG.DELAY_MS))
        }
    }

    // ── PASO 3: SERIES MANUALES ────────────────────────────
    console.log('\n━━━ PASO 3: SERIES MANUALES ━━━')
    for (const serieManual of SERIES_MANUALES) {
        const serieTag = serieManual.name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_')
        let seriesKey = Object.keys(json).find(k => (json[k].name || '').toLowerCase() === serieManual.name.toLowerCase())

        if (!seriesKey) {
            seriesKey = String(nextSeriesKey++)
            json[seriesKey] = { name: serieManual.name, tags: serieManual.tags, characters: [] }
            logger.info(`+ Serie nueva: ${serieManual.name}`)
        }

        const seriesObj = json[seriesKey]
        if (!seriesObj.characters) seriesObj.characters = []

        for (const charDef of serieManual.characters) {
            const nombreNorm = charDef.name.toLowerCase().trim()
            if (nombresGlobales.has(nombreNorm)) continue

            nombresGlobales.add(nombreNorm)
            const nameForSearch = charDef.tags[0] || nombreNorm.replace(/\s+/g, '_')
            const esMujer = charDef.gender === 'Mujer'

            process.stdout.write(`   + ${charDef.name.padEnd(25)} | `)

            try {
                const imgs = await buscarImagenes(nameForSearch, serieTag, serieManual.name, esMujer, cache, validator)
                seriesObj.characters.push({
                    id: String(nextCharId++),
                    name: charDef.name,
                    gender: charDef.gender,
                    tags: charDef.tags,
                    value: 15000,
                    img: imgs
                })
                stats.personajesNuevos++
                console.log(' ✓')
            } catch (err) {
                logger.error(`Error en ${charDef.name}: ${err.message}`)
                stats.imagenesFallidas++
                console.log(' ✗')
            }

            await fs.writeFile(CONFIG.FILE_PATH, JSON.stringify(json, null, 2))
            await new Promise(r => setTimeout(r, CONFIG.DELAY_MS))
        }
    }
    // ── PASO 4: SERIES VÍA JIKAN ───────────────────────────
    console.log('\n━━━ PASO 4: SERIES (Jikan/MAL) ━━━')
    for (const serieName of SERIES) {
        const data = await fetchJikanSerie(serieName, cache)
        if (!data) {
            logger.warn(`Sin datos de Jikan para "${serieName}"`)
            continue
        }

        const titulo = data.titulo
        const serieTag = titulo.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_')
        const personajes = data.personajes

        if (personajes.length === 0) continue

        let seriesKey = Object.keys(json).find(k => {
            const n = (json[k].name || '').toLowerCase()
            return n === titulo.toLowerCase() || n === serieName.toLowerCase()
        })

        if (!seriesKey) {
            seriesKey = String(nextSeriesKey++)
            json[seriesKey] = { name: titulo, tags: [serieTag], characters: [] }
            logger.info(`+ Serie nueva: ${titulo}`)
        }

        const seriesObj = json[seriesKey]
        if (!seriesObj.characters) seriesObj.characters = []

        for (const p of personajes) {
            const nombreCompleto = p.name
            const nombreNorm = nombreCompleto.toLowerCase().trim()
            if (nombresGlobales.has(nombreNorm)) continue

            nombresGlobales.add(nombreNorm)
            const nameForSearch = nombreNorm.replace(/\s+/g, '_')
            const gender = p.gender === 'Female' ? 'Mujer' : p.gender === 'Male' ? 'Hombre' : 'Desconocido'
            const esMujer = gender === 'Mujer'
            const valor = calcularValor(p.favourites || 0)

            process.stdout.write(`   + ${nombreCompleto.padEnd(25)} | `)

            try {
                const imgs = await buscarImagenes(nameForSearch, serieTag, titulo, esMujer, cache, validator)
                seriesObj.characters.push({
                    id: String(nextCharId++),
                    name: nombreCompleto,
                    gender,
                    tags: [nameForSearch, serieTag],
                    value: valor,
                    img: imgs
                })
                stats.personajesNuevos++
                console.log(` ✓ (${valor.toLocaleString()})`)
            } catch (err) {
                logger.error(`Error en ${nombreCompleto}: ${err.message}`)
                stats.imagenesFallidas++
                console.log(' ✗')
            }

            await fs.writeFile(CONFIG.FILE_PATH, JSON.stringify(json, null, 2))
            await new Promise(r => setTimeout(r, CONFIG.DELAY_MS))
        }
    }

    // ── RESUMEN FINAL ──────────────────────────────────────
    const tiempoTotal = ((Date.now() - stats.tiempoInicio) / 1000).toFixed(2)
    console.log('\n╔════════════════════════════════════════════╗')
    console.log(`║  ✓ Refrescados: ${String(stats.personajesRefrescados).padEnd(5)}`)
    console.log(`║  + Nuevos: ${String(stats.personajesNuevos).padEnd(13)}`)
    console.log(`║  - Duplicados: ${String(stats.duplicadosEliminados).padEnd(9)}`)
    console.log(`║  ✗ Errores: ${String(stats.imagenesFallidas).padEnd(12)}`)
    console.log(`║  ⏱ Tiempo total: ${tiempoTotal}s`)
    console.log('║  ✓ characters.json guardado')
    console.log('║  ✓ Cache guardado')
    console.log('║  ✓ Backup creado')
    console.log('╚════════════════════════════════════════════╝\n')
}

main().catch(err => {
    logger.error('Error crítico:', err.message)
    process.exit(1)
})