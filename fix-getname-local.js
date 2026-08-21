import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const commandsDir = path.join(__dirname, 'src', 'commands')

function processFile(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf-8')
        let modified = false

        // Busca la definición de getName y la reemplaza
        if (content.includes('const getName =') || content.includes('let getName =')) {
            // Reemplaza cualquier función getName local
            content = content.replace(
                /(?:const|let) getName = (?:async \(jid\)|global\.getProperName\.bind\([^)]*\)|function[^{]*|[^=]+) => \{[^}]*\}/gs,
                'const getName = async (jid) => await global.getProperName(conn, jid)'
            )
            modified = true
        }

        if (modified) {
            fs.writeFileSync(filePath, content, 'utf-8')
            return true
        }
        return false
    } catch (error) {
        return false
    }
}

function walkDir(dir) {
    let processed = 0, modified = 0

    const files = fs.readdirSync(dir)
    for (const file of files) {
        const filePath = path.join(dir, file)
        const stat = fs.statSync(filePath)

        if (stat.isDirectory()) {
            const { processed: p, modified: m } = walkDir(filePath)
            processed += p
            modified += m
        } else if (file.endsWith('.js')) {
            processed++
            if (processFile(filePath)) {
                modified++
                console.log(`✓ ${file}`)
            }
        }
    }

    return { processed, modified }
}

console.log('Reemplazando funciones getName locales...\n')
const { processed, modified } = walkDir(commandsDir)
console.log(`\n✅ Procesados: ${processed} | Modificados: ${modified}`)
