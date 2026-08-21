import fs from 'fs'
import path from 'path'

// Cargar los mensajes desde el archivo JSON
const jsonPath = path.join(process.cwd(), 'src', 'json', 'messages.json')
const mensajes = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))

let handler = async (m, { conn, usedPrefix, command }) => {
    
    // Asignar las listas a nombres cortos para el switch-case
    const slut = mensajes.slut
    const trabajo = mensajes.trabajo
    const crimen = mensajes.crimen
    const eventosCazar = mensajes.cazar
    const eventosPescar = mensajes.pescar
    const cofres = mensajes.cofres
    const eventosMinar = mensajes.minar
    const aventuras = mensajes.aventura
    const eventosDungeon = mensajes.mazmorra

    if (!global.db.data.chats[m.chat].economy && m.isGroup) {
        return m.reply(`ꕤ Los comandos de *Economía* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con el comando:\n» *${usedPrefix}economy on*`)
    }

    const userCurrency = global.getUserCurrency ? global.getUserCurrency(m.sender) : global.currency
    let user = global.db.data.users[m.sender]

    if (!user) {
        global.db.data.users[m.sender] = { coin: 0, exp: 0, health: 100, lastHunt: 0, lastslut: 0, lastwork: 0, lastcrime: 0, lastFish: 0, lastcofre: 0, lastmine: 0, pickaxedurability: 100, lastAdventure: 0, lastDungeon: 0 }
        user = global.db.data.users[m.sender]
    }
    user.coin = user.coin || 0
    user.exp = user.exp || 0
    user.health = user.health || 100
    user.lastslut = user.lastslut || 0
    user.lastwork = user.lastwork || 0
    user.lastcrime = user.lastcrime || 0
    user.lastHunt = user.lastHunt || 0
    user.lastFish = user.lastFish || 0
    user.lastcofre = user.lastcofre || 0
    user.lastmine = user.lastmine || 0
    user.pickaxedurability = user.pickaxedurability || 100
    user.lastAdventure = user.lastAdventure || 0
    user.lastDungeon = user.lastDungeon || 0

    const now = Date.now()

    switch (command) {
        case 'slut':
        case 'prostituirse': {
            const cooldown = 5 * 60 * 1000
            
            if (now < user.lastslut) {
                const restante = user.lastslut - now
                const tiempoRestante = formatTimeMs(restante)
                return conn.reply(m.chat, `ꕤ Debes esperar *${tiempoRestante}* para usar *${usedPrefix + command}* de nuevo.`, m, (global.rcanalr || {}))
            }
            
            user.lastslut = now + cooldown
            const evento = pickRandom(slut)
            let cantidad
            
            if (evento.tipo === 'victoria') {
                cantidad = Math.floor(Math.random() * 1501) + 4000
                user.coin += cantidad
            } else {
                cantidad = Math.floor(Math.random() * 1001) + 3000
                user.coin -= cantidad
                if (user.coin < 0) user.coin = 0
            }
            
            const mensaje = `ꕤ ${evento.mensaje} *$${cantidad.toLocaleString()} ${userCurrency}*`
            await conn.reply(m.chat, mensaje, m, (global.rcanalr || {}))
            await global.db.write()
            break
        }
        
        case 'w':
        case 'work':
        case 'chambear':
        case 'chamba':
        case 'trabajar': {
            const cooldown = 2 * 60 * 1000
            if (now < user.lastwork) {
                const tiempoRestante = formatTimeMs(user.lastwork - now)
                return conn.reply(m.chat, `ꕤ Debes esperar *${tiempoRestante}* para usar *${usedPrefix + command}* de nuevo.`, m, (global.rcanalr || {}))
            }
            user.lastwork = now + cooldown
            let rsl = Math.floor(Math.random() * 1501) + 2000
            await conn.reply(m.chat, `ꕤ ${pickRandom(trabajo)} *$${rsl.toLocaleString()} ${userCurrency}*.`, m, (global.rcanalr || {}))
            user.coin += rsl
            await global.db.write()
            break
        }

        case 'crimen':
        case 'crime': {
            const cooldown = 8 * 60 * 1000
            if (now < user.lastcrime) {
                const restante = user.lastcrime - now
                const wait = formatTimeMs(restante)
                return conn.reply(m.chat, `ꕤ Debes esperar *${wait}* para usar *${usedPrefix + command}* de nuevo.`, m)
            }
            user.lastcrime = now + cooldown
            const evento = pickRandom(crimen)
            let cantidad
            if (evento.tipo === 'victoria') {
                cantidad = Math.floor(Math.random() * 1501) + 6000
                user.coin += cantidad
            } else {
                cantidad = Math.floor(Math.random() * 1501) + 4000
                user.coin -= cantidad
                if (user.coin < 0) user.coin = 0
            }
            await conn.reply(m.chat, `ꕤ ${evento.mensaje} *$${cantidad.toLocaleString()} ${userCurrency}*`, m)
            await global.db.write()
            break
        }

        case 'cazar':
        case 'hunt': {
            const cooldown = 15 * 60 * 1000
            
            if (user.health < 5)
                return conn.reply(m.chat, `ꕤ No tienes suficiente salud para volver a *cazar*.\n> Usa *"${usedPrefix}heal"* para curarte.`, m)
            
            if (now < user.lastHunt) {
                const restante = user.lastHunt - now
                return conn.reply(m.chat, `ꕤ Debes esperar *${formatTimeMs(restante)}* para usar *${usedPrefix + command}* de nuevo.`, m)
            }
            
            user.lastHunt = now + cooldown
            const evento = pickRandom(eventosCazar)
            let monedas, experiencia, salud
            
            if (evento.tipo === 'victoria') {
                monedas = Math.floor(Math.random() * 10001) + 1000
                experiencia = Math.floor(Math.random() * 91) + 30
                salud = Math.floor(Math.random() * 5) + 3
                user.coin += monedas
                user.exp += experiencia
                user.health -= salud
            } else {
                monedas = Math.floor(Math.random() * 2001) + 4000
                experiencia = Math.floor(Math.random() * 41) + 30
                salud = Math.floor(Math.random() * 5) + 3
                user.coin -= monedas
                user.exp -= experiencia
                user.health -= salud
                if (user.coin < 0) user.coin = 0
                if (user.exp < 0) user.exp = 0
            }
            
            if (user.health < 0) user.health = 0
            
            conn.reply(m.chat, `ꕤ ${evento.mensaje} *$${monedas.toLocaleString()} ${userCurrency}*`, m)
            await global.db.write()
            break
        }
        
        case 'pescar':
        case 'fish': {
            const cooldown = 12 * 60 * 1000
            
            if (now < user.lastFish) {
                const restante = user.lastFish - now
                const wait = formatTimeMs(restante)
                return conn.reply(m.chat, `ꕤ Debes esperar *${wait}* para usar *${usedPrefix + command}* de nuevo.`, m)
            }
            user.lastFish = now + cooldown
            const evento = pickRandom(eventosPescar)
            let monedas, experiencia
            if (evento.tipo === 'victoria') {
                monedas = Math.floor(Math.random() * 2001) + 11000
                experiencia = Math.floor(Math.random() * 61) + 30
                user.coin += monedas
                user.exp += experiencia
            } else {
                monedas = Math.floor(Math.random() * 2001) + 5000
                experiencia = Math.floor(Math.random() * 31) + 30
                user.coin -= monedas
                user.exp -= experiencia
                if (user.exp < 0) user.exp = 0
                if (user.coin < 0) user.coin = 0
            }
            const resultado = `ꕤ ${evento.mensaje} *$${monedas.toLocaleString()} ${userCurrency}*`
            await conn.reply(m.chat, resultado, m)
            await global.db.write()
            break
        }
        
        case 'coffer':
        case 'cofre':
        case 'abrircofre':
        case 'cofreabrir': {
            let gap = 86400000
            
            if (now < user.lastcofre) {
                const wait = formatTimeSec(Math.floor((user.lastcofre - now) / 1000))
                return conn.reply(m.chat, `ꕤ Debes esperar *${wait}* para usar *${usedPrefix + command}* de nuevo.`, m)
            }
            
            let reward = Math.floor(Math.random() * (60000 - 40000 + 1)) + 40000
            let expGain = Math.floor(Math.random() * (111)) + 50
            
            user.coin += reward
            user.exp += expGain
            user.lastcofre = now + gap
            
            conn.reply(m.chat, `「✿」 ${pickRandom(cofres)}\n> Has recibido *$${reward.toLocaleString()} ${global.currency}* y *${expGain} XP*.`, m)
            await global.db.write()
            break
        }

        case 'minar':
        case 'miming':
        case 'mine': {
            if (user.health < 5)
                return conn.reply(m.chat, `ꕤ No tienes suficiente salud para volver a *minar*.\n> Usa *"${usedPrefix}heal"* para curarte.`, m)

            const gap = 10 * 60 * 1000
            
            if (now < user.lastmine) {
                const restante = user.lastmine - now
                return conn.reply(m.chat, `ꕤ Debes esperar *${formatTimeMs(restante)}* para usar *${usedPrefix + command}* de nuevo.`, m)
            }
            
            user.lastmine = now + gap
            const evento = pickRandom(eventosMinar)
            let monedas, experiencia, salud
            
            if (evento.tipo === 'victoria') {
                monedas = Math.floor(Math.random() * 2001) + 7000
                experiencia = Math.floor(Math.random() * 91) + 10
                salud = Math.floor(Math.random() * 3) + 1
                user.coin += monedas
                user.exp += experiencia
                user.health -= salud
            } else {
                monedas = Math.floor(Math.random() * 2001) + 3000
                experiencia = Math.floor(Math.random() * 41) + 10
                salud = Math.floor(Math.random() * 5) + 1
                user.coin -= monedas
                user.exp -= experiencia
                user.health -= salud
                if (user.coin < 0) user.coin = 0
                if (user.exp < 0) user.exp = 0
            }
            
            if (user.health < 0) user.health = 0
            
            const mensaje = `ꕤ ${evento.mensaje} *$${monedas.toLocaleString()} ${userCurrency}*`
            await conn.reply(m.chat, mensaje, m)
            await global.db.write()
            break
        }
        
        case 'adventure':
        case 'aventura': {
            
            if (user.health < 5)
                return conn.reply(m.chat, `ꕤ No tienes suficiente salud para volver a *aventurarte*.\n> Usa *"${usedPrefix}heal"* para curarte.`, m)
            
            const cooldown = 20 * 60 * 1000
            
            if (now < user.lastAdventure) {
                const restante = user.lastAdventure - now
                const wait = formatTimeMs(restante)
                return conn.reply(m.chat, `ꕤ Debes esperar *${wait}* para usar *${usedPrefix + command}* de nuevo.`, m)
            }
            
            user.lastAdventure = now + cooldown
            const evento = pickRandom(aventuras)
            let monedas = 0, experiencia = 0, salud = 0
            
            if (evento.tipo === 'victoria') {
                monedas = Math.floor(Math.random() * 3001) + 15000
                experiencia = Math.floor(Math.random() * 81) + 40
                salud = Math.floor(Math.random() * 6) + 10
                user.coin += monedas
                user.exp += experiencia
                user.health -= salud
            } else if (evento.tipo === 'derrota') {
                monedas = Math.floor(Math.random() * 2001) + 7000
                experiencia = Math.floor(Math.random() * 41) + 40
                salud = Math.floor(Math.random() * 6) + 10
                user.coin -= monedas
                user.exp -= experiencia
                user.health -= salud
                if (user.coin < 0) user.coin = 0
                if (user.exp < 0) user.exp = 0
            } else {
                experiencia = Math.floor(Math.random() * 61) + 30
                user.exp += experiencia
            }
            
            if (user.health < 0) user.health = 0
            
            const resultado = `❀ ${evento.mensaje} ${evento.tipo === 'neutro' ? '' : evento.tipo === 'victoria' ? `ganaste. *${monedas.toLocaleString()} ${userCurrency}*` : `perdiste. *${monedas.toLocaleString()} ${userCurrency}*`}`
            
            await conn.reply(m.chat, resultado, m)
            await global.db.write()
            break
        }
        
        case 'dungeon':
        case 'mazmorra': {
            
            if (user.health < 5)
                return conn.reply(m.chat, `ꕤ No tienes suficiente salud para volver a la *mazmorra*.\n> Usa *"${usedPrefix}heal"* para curarte.`, m)
            
            const cooldown = 18 * 60 * 1000
            
            if (now < user.lastDungeon) {
                const restante = user.lastDungeon - now
                const wait = formatTimeMs(restante)
                return conn.reply(m.chat, `ꕤ Debes esperar *${wait}* para usar *${usedPrefix + command}* de nuevo.`, m)
            }
            
            user.lastDungeon = now + cooldown
            const evento = pickRandom(eventosDungeon)
            let monedas = 0, experiencia = 0, salud = 0
            
            if (evento.tipo === 'victoria') {
                monedas = Math.floor(Math.random() * 3001) + 12000
                experiencia = Math.floor(Math.random() * 71) + 30
                salud = Math.floor(Math.random() * 3) + 8
                user.coin += monedas
                user.exp += experiencia
                user.health -= salud
            } else if (evento.tipo === 'derrota') {
                monedas = Math.floor(Math.random() * 2001) + 6000
                experiencia = Math.floor(Math.random() * 31) + 40
                salud = Math.floor(Math.random() * 3) + 8
                user.coin -= monedas
                user.exp -= experiencia
                user.health -= salud
                if (user.coin < 0) user.coin = 0
                if (user.exp < 0) user.exp = 0
            } else {
                experiencia = Math.floor(Math.random() * 61) + 30
                user.exp += experiencia
            }
            
            if (user.health < 0) user.health = 0
            
            const resultado = `❀ ${evento.mensaje} ${evento.tipo === 'trampa' ? '' : evento.tipo === 'victoria' ? `ganaste. *${monedas.toLocaleString()} ${userCurrency}*` : `perdiste. *${monedas.toLocaleString()} ${userCurrency}*`}`
            
            await conn.reply(m.chat, resultado.trim(), m)
            await global.db.write()
            break
        }
    }
}

