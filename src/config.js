import { watchFile, unwatchFile } from "fs"
import chalk from "chalk"
import { fileURLToPath } from "url"
import fs from "fs"
import moment from "moment-timezone"

// ─────────────────────────────
//  SISTEMA DE FECHA Y HORA
// ─────────────────────────────
global.timezone = 'America/Bogota'
global.d = new Date(new Date().toLocaleString("en-US", {timeZone: global.timezone}))
global.locale = 'es'
global.dia = d.toLocaleDateString(locale, { weekday: 'long' })
global.fecha = d.toLocaleDateString('es', { day: 'numeric', month: 'numeric', year: 'numeric' })
global.mes = d.toLocaleDateString('es', { month: 'long' })
global.tiempo = d.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true })

// ─────────────────────────────
//  SISTEMA DE SESIÓN DINÁMICA (FIX RUTAS)
// ─────────────────────────────
const sessionArgIndex = process.argv.indexOf('--session')
const sessionName = sessionArgIndex !== -1 ? process.argv[sessionArgIndex + 1] : "Principal"

global.sessions = `Sessions/${sessionName}`
global.databaseName = "database.json"

if (!fs.existsSync(`./${global.sessions}`)) {
    fs.mkdirSync(`./${global.sessions}`, { recursive: true })
}

// ─────────────────────────────
//  CONFIGURACIÓN PRINCIPAL
// ─────────────────────────────
global.botNumber = ""
global.owner = ["573114910796", "573237649689", "819095203873", "584142921488"]
global.suittag = ["+584142921488"]
global.prems = []
global.prefix = [":", "💙", "/"]
global.libreria = "Multi Device"
global.vs = "1.5"
global.languaje = 'Español'
global.nameqr = "Rory "
global.apikey = 'Arlette-Xz'
global.jadi = "Sessions/SubBot"
global.RoryMercurybot = true

// ─────────────────────────────
//  CONFIG INFORMACIÓN DEL BOT
// ─────────────────────────────
global.botname = "Rory Mercury"
global.textbot = "made by Arlette Xz"
global.dev = "© powered by Arlette Xz"
global.author = "© made by Arlette Xz"
global.etiqueta = "Arlette-Xz, Modeado por Pérez/Chuy"
global.currency = "Soul-Coins 🖤"

// Link del repositorio base original
global.linkrepo = "https://github.com/Arlette-Xz/Shiroko-Bot/"

// ─────────────────────────────
//  IMÁGENES DEL BOT
// ─────────────────────────────
global.banner = fs.readFileSync('./src/assets/banner.jpg')
global.icono = fs.readFileSync('./src/assets/menu.jpg')
global.catalogo = fs.readFileSync('./src/assets/menu.jpg')
global.logo = fs.readFileSync('./src/RoryMercury.jpg')

// ─────────────────────────────
//  CONFIG WELCOME
// ─────────────────────────────
global.welcomeConfig = {
    background: fs.readFileSync('./src/assets/welcome-bg.jpg'),
    defaultAvatar: fs.readFileSync('./src/assets/default-avatar.jpg'),
    apiBase: "https://api.siputzx.my.id/api/canvas",
    timeout: 8000
}

// ─────────────────────────────
//  REDES SOCIALES
// ─────────────────────────────
global.canalNombre = "✰ 𝗠𝗶𝗱𝗻𝗶𝗴𝗵𝘁 𝗦𝗼𝗰𝗶𝗲𝘁𝘆 - 𝗢𝗳𝗶𝗰𝗶𝗮𝗹 𝗖𝗵𝗮𝗻𝗻𝗲𝗹"
global.group = "https://chat.whatsapp.com/IvoOUwblfUhLPGTO4uN1z2node index.js -- --session Chuy"
global.channel = ""
global.github = "https://github.com/Arlette-Xz/Shiroko-Bot"
global.gmail = "arlette.x7z@gmail.com"
global.ch = {
    ch1: "120363403176894973@newsletter"
}

// ─────────────────────────────
//  APIs
// ─────────────────────────────
global.APIs = {
    xyro: { url: "https://api.xyro.site", key: null },
    yupra: { url: "https://api.yupra.my.id", key: null },
    vreden: { url: "https://api.vreden.web.id", key: null },
    delirius: { url: "https://api.delirius.store", key: null },
    zenzxz: { url: "https://api.zenzxz.my.id", key: null },
    siputzx: { url: "https://api.siputzx.my.id", key: null },
    ephoto360: { url: "https://en.ephoto360.com", key: null },
    adonix: { url: "https://api-adonix.ultraplus.click", key: 'Arlette-Xz' }
}

// ─────────────────────────────
//  CONFIG FUNCIONES
// ─────────────────────────────
global.modes = {
    self: false,
    autoread: false,
    jadibotmd: true,
    welcome: false,
    detect: false,
    antilink: false,
    nsfw: false,
    economy: true,
    gacha: true,
    modoadmin: false
}

// ─────────────────────────────
//  MENSAJES DEL SISTEMA
// ─────────────────────────────
global.msg = {
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

// ─────────────────────────────
//  CONFIGURACIÓN DE OPCIONES GLOBALES
// ─────────────────────────────
global.opts = {
    onlycc: false,
    self: false,
    autoread: false,
    pconly: false,
    gconly: false,
    swonly: false,
    queque: false
}

// ─────────────────────────────
//  HELPER: MONEDA POR GRUPO
// ─────────────────────────────
global.getUserCurrency = (chatId) => {
    return global.db.data?.chats?.[chatId]?.currency || global.currency
}

// ─────────────────────────────
//  SISTEMA DE ACTUALIZACIÓN
// ─────────────────────────────
let file = fileURLToPath(import.meta.url)
watchFile(file, () => {
    unwatchFile(file)
    console.log(chalk.blue("ꕤ config.js actualizado"))
    import(`${file}?update=${Date.now()}`)
})