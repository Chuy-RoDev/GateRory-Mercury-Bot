import { promises as fs } from 'fs'
import fetch from 'node-fetch'
import axios from 'axios'

const FILE_PATH = './src/json/characters.json'
const MAX_IMG_POR_PERSONAJE = 20
const DELAY_MS = 1200

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

const SERIES_MANUALES = [
    {
        name: "Vocaloid",
        tags: ["vocaloid", "virtual_singer"],
        characters: [
            { name: "Hatsune Miku", gender: "Mujer", tags: ["hatsune_miku", "miku"] },
            { name: "Kagamine Rin", gender: "Mujer", tags: ["kagamine_rin", "rin"] },
            { name: "Kagamine Len", gender: "Hombre", tags: ["kagamine_len", "len"] },
            { name: "Megurine Luka", gender: "Mujer", tags: ["megurine_luka", "luka"] },
            { name: "KAITO", gender: "Hombre", tags: ["kaito", "kaito_vocaloid"] },
            { name: "MEIKO", gender: "Mujer", tags: ["meiko", "meiko_vocaloid"] },
            { name: "Gumi", gender: "Mujer", tags: ["gumi", "megpoid"] },
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
            { name: "Ayaka", gender: "Mujer", tags: ["kamisato_ayaka"] },
            { name: "Fischl", gender: "Mujer", tags: ["fischl_(genshin_impact)"] },
            { name: "Nahida", gender: "Mujer", tags: ["nahida_(genshin_impact)"] },
            { name: "Nilou", gender: "Mujer", tags: ["nilou_(genshin_impact)"] },
            { name: "Furina", gender: "Mujer", tags: ["furina_(genshin_impact)"] },
            { name: "Zhongli", gender: "Hombre", tags: ["zhongli_(genshin_impact)"] },
            { name: "Kazuha", gender: "Hombre", tags: ["kaedehara_kazuha"] },
        ]
    },
    {
        name: "Honkai Star Rail",
        tags: ["honkai_star_rail", "starrail"],
        characters: [
            { name: "Stelle", gender: "Mujer", tags: ["stelle_(honkai_star_rail)"] },
            { name: "Bronya", gender: "Mujer", tags: ["bronya_(honkai_star_rail)"] },
            { name: "Seele", gender: "Mujer", tags: ["seele_(honkai_star_rail)"] },
            { name: "Kafka", gender: "Mujer", tags: ["kafka_(honkai_star_rail)"] },
            { name: "Silver Wolf", gender: "Mujer", tags: ["silver_wolf_(honkai_star_rail)"] },
            { name: "Jingliu", gender: "Mujer", tags: ["jingliu_(honkai_star_rail)"] },
            { name: "Robin", gender: "Mujer", tags: ["robin_(honkai_star_rail)"] },
            { name: "Firefly", gender: "Mujer", tags: ["firefly_(honkai_star_rail)"] },
            { name: "Acheron", gender: "Mujer", tags: ["acheron_(honkai_star_rail)"] },
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
        ]
    },
    {
        name: "Fate Series",
        tags: ["fate", "fate_stay_night", "fate_grand_order"],
        characters: [
            { name: "Saber Artoria", gender: "Mujer", tags: ["artoria_pendragon"] },
            { name: "Rin Tohsaka", gender: "Mujer", tags: ["tohsaka_rin"] },
            { name: "Medusa Rider", gender: "Mujer", tags: ["medusa_(fate)"] },
            { name: "Tamamo no Mae", gender: "Mujer", tags: ["tamamo_no_mae_(fate)"] },
            { name: "Scathach", gender: "Mujer", tags: ["scathach_(fate)"] },
            { name: "Jeanne d'Arc", gender: "Mujer", tags: ["jeanne_d'arc_(fate)"] },
            { name: "Nero Claudius", gender: "Mujer", tags: ["nero_claudius_(fate)"] },
            { name: "Gilgamesh", gender: "Hombre", tags: ["gilgamesh_(fate)"] },
        ]
    },
    {
        name: "League of Legends",
        tags: ["league_of_legends", "lol"],
        characters: [
            { name: "Ahri", gender: "Mujer", tags: ["ahri_(league_of_legends)"] },
            { name: "Jinx", gender: "Mujer", tags: ["jinx_(league_of_legends)"] },
            { name: "Lux", gender: "Mujer", tags: ["lux_(league_of_legends)"] },
            { name: "Miss Fortune", gender: "Mujer", tags: ["miss_fortune_(league_of_legends)"] },
            { name: "Akali", gender: "Mujer", tags: ["akali_(league_of_legends)"] },
            { name: "Seraphine", gender: "Mujer", tags: ["seraphine_(league_of_legends)"] },
            { name: "Kai'Sa", gender: "Mujer", tags: ["kaisa_(league_of_legends)"] },
            { name: "Evelynn", gender: "Mujer", tags: ["evelynn_(league_of_legends)"] },
        ]
    },
    {
        name: "Touhou Project",
        tags: ["touhou"],
        characters: [
            { name: "Reimu Hakurei", gender: "Mujer", tags: ["hakurei_reimu"] },
            { name: "Marisa Kirisame", gender: "Mujer", tags: ["kirisame_marisa"] },
            { name: "Remilia Scarlet", gender: "Mujer", tags: ["remilia_scarlet"] },
            { name: "Flandre Scarlet", gender: "Mujer", tags: ["flandre_scarlet"] },
            { name: "Sakuya Izayoi", gender: "Mujer", tags: ["izayoi_sakuya"] },
            { name: "Youmu Konpaku", gender: "Mujer", tags: ["konpaku_youmu"] },
            { name: "Yukari Yakumo", gender: "Mujer", tags: ["yakumo_yukari"] },
            { name: "Cirno", gender: "Mujer", tags: ["cirno"] },
            { name: "Koishi Komeiji", gender: "Mujer", tags: ["komeiji_koishi"] },
        ]
    },
    {
        name: "Nikke Goddess of Victory",
        tags: ["nikke"],
        characters: [
            { name: "Rapi", gender: "Mujer", tags: ["rapi_(nikke)"] },
            { name: "Anis", gender: "Mujer", tags: ["anis_(nikke)"] },
            { name: "Neon", gender: "Mujer", tags: ["neon_(nikke)"] },
            { name: "Scarlet", gender: "Mujer", tags: ["scarlet_(nikke)"] },
        ]
    },
    {
        name: "Azur Lane",
        tags: ["azur_lane"],
        characters: [
            { name: "Enterprise", gender: "Mujer", tags: ["enterprise_(azur_lane)"] },
            { name: "Belfast", gender: "Mujer", tags: ["belfast_(azur_lane)"] },
            { name: "Atago", gender: "Mujer", tags: ["atago_(azur_lane)"] },
            { name: "Prinz Eugen", gender: "Mujer", tags: ["prinz_eugen_(azur_lane)"] },
            { name: "Akagi", gender: "Mujer", tags: ["akagi_(azur_lane)"] },
            { name: "Taihou", gender: "Mujer", tags: ["taihou_(azur_lane)"] },
        ]
    },
]