handler.tags = ['rpg', 'economy', 'economía']
handler.help = ['slut', 'prostituirse', 'trabajar', 'crimen', 'cazar', 'hunt', 'pescar', 'fish', 'cofre', 'coffer', 'abrircofre', 'minar', 'miming', 'aventura', 'adventure', 'dungeon', 'mazmorra']
handler.command = ['slut', 'prostituirse', 'w', 'work', 'chambear', 'chamba', 'trabajar', 'crimen', 'crime', 'cazar', 'hunt', 'pescar', 'fish', 'coffer', 'cofre', 'abrircofre', 'cofreabrir', 'minar', 'miming', 'mine', 'adventure', 'aventura', 'dungeon', 'mazmorra']
handler.group = true

export default handler

function formatTimeMs(ms) {
    const totalSec = Math.ceil(ms / 1000)
    const min = Math.floor((totalSec % 3600) / 60)
    const sec = totalSec % 60
    const parts = []
    if (min > 0) parts.push(`${min} minuto${min !== 1 ? 's' : ''}`)
    parts.push(`${sec} segundo${sec !== 1 ? 's' : ''}`)
    return parts.join(' ')
}

function formatTimeSec(totalSec) {
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    const txt = []
    if (h > 0) txt.push(`${h} hora${h !== 1 ? 's' : ''}`)
    if (m > 0 || h > 0) txt.push(`${m} minuto${m !== 1 ? 's' : ''}`)
    if (s > 0) txt.push(`${s} segundo${s !== 1 ? 's' : ''}`)
    return txt.join(' ')
}

function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)]
}
