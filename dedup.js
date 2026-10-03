// ============================================================
// SHIROKO — LIMPIADOR DE DUPLICADOS
// Detecta y elimina personajes duplicados en characters.json
// Uso: node dedup.js
// ============================================================

import { promises as fs } from 'fs'

const FILE_PATH = './src/json/characters.json'

async function main() {
    console.log('\n╔══════════════════════════════════════╗')
    console.log('║  Rory-Bot — LIMPIADOR DE DUPLICADOS  ║')
    console.log('╚══════════════════════════════════════╝\n')

    const data = await fs.readFile(FILE_PATH, 'utf-8')
    const json = JSON.parse(data)

    const nombresVistos = new Map() // nombre_norm → { serieKey, index }
    const idsVistos = new Set()

    let totalDuplicados = 0
    let totalEliminados = 0

    console.log('Analizando duplicados...\n')

    for (const [serieKey, serie] of Object.entries(json)) {
        if (!Array.isArray(serie.characters)) continue

        const aEliminar = [] // indices a eliminar en esta serie

        for (let i = 0; i < serie.characters.length; i++) {
            const char = serie.characters[i]
            const nombreNorm = (char.name || '').toLowerCase().trim()
            const charId = String(char.id || '')

            // Duplicado por ID
            if (charId && idsVistos.has(charId)) {
                console.log(`  ✗ [ID duplicado] "${char.name}" (id: ${charId}) en serie "${serie.name}" — eliminando`)
                aEliminar.push(i)
                totalDuplicados++
                continue
            }

            // Duplicado por nombre
            if (nombresVistos.has(nombreNorm)) {
                const original = nombresVistos.get(nombreNorm)
                console.log(`  ✗ [nombre duplicado] "${char.name}" en "${serie.name}" — ya existe en "${original.serie}"`)
                aEliminar.push(i)
                totalDuplicados++
                continue
            }

            nombresVistos.set(nombreNorm, { serie: serie.name, serieKey, index: i })
            if (charId) idsVistos.add(charId)
        }

        // Eliminar en orden inverso para no romper indices
        for (let i = aEliminar.length - 1; i >= 0; i--) {
            serie.characters.splice(aEliminar[i], 1)
            totalEliminados++
        }
    }

    if (totalDuplicados === 0) {
        console.log('✓ No se encontraron duplicados. El archivo está limpio.\n')
        return
    }

    // Guardar
    await fs.writeFile(FILE_PATH, JSON.stringify(json, null, 2))

    console.log('\n╔══════════════════════════════════════╗')
    console.log(`║  Duplicados encontrados: ${String(totalDuplicados).padEnd(13)} ║`)
    console.log(`║  Eliminados:             ${String(totalEliminados).padEnd(13)} ║`)
    console.log('║  characters.json guardado con exito  ║')
    console.log('╚══════════════════════════════════════╝\n')
}

main().catch(console.error)