function calcularValor(favourites) {
    if (!favourites || favourites === 0) return 1000
    if (favourites < 100)    return 2000
    if (favourites < 500)    return 5000
    if (favourites < 1000)   return 8000
    if (favourites < 5000)   return 12000
    if (favourites < 10000)  return 18000
    if (favourites < 30000)  return 25000
    if (favourites < 60000)  return 40000
    if (favourites < 100000) return 60000
    return 100000
}

// ── LIMITE: 3 safebooru, 5 r34, resto pinterest ─────────────
async function fetchSafebooru(name, serieTag) {
    const variantes = [`${name}_(${serieTag})`, name]
    for (const tag of variantes) {
        const url = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tag)}&limit=5`
        try {
            const res = await fetch(url, { timeout: 8000 })
            const data = await res.json()
            if (Array.isArray(data) && data.length > 0) {
                return data.slice(0, 3).map(p => `https://safebooru.org//images/${p.directory}/${p.image}?${p.id}`).filter(Boolean)
            }
        } catch { continue }
    }
    return []
}

async function fetchRule34(name, serieTag) {
    const partes = name.split('_')
    const invertido = partes.length >= 2 ? `${partes.slice(1).join('_')}_${partes[0]}` : name
    const variantes = [`${name}_(${serieTag})`, name, invertido]
    const API_KEY = 'causa-ee5ee31dcfc79da4'
    const API_BASE = 'https://rest.apicausas.xyz/api/v1/nsfw/descargas/rule34'
    let acumuladas = []
    for (const tag of variantes) {
        if (acumuladas.length >= 5) break
        try {
            const url = `${API_BASE}?tags=${encodeURIComponent(tag)}&apikey=${API_KEY}`
            const res = await fetch(url, { timeout: 8000 })
            const json = await res.json()
            if (json.status && json.data?.results?.length > 0) {
                const urls = json.data.results.map(p => p.file_url).filter(u => u && /\.(jpe?g|png|webp)$/i.test(u))
                acumuladas = [...new Set([...acumuladas, ...urls])]
            }
        } catch { continue }
        await new Promise(r => setTimeout(r, 300))
    }
    return acumuladas.slice(0, 5)
}

