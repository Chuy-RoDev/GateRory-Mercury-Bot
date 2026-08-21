import { readdirSync, existsSync, readFileSync, watch } from 'fs'
import { join, resolve } from 'path'
import { format } from 'util'
import syntaxerror from 'syntax-error'
import importFile from './import.js'
import Helper from './helper.js'

const __dirname = Helper.__dirname(import.meta)
const commandsFolder = Helper.__dirname(join(__dirname, '.src/commands/index'))
const commandFilter = filename => /\.(mc)?js$/.test(filename)

let watcher, commands, commandFolders = []
watcher = commands = {}

async function initCommands(folder = commandsFolder, filter = commandFilter, conn) {
    const dir = resolve(folder)
    if (dir in watcher) return
    commandFolders.push(dir)

    await Promise.all(readdirSync(dir).filter(filter).map(async filename => {
        try {
            let file = globalThis.__filename(join(dir, filename))
            const module = await import(file)
            if (module) commands[filename] = 'default' in module ? module.default : module
        } catch (e) {
            conn?.logger.error(e)
            delete commands[filename]
        }
    }))

    const watching = watch(dir, reload.bind(null, conn, dir, filter))
    watching.on('close', () => removeCommandFolder(dir, true))
    watcher[dir] = watching

    return commands
}

function removeCommandFolder(folder, isClosed = false) {
    const resolved = resolve(folder)
    if (!(resolved in watcher)) return
    if (!isClosed) watcher[resolved].close()
    delete watcher[resolved]
    commandFolders.splice(commandFolders.indexOf(resolved), 1)
}

async function reload(conn, commandFolder = commandsFolder, filter = commandFilter, event, filename) {
    if (filter(filename)) {
        let dir = globalThis.__filename(join(commandFolder, filename), true)
        if (filename in commands) {
            if (existsSync(dir)) conn.logger.info(`Comando actualizado - '${filename}'`)
            else {
                conn?.logger.warn(`Comando eliminado - '${filename}'`)
                return delete commands[filename]
            }
        } else conn?.logger.info(`Nuevo comando - '${filename}'`)
        
        let err = syntaxerror(readFileSync(dir), filename, {
            sourceType: 'module',
            allowAwaitOutsideFunction: true
        })
        
        if (err) conn.logger.error(`Error de sintaxis en '${filename}'\n${format(err)}`)
        else {
            try {
                const module = await importFile(globalThis.__filename(dir)).catch(console.error)
                if (module) commands[filename] = module
            } catch (e) {
                conn?.logger.error(`Error cargando comando '${filename}'\n${format(e)}'`)
            } finally {
                commands = Object.fromEntries(Object.entries(commands).sort(([a], [b]) => a.localeCompare(b)))
            }
        }
    }
}

export { 
    commandsFolder, 
    commandFilter, 
    commands, 
    watcher, 
    commandFolders, 
    initCommands, 
    removeCommandFolder, 
    reload 
}