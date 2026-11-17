// Registro de errores de plugins. Antes varios catch tragaban los errores en
// silencio (.catch(() => null), catch (e) {}) y solo la consola mostraba algo
// (sin decir QUÉ plugin falló). Ahora:
//  1) console.error CON nombre del plugin y hora (sigue siendo la guía en Cloud Shell)
//  2) append a tmp/plugin-errors.log (historial para revisar simulaciones)
//  3) aviso al owner por WhatsApp con dedupe (reutiliza notifyOwner de antiban,
//     que ya evita repetir el mismo aviso en menos de 1 hora)
import { mkdirSync, appendFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const LOG = join(dirname(fileURLToPath(import.meta.url)), '..', 'tmp', 'plugin-errors.log')

const logPluginError = (pluginName, err, conn = null) => {
    const hora = new Date().toLocaleTimeString('es', { hour12: false })
    const mensaje = err?.message || String(err)

    // 1) consola: visible para el dueño (Cloud Shell), ahora identifica el plugin
    console.error(`[PLUGIN-ERROR] ${hora} · ${pluginName} · ${mensaje}`)
    console.error(err)

    // 2) archivo de historial (best-effort; nunca debe tumbar el bot)
    try {
        mkdirSync(dirname(LOG), { recursive: true })
        const pila = (err?.stack || '').split('\n').slice(1, 3).join(' | ').trim()
        appendFileSync(LOG, `${new Date().toISOString()} | ${pluginName} | ${mensaje}${pila ? ' | ' + pila : ''}\n`)
    } catch { /* sin permiso de escritura: no pasa nada */ }

    // 3) aviso al owner (dedupe de antiban evita el bombardeo)
    try {
        if (conn && global.__antiban?.notifyOwner) {
            global.__antiban.notifyOwner(conn, `⚠︎ *Plugin con error*\n\n» Archivo: ${pluginName}\n» Hora: ${hora}\n» ${mensaje}\n\n> El bot sigue funcionando. Revisa la consola o ${'tmp/plugin-errors.log'}.`)
        }
    } catch { /* el aviso no es crítico */ }
}

export default logPluginError
export { logPluginError }