async function fetchPinterest(name, serieName) {
    const nameClean = name.replace(/\(.*\)/g, '').replace(/_/g, ' ').trim()
    const query = `${nameClean} ${serieName} anime`

    try {
        const res = await axios.get(`https://rest.apicausas.xyz/api/v1/buscadores/pinterest`, {
            params: {
                q: query,
                apikey: 'causa-ee5ee31dcfc79da4'
            },
            timeout: 8000
        })

        const data = res.data

        if (data.status && Array.isArray(data.data)) {
            return data.data
                .map(item => item.image)
                .filter(url => url && typeof url === 'string')
                .slice(0, 12)
        }

        return []
    } catch {
        return []
    }
}

async function fetchAniListSeries(serieName) {
    const query = `
    query ($search: String) {
        Media(search: $search, type: ANIME) {
            id
            title { romaji english native }
            characters(sort: FAVOURITES_DESC, perPage: 50) {
                nodes { id name { full } gender favourites }
            }
        }
    }`
    try {
        const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query, variables: { search: serieName } }),
            timeout: 10000
        })
        const json = await res.json()
        return json?.data?.Media || null
    } catch (e) {
        console.error(`   AniList error para "${serieName}": ${e.message}`)
        return null
    }
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

// ── NUEVA LOGICA DE IMAGENES: 3 safe + 5 r34 + resto pinterest
async function buscarImagenes(nameForSearch, serieTag, serieName, esMujer) {
    const safe = await fetchSafebooru(nameForSearch, serieTag)  // max 3
    const r34 = esMujer ? await fetchRule34(nameForSearch, serieTag) : []  // max 5
    const pin = await fetchPinterest(nameForSearch, serieName)  // rellena hasta 20

    const combinadas = new Set([...safe, ...r34, ...pin])
    const final = [...combinadas].slice(0, MAX_IMG_POR_PERSONAJE)

    process.stdout.write(`Safe:${safe.length} R34:${esMujer ? r34.length : 'skip'} Pin:${pin.length} → ${final.length} imgs`)
    return final
}

// ── DEDUPLICAR personajes dentro de una serie ────────────────
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

