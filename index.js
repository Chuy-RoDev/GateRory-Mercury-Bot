process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1'

import './src/config.js'
import './src/commands/main-allfake.js'
import cfonts from 'cfonts'
import { createRequire } from 'module'
import { fileURLToPath, pathToFileURL } from 'url'
import { platform } from 'process'
import fs, { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'fs'
import path, { join } from 'path'
import yargs from 'yargs'
import { Low, JSONFile } from 'lowdb'
import lodash from 'lodash'
import chalk from 'chalk'
import { execSync } from 'child_process'
import { roryJadiBot } from './src/commands/sockets-serbot.js'

const { chain } = lodash

global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') {
    return rmPrefix ? /file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL : pathToFileURL(pathURL).toString()
}
global.__dirname = function dirname(pathURL) {
    return path.dirname(global.__filename(pathURL, true))
}
global.__require = function require(dir = import.meta.url) {
    return createRequire(dir)
}

global.timestamp = { start: new Date() }
const __dirname = global.__dirname(import.meta.url)

global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse())

const sessionArg = global.opts['session']
if (sessionArg) {
    global.sessions = `Sessions/${sessionArg}`
}

global.sessions = path.resolve(__dirname, global.sessions || 'Sessions')
global.jadi     = path.resolve(__dirname, global.jadi || 'jadibts')

const credsFile = join(global.sessions, 'creds.json')
let sessionReady = false
if (existsSync(credsFile)) {
    try {
        const raw = readFileSync(credsFile, 'utf-8').trim()
        if (raw) { JSON.parse(raw); sessionReady = true }
    } catch {}
}
if (sessionReady && !process.argv.includes('qr') && !process.argv.includes('code')) {
    process.argv.push('code')
}

setTimeout(async () => {
    try {
        const zr1Module = await import('zr1-optimizer')
        global.zr1 = zr1Module.zr1 || zr1Module.default
        if (global.zr1 && typeof global.zr1.optimize === 'function') {
            global.zr1.optimize({ memory: true, performance: true, cache: true, connection: true })
        }
    } catch (e) {}
}, 2000)

let { say } = cfonts
console.clear()
console.log(chalk.hex('#00FFFF')('╔══════════════════════════════╗'))
console.log(chalk.hex('#00FFFF').bold('║   🖤 Rory Mercury - BOT  ║'))
console.log(chalk.hex('#00FFFF')('╚══════════════════════════════╝'))

function verificarFFmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function asegurarFFmpeg() {
  if (verificarFFmpeg()) {
    console.log(chalk.hex('#00FFFF')('✓ ffmpeg detectado en el sistema'))
    return true
  }

  console.log(chalk.yellow('⚠ ffmpeg no encontrado. Instalando automáticamente...'))
  try {
    execSync('sudo apt-get update -y && sudo apt-get install -y ffmpeg', { stdio: 'inherit' })
    if (verificarFFmpeg()) {
      console.log(chalk.hex('#00FFFF')('✓ ffmpeg instalado correctamente'))
      return true
    }
  } catch (e) {
    console.log(chalk.red('✗ Error durante la instalación de ffmpeg: ' + e.message))
  }
  return false
}

asegurarFFmpeg()

let prefixArray = Array.isArray(global.prefix) ? global.prefix : [global.prefix || ':']
let escapedPrefix = prefixArray.map(p => p.replace(/[|\\^$.*+?()[\]{}!]/g, '\\$&')).join('|')
global.prefix = new RegExp(`^(${escapedPrefix})`)

const databaseDir = join(__dirname, 'src/database')
if (!existsSync(databaseDir)) {
    mkdirSync(databaseDir, { recursive: true })
}

global.db = new Low(
    /https?:\/\//.test(global.opts['db'] || '') ?
    new cloudDBAdapter(global.opts['db']) :
    new JSONFile(join(databaseDir, 'database.json'))
)
global.DATABASE = global.db

global.loadDatabase = async function loadDatabase() {
    if (global.db.READ) {
        return new Promise((resolve) => {
            const helperInterval = setInterval(async function () {
                if (!global.db.READ) {
                    clearInterval(helperInterval)
                    resolve(global.db.data == null ? global.loadDatabase() : global.db.data)
                }
            }, 500)
        })
    }
    if (global.db.data !== null) return
    global.db.READ = true
    await global.db.read().catch(console.error)
    global.db.READ = null

    global.db.data = {
        users: {},
        chats: {},
        stats: {},
        msgs: {},
        sticker: {},
        settings: {},
        ...(global.db.data || {}),
    }

    global.db.chain = chain(global.db.data)
}

loadDatabase().then(() => {
    // FIX: si main.js fallaba al cargar (sin red, creds corruptas...), el error solo se
    // logeaba y el proceso quedaba vivo como zombie (sin bot y sin reinicio del supervisor).
    // Ahora salimos con código 1 para que start.sh/pm2 lo reinicie.
    import('./main.js').catch(e => {
        console.error(chalk.red('✗ ERROR FATAL al cargar main.js:'), e)
        process.exit(1)
    })
    console.log(chalk.hex('#00FFFF')('✓ Base de datos cargada correctamente'))

    // Reconexión de Sub-Bots en segundo plano al iniciar
    // FIX: global.jadi ya es ruta absoluta (path.resolve más arriba); el join anterior
    // generaba una ruta anidada inexistente y la reconexión nunca encontraba las sesiones
    global.rutaJadiBot = global.jadi
    if (existsSync(global.rutaJadiBot)) {
        const readRutaJadiBot = readdirSync(global.rutaJadiBot)
        if (readRutaJadiBot.length > 0) {
            console.log(chalk.rgb(180, 20, 20)(`→ Detectadas ${readRutaJadiBot.length} sesiones Sub-Bot. Reconectando...`))
            for (const gjbts of readRutaJadiBot) {
                const botPath = join(global.rutaJadiBot, gjbts)
                if (existsSync(botPath) && statSync(botPath).isDirectory()) {
                    const creds = join(botPath, 'creds.json')
                    if (existsSync(creds)) {
                        setTimeout(async () => {
                            // FIX: si main.js aún no creó global.conn (import lento), la
                            // reconexión usaba conn=undefined y fallaba en silencio.
                            // Esperamos hasta 60s a que el bot principal esté listo.
                            for (let i = 0; i < 12 && !global.conn?.user; i++) {
                                await new Promise(r => setTimeout(r, 5000))
                            }
                            try {
                                await roryJadiBot({
                                    pathSubBot: botPath,
                                    m: { sender: gjbts + '@s.whatsapp.net', chat: gjbts + '@s.whatsapp.net' },
                                    conn: global.conn,
                                    args: [],
                                    usedPrefix: '/',
                                    command: 'qr',
                                    fromCommand: false
                                })
                            } catch (e) {
                                console.error(chalk.red(`[SUB-BOT] Reconexión fallida para ${gjbts}:`), e.message)
                            }
                        }, 10000)
                    }
                }
            }
        }
    }
}).catch(console.error)