// Cooldown POR COMANDO+CHAT para los comandos pesados (llegan como álbumes de
// WhatsApp o hacen muchas descargas). El anti-flood general por usuario ya lo
// hace lib/antiban.js; esto es un freno adicional por chat para que un grupo
// entero no dispare 50 medios cada 2 segundos (riesgo de ban).
//
// Se configura en un solo sitio: mapa de segundos por comando.
// Los owners y premium nunca se limitan.
//
// ⏱ Para ajustar tiempos: toca COOLDOWNS aquí (o define global.cooldowns
// desde otro archivo con { r34: 30 } para sobreescribir puntuales).
const COOLDOWNS_BASE = {
    r34: 45, rule34: 45, rule: 45,
    r34vid: 45, rule34vid: 45, rulevid: 45,
}

const ultimaVez = new Map() // 'chat|comando' → timestamp

const checkCooldown = (command, chatId, { isROwner, isOwner, isPrems } = {}) => {
    if (isROwner || isOwner || isPrems) return { ok: true }
    const mapa = { ...COOLDOWNS_BASE, ...(global.cooldowns || {}) }
    const espera = mapa[command]
    if (!espera) return { ok: true }
    const clave = `${chatId || ''}|${command}`
    const ahora = Date.now()
    const previa = ultimaVez.get(clave) || 0
    const restan = Math.ceil((previa + espera * 1000 - ahora) / 1000)
    if (ahora - previa < espera * 1000) return { ok: false, restan }
    ultimaVez.set(clave, ahora)
    return { ok: true }
}

export default checkCooldown
export { checkCooldown, COOLDOWNS_BASE }
