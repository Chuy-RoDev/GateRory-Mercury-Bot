/*
* Comandos Google Search Híbrido
* Créditos: Arlette Xz
*/
import axios from 'axios'
import * as cheerio from 'cheerio'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
const DEFAULT_MAX = 10 
const HARD_MAX = 15 
const PAGE_MAX = 1 

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function fetchGoogleImagesPage (query, pageIndex = 0) {
  const params = new URLSearchParams({
    q: query,
    tbm: 'isch',
    hl: 'es',
    gl: 'us',
    ijn: String(pageIndex)
  })
  const url = `https://www.google.com/search?${params.toString()}`
  const { data: html } = await axios.get(url, {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Referer': 'https://www.google.com/'
    },
    timeout: 15000 
  })
  return html
}

function extractWebUrls (html) {
  const $ = cheerio.load(html)
  const results = []

  const scriptTexts = $('script')
    .map((_, el) => $(el).html() || '')
    .get()
    .join(' ')

  try {
    const jsonBlocks = scriptTexts.match(/\{[^\{]*?"ou"\s*:\s*"https?:\/\/[^"']*?"[^}]*?\}/g) || []
    for (const block of jsonBlocks) {
      try {
        const ouMatch = block.match(/"ou"\s*:\s*"(https?:\/\/[^"']*?)"/)
        const ptMatch = block.match(/"pt"\s*:\s*"([^"']*?)"/)
        const stMatch = block.match(/"s"\s*:\s*"([^"']*?)"/)
        if (ouMatch) {
          const url = ouMatch[1]
          if (!url.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i)) {
            try {
              const domain = new URL(url).hostname
              const title = ptMatch ? ptMatch[1] : domain
              const snippet = stMatch ? stMatch[1] : ''
              results.push({ title, link: url, description: snippet })
            } catch {}
          }
        }
      } catch {}
    }
  } catch (e) {
    console.error('[gweb] Error analizando scripts:', e.message)
  }

  $('a[href]').each((_, el) => {
    const $a = $(el)
    const href = $a.attr('href')
    if (!href) return
    let url = href
    if (href.startsWith('/url?')) {
      try {
        const params = new URLSearchParams(href.split('?')[1])
        const q = params.get('q')
        if (q) url = q
      } catch {}
    }
    if (/^https?:\/\//.test(url) && !url.includes('google.com') && !url.includes('gstatic.com')) {
      try {
        const urlObj = new URL(url)
        const domain = urlObj.hostname
        const title = ($a.text().trim() || $a.attr('title') || domain).slice(0, 160)
        let description = ''
        const parentText = $a.parent().text().trim()
        if (parentText && parentText.length > title.length + 20) description = parentText.slice(0, 220)
        results.push({ title, link: url, description: description })
      } catch {}
    }
  })


  const seen = new Set()
  return results.filter(r => {
    try {
      const u = new URL(r.link)
      const key = u.origin + u.pathname
      if (seen.has(key)) return false
      seen.add(key)
      return true
    } catch { return false }
  })
}

async function hybridSearch (query, maxResults = DEFAULT_MAX) {
  const results = []
  let page = 0
  const target = Math.min(maxResults, HARD_MAX)
  
  while (results.length < target && page < PAGE_MAX) {
    try {
      const html = await fetchGoogleImagesPage(query, page)
      const pageResults = extractWebUrls(html)
      
      for (const r of pageResults) {
        if (results.length < target) results.push(r)
        else break
      }
      
      if (pageResults.length === 0) break
      page++
      
      if (results.length < target && page < PAGE_MAX) {
        await sleep(1000 + Math.floor(Math.random() * 500))
      }
    } catch (e) {
      console.error('[gweb] Error en la búsqueda híbrida:', e.message)
      break
    }
  }
  
  const excludeDomains = [
    'google.com', 'gstatic.com', 'googleapis.com', 'googleusercontent.com',
    'googleadservices.com', 'youtube.com', 'youtu.be', 'ggpht.com'
  ]
  
  const filtered = results.filter(r => {
    try {
      const u = new URL(r.link)
      if (u.pathname === '/' || u.pathname === '') return false
      return !excludeDomains.some(d => u.hostname.includes(d))
    } catch { return false }
  })
  
  const ranked = filtered
    .sort((a, b) => ((b.title ? 2 : 0) + (b.description ? 1 : 0)) - ((a.title ? 2 : 0) + (a.description ? 1 : 0)))
    .slice(0, target)
    
  return ranked
}

let handler = async (m, { conn, text, usedPrefix, command, args }) => {
    const ctx = (typeof global.rcanalr === 'object') ? global.rcanalr : ((typeof global.rcanal === 'object') ? global.rcanal : {})
    const ctxErr = (global.rcanalx || {});

    const displayPrefix = usedPrefix || ''; 
    const exampleText = `${displayPrefix}${command} gatos curiosos`;
    const emptyMessage = `ꕤ Por favor, proporciona el término de búsqueda que deseas realizar a *Google*.\n\nEjemplo: ${exampleText}`;

    // --- Validación de texto de búsqueda reforzada ---
    const rawText = (text || '').trim();
    const commandText = (displayPrefix + command).toLowerCase();

    // Si el texto está vacío O si el texto es exactamente igual al comando (ej: ":google")
    if (!rawText || rawText.toLowerCase() === commandText || rawText.toLowerCase() === command) {
        return m.reply(emptyMessage, m, ctx)
    }
    // -------------------------------------------------
    
    let query = rawText;
    let maxResults = DEFAULT_MAX;

    const parts = query.split(/\s+/);
    let lastPart = parts[parts.length - 1]?.toLowerCase();
    
    if (/^\d+$/.test(lastPart)) {
        maxResults = parseInt(lastPart, 10);
        
        if (maxResults > HARD_MAX) maxResults = HARD_MAX;
        if (maxResults <= 0) maxResults = DEFAULT_MAX;
        
        parts.pop();
        query = parts.join(' ').trim();
    }
    
    // Comprobación final si la consulta quedó vacía después de quitar el número
    if (!query) {
        return m.reply(emptyMessage, m, ctx)
    }


    try {
        
        const results = await hybridSearch(query, maxResults)

        if (!results.length) {
            return m.reply('ꕤ No se encontraron resultados para esa búsqueda.', m, ctx)
        }
        
        let replyMessage = `✦ Resultados de la búsqueda para: *${query}*\n\n`
        results.forEach((item, index) => {
            replyMessage += `❀ Título: *${index + 1}. ${item.title || 'Sin título'}*\n`
            
            // Omitir la línea si no hay descripción
            if (item.description && item.description.trim() !== '') {
                replyMessage += `✐︎ Descripción: *${item.description}*\n`
            }
            
            replyMessage += `🜸 URL: ${item.link || '_Sin url_'}\n\n`
        })
        
        await conn.reply(m.chat, replyMessage.trim(), m, ctx)

    } catch (error) {
        console.error('[gweb-adaptado] Error:', error)
        m.reply(`⚠︎ Se ha producido un problema al realizar la búsqueda.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message || 'Error desconocido'}.`, m, ctxErr)
    }
}

handler.help = ['google']
handler.tags = ['buscador']
handler.command = ['google', 'gweb', 'websearch']
handler.group = true

export default handler