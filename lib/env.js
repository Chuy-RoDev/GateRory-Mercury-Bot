// Cargador de .env sin dependencias. Debe ser el PRIMER import de index.js
// (antes de src/config.js) para que las variables existan cuando el bot lea
// OWNER_NUMBERS / R34_API_KEY. Reglas:
//  · lee el .env de la raíz del repo si existe
//  · NUNCA sobreescribe variables que ya vienen del entorno real
//  · si algo falla, el bot arranca igual (valores de respaldo del código)
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

try {
    const ruta = join(dirname(fileURLToPath(import.meta.url)), '..', '.env')
    if (existsSync(ruta)) {
        for (const linea of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
            const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(linea)
            if (!m || linea.trim().startsWith('#')) continue
            const clave = m[1]
            let valor = m[2]
            if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
                valor = valor.slice(1, -1)
            }
            if (process.env[clave] === undefined) process.env[clave] = valor
        }
    }
} catch { /* sin .env el bot usa los respaldos del código */ }
