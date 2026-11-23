// _r34flow.js — RUTA 1 de las respuestas del flujo /r34 (respuestas sueltas
// SIN comando: "1", "videos", "1,3", "cancelar"...). TODA la lógica vive en
// manejarRespuesta() de lib/r34flow.js — este archivo solo la invoca.
// La RUTA 2 (/r34 <respuesta>, en nsfw-rule34.js) pasa por el mismo camino que
// el comando, y funciona aunque este módulo before no se llegue a ejecutar.
// Nunca devuelve true: no corta el procesamiento de otros plugins.
import { manejarRespuesta } from '../../lib/r34flow.js'

export async function before(m, { conn }) {
    if (!m?.text || m.fromMe || !m.chat) return
    try {
        await manejarRespuesta(conn, m, m.text)
    } catch { /* nunca rompe el flujo de otros plugins */ }
}
