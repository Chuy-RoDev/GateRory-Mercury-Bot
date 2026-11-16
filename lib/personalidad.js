// ─────────────────────────────────────────────────────────────
//  PERSONALIDAD DEL BOT: Rory Mercury ↔ bot genérico
//
//  Dos packs de textos:
//   · generico → los textos actuales del bot, 1:1 (estado neutro)
//   · rory     → los mismos mensajes con la voz de Rory Mercury
//    (Gate: Jieitai Kanochi nite, Kaku Tatakaeri — apóstol de Emroy,
//     dios de la muerte y la violencia: solemne al hablar de la muerte,
//     coqueta y juguetona con los mortales de confianza, sadista en
//     batalla, soberbia cuando la tratan de niña pese a sus 961 años)
//
//  El modo se guarda en src/json/personalidad.json y se aplica en vivo
//  sobre global.msg (sin reiniciar). /personalidad rory | generico
// ─────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const RUTA = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'json', 'personalidad.json')
const MODOS = ['rory', 'generico']

// Textos actuales del bot (copia literal de global.msg en src/config.js).
// intocable NO se toca: pertenece a la zona del gacha (protegerwaifu).
const generico = {
    rowner: "ꕤ Este comando solo puede ser usado por los *creadores* del bot.",
    owner: "ꕤ Este comando solo puede ser utilizado por los *desarrolladores* del bot.",
    mods: "ꕤ Comando exclusivo para *moderadores*",
    premium: "ꕤ Solo usuarios *premium* puedes usar este comando.",
    group: "ꕤ Este comando solo funciona en *grupos*",
    private: "ꕤ Usa este comando en el chat *privado*",
    admin: "ꕤ Solo *administradores* del grupo",
    botAdmin: "ꕤ Necesito ser *administrador*",
    restrict: "ꕤ Esta característica está desactivada",
    aviso: "ꕤ *Bot desactivado*\n\n» Usa: *${usedPrefix}bot on*",
    mensaje: "ꕤ *Usuario baneado*\n\n» Razón: ${bannedReason}",
    intocable: "⚠️ **¡ALTO AHÍ!** No eres el/la novi@. Aléjate de/la patron/a o te aniquilo."
}

// Los mismos mensajes, con la voz de Rory Mercury.
const rory = {
    rowner: "ꕤ Fufufu~ ¿un mortal intentando comandar a la apóstol de *Emroy*? Esto solo responde a los *creadores* de este ejército.",
    owner: "ꕤ Hn~ solo los *desarrolladores* tienen mi permiso para invocar esto. No me hagas desenfundar la halberd por algo tan trivial.",
    mods: "ꕤ Este comando es solo para mis *moderadores*. Los demás mortales, en fila~",
    premium: "ꕤ Fufufu~ solo los mortales *premium* cargan con mi bendición. Ofrece un tributo digno y ya veré.",
    group: "ꕤ Hn~ esto solo funciona dentro de un *grupo*. La calma del chat privado me aburre.",
    private: "ꕤ Esto se conversa a solas, mortal... ve al chat *privado* y allí te atiendo.",
    admin: "ꕤ Solo los *administradores* del grupo dan órdenes aquí. Yo solo peleo para quien gobierna este campo de batalla.",
    botAdmin: "ꕤ Ni la apóstol mueve una lanza sin ser *administradora* del grupo. Concédemelo y todo fluirá.",
    restrict: "ꕤ Esta función está sellada por decreto de los dioses (desactivada).",
    aviso: "ꕤ *La apóstol descansa* (bot desactivado)\n\n» Despiértame con: *${usedPrefix}bot on*",
    mensaje: "ꕤ *Mortal desterrado de este dominio*\n\n» Razón: ${bannedReason}",
    // zona gacha: se respeta tal cual en ambos modos
    intocable: generico.intocable
}

const PACKS = { rory, generico }

function getModo() {
    try {
        const j = JSON.parse(readFileSync(RUTA, 'utf8'))
        return MODOS.includes(j.modo) ? j.modo : 'rory'
    } catch {
        return 'rory'
    }
}

function setModo(modo) {
    if (!MODOS.includes(modo)) throw new Error(`Modo inválido: ${modo}`)
    try {
        mkdirSync(dirname(RUTA), { recursive: true })
        writeFileSync(RUTA, JSON.stringify({ modo }, null, 2))
    } catch { /* sin persistencia no rompe, el modo vive hasta reiniciar */ }
    return modo
}

// Sobrescribe global.msg con el pack activo (en vivo, sin reiniciar)
function aplicar() {
    if (!global.msg) return
    const pack = PACKS[getModo()] || PACKS.generico
    for (const k of Object.keys(pack)) global.msg[k] = pack[k]
}

// Saludo del menú según el modo (main-menu.js)
function saludoMenu(username, botname) {
    if (getModo() === 'rory') {
        return `「🗡️」 Fufufu~ ¿quién anda por aquí? Bienvenid@ al campo de batalla, *${username}*. Yo soy *${botname}*, apóstol de Emroy a tu servicio.\n> No temas a la muerte... teme aburrirme. Aquí tienes mis comandos.`
    }
    return `「🖤」 ¡Hola! *${username}*, Soy *${botname}*\n> Aquí tienes la lista de comandos.`
}

// Frases de sabor para las reacciones (nsfw-reactions.js) — solo modo rory
const FRASES_REACCION = [
    'Fufufu~ qué mortales tan atrevidos... me agrada.',
    'La apóstol observa con agrado~',
    'Kukuku~ ¿pervertidos? Yo solo soy una dama refinada apreciando el arte.',
    'Hn~ la carne es débil, pero entretiene. Sigan.',
    'Ufufu~ por cosas así vale la pena ser inmortal.',
    '¡Que la sangre... digo, que la diversión siga!~'
]
function fraseReaccion() {
    return FRASES_REACCION[Math.floor(Math.random() * FRASES_REACCION.length)]
}

export { PACKS, getModo, setModo, aplicar, saludoMenu, fraseReaccion }
