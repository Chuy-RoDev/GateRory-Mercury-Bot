// src/commands/editchar.js
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

let handler = async (m, { conn, args, text, usedPrefix, command }) => {
    const id = args[0]
    if (!id) return m.reply(`Uso: ${usedPrefix}${command} <ID> [gender Hombre/Mujer/Ambos] [value <numero>]`)

    // Leer characters.json
    const charPath = join(__dirname, '../json/characters.json')
    let charData
    try {
        charData = JSON.parse(readFileSync(charPath, 'utf-8'))
    } catch (e) {
        return m.reply('Error leyendo characters.json')
    }

    // Buscar por ID en todas las series
    let found = null
    for (const series of Object.values(charData)) {
        const char = series.characters?.find(c => c.id === id)
        if (char) { found = char; break }
    }
    if (!found) return m.reply(`No encontre personaje con ID ${id}`)

    // Parsear pares key valor despues del ID
    const pairs = text.trim().split(/\s+/).slice(1)
    const changes = {}

    for (let i = 0; i < pairs.length; i += 2) {
        const key = pairs[i]?.toLowerCase()
        const val = pairs[i + 1]
        if (!key || !val) continue

        if (key === 'gender') {
            const valid = ['Hombre', 'Mujer', 'Ambos']
            const normalized = valid.find(g => g.toLowerCase() === val.toLowerCase())
            if (!normalized) return m.reply(`Genero invalido. Usa: Hombre, Mujer o Ambos`)
            changes.gender = normalized
        } else if (key === 'value') {
            const num = parseInt(val)
            if (isNaN(num) || num < 0) return m.reply(`Valor invalido: ${val}`)
            changes.value = num
        }
    }

    if (!Object.keys(changes).length)
        return m.reply(`No especificaste nada para cambiar.\nUso: ${usedPrefix}${command} <ID> [gender Hombre/Mujer/Ambos] [value <numero>]`)

    // Aplicar y guardar en characters.json
    Object.assign(found, changes)
    try {
        writeFileSync(charPath, JSON.stringify(charData, null, 2), 'utf-8')
    } catch (e) {
        return m.reply('Error guardando characters.json')
    }

    // Si el personaje esta en db runtime, sincronizar value tambien
    if (changes.value && global.db.data.characters?.[id]) {
        global.db.data.characters[id].value = changes.value
        await global.db.write()
    }

    const lista = Object.entries(changes).map(([k, v]) => `• ${k}: ${v}`).join('\n')
    await m.react('✔️')
    m.reply(`*Editado:* ${found.name} (${id})\n${lista}`)
}

handler.help = ['editchar <ID> [gender valor] [value numero]']
handler.tags = ['config']
handler.command = ['editchar']
handler.owner = true

export default handler