async function main() {
    console.log('\n╔══════════════════════════════════════╗')
    console.log('║   SHIROKO — POBLADOR v3 (REFRESH)    ║')
    console.log('╚══════════════════════════════════════╝\n')
    console.log('⚠ MODO REFRESH: borra imágenes viejas y busca nuevas.')
    console.log('  Límites: 3 Safebooru | 5 R34 | resto Pinterest\n')

    let json = {}
    try {
        const data = await fs.readFile(FILE_PATH, 'utf-8')
        json = JSON.parse(data)
        console.log(`✓ characters.json cargado. Series: ${Object.keys(json).length}`)
    } catch {
        console.log('⚠ No se encontró characters.json, se creará uno nuevo.')
    }

    // ── PASO 1: DEDUPLICAR TODO EL JSON EXISTENTE ───────────
    console.log('\n━━━ PASO 1: DEDUPLICANDO ━━━')
    let totalDuplicados = 0
    for (const key of Object.keys(json)) {
        const antes = json[key].characters?.length || 0
        json[key].characters = deduplicarSerie(json[key].characters || [])
        const despues = json[key].characters.length
        if (antes !== despues) {
            console.log(`   Eliminados ${antes - despues} duplicados en: ${json[key].name}`)
            totalDuplicados += antes - despues
        }
    }
    console.log(`✓ Total duplicados eliminados: ${totalDuplicados}`)
    await fs.writeFile(FILE_PATH, JSON.stringify(json, null, 2))

    let nextSeriesKey = getNextSeriesKey(json)
    let nextCharId = getNextCharId(json)
    let totalRefrescados = 0
    let totalNuevos = 0

    const nombresGlobales = new Set()
    for (const series of Object.values(json)) {
        for (const char of (series.characters || [])) {
            nombresGlobales.add(char.name.toLowerCase().trim())
        }
    }

    // ── PASO 2: REFRESCAR IMAGENES DE TODOS LOS EXISTENTES ──
    console.log('\n━━━ PASO 2: REFRESCANDO IMÁGENES EXISTENTES ━━━')
    for (const key of Object.keys(json)) {
        const serie = json[key]
        const serieTag = (serie.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_')
        console.log(`\n━━━ ${serie.name} ━━━`)

        for (const char of (serie.characters || [])) {
            const esMujer = char.gender === 'Mujer'
            const nameForSearch = (char.tags?.[0] || char.name.toLowerCase().replace(/\s+/g, '_'))
            process.stdout.write(`   ↻ ${char.name.padEnd(25)} | `)

            // Borrar imágenes viejas y buscar nuevas
            char.img = await buscarImagenes(nameForSearch, serieTag, serie.name, esMujer)
            totalRefrescados++
            console.log(' ✓')

            await fs.writeFile(FILE_PATH, JSON.stringify(json, null, 2))
            await new Promise(r => setTimeout(r, DELAY_MS))
        }
    }

    // ── PASO 3: AGREGAR SERIES MANUALES NUEVAS ──────────────
    console.log('\n━━━ PASO 3: SERIES MANUALES NUEVAS ━━━')
    for (const serieManual of SERIES_MANUALES) {
        const serieTag = serieManual.name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_')
        let seriesKey = Object.keys(json).find(k => (json[k].name || '').toLowerCase() === serieManual.name.toLowerCase())

        if (!seriesKey) {
            seriesKey = String(nextSeriesKey++)
            json[seriesKey] = { name: serieManual.name, tags: serieManual.tags, characters: [] }
            console.log(`\n+ Serie nueva: ${serieManual.name}`)
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

            const imgs = await buscarImagenes(nameForSearch, serieTag, serieManual.name, esMujer)
            seriesObj.characters.push({
                id: String(nextCharId++),
                name: charDef.name,
                gender: charDef.gender,
                tags: charDef.tags,
                value: 15000,
                img: imgs
            })
            totalNuevos++
            console.log(' ✓')
            await fs.writeFile(FILE_PATH, JSON.stringify(json, null, 2))
            await new Promise(r => setTimeout(r, DELAY_MS))
        }
    }

    // ── PASO 4: AGREGAR SERIES DE ANILIST NUEVAS ────────────
    console.log('\n━━━ PASO 4: SERIES DE ANILIST NUEVAS ━━━')
    for (const serieName of SERIES) {
        const mediaData = await fetchAniListSeries(serieName)
        if (!mediaData) continue

        const titulo = mediaData.title.english || mediaData.title.romaji || serieName
        const serieTag = titulo.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_')
        const personajes = mediaData.characters?.nodes || []
        if (personajes.length === 0) continue

        let seriesKey = Object.keys(json).find(k => {
            const n = (json[k].name || '').toLowerCase()
            return n === titulo.toLowerCase() || n === serieName.toLowerCase()
        })

        if (!seriesKey) {
            seriesKey = String(nextSeriesKey++)
            json[seriesKey] = { name: titulo, tags: [serieTag], characters: [] }
            console.log(`\n+ Serie nueva: ${titulo}`)
        }

        const seriesObj = json[seriesKey]
        if (!seriesObj.characters) seriesObj.characters = []

        for (const charNode of personajes) {
            const nombreCompleto = charNode.name?.full
            if (!nombreCompleto) continue
            const nombreNorm = nombreCompleto.toLowerCase().trim()
            if (nombresGlobales.has(nombreNorm)) continue

            nombresGlobales.add(nombreNorm)
            const nameForSearch = nombreNorm.replace(/\s+/g, '_')
            const gender = charNode.gender === 'Female' ? 'Mujer' : charNode.gender === 'Male' ? 'Hombre' : 'Desconocido'
            const esMujer = gender === 'Mujer'
            const valor = calcularValor(charNode.favourites || 0)

            process.stdout.write(`   + ${nombreCompleto.padEnd(25)} | `)
            const imgs = await buscarImagenes(nameForSearch, serieTag, titulo, esMujer)

            seriesObj.characters.push({
                id: String(nextCharId++),
                name: nombreCompleto,
                gender,
                tags: [nameForSearch, serieTag],
                value: valor,
                img: imgs
            })
            totalNuevos++
            console.log(` ✓ (${valor.toLocaleString()})`)
            await fs.writeFile(FILE_PATH, JSON.stringify(json, null, 2))
            await new Promise(r => setTimeout(r, DELAY_MS))
        }
    }

    console.log('\n╔══════════════════════════════════════╗')
    console.log(`║  Refrescados: ${String(totalRefrescados).padEnd(5)} Nuevos: ${String(totalNuevos).padEnd(8)}  ║`)
    console.log(`║  Duplicados eliminados: ${String(totalDuplicados).padEnd(14)}  ║`)
    console.log('║  characters.json guardado con exito  ║')
    console.log('╚══════════════════════════════════════╝\n')
}

main().catch(console.error)