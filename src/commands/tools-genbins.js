let handler = async (m, { conn, text, usedPrefix, command }) => {
    try {
        const ctxErr = (global.rcanalx || {})
        
        const bins = {
            visa: ['453968', '455644', '471606', '402400'],
            mastercard: ['542523', '550209', '510805', '519718'],
            amex: ['378282', '371449', '340032', '374245'],
            discover: ['601122', '601123', '601124', '601125']
        }

        let tipo = text ? text.toLowerCase() : 'visa'
        if (!bins[tipo]) {
            return conn.reply(m.chat, `ꕤ Tipo no válido. Usa: *${usedPrefix}bin visa|mastercard|amex|discover*`, m, ctxErr)
        }

        let binBase = bins[tipo][Math.floor(Math.random() * bins[tipo].length)]
        let cardNumber = binBase + Math.random().toString().slice(2, 11)
        
        cardNumber = cardNumber + calcularDigitoVerificador(cardNumber)
        
        let month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')
        let year = String(new Date().getFullYear() + Math.floor(Math.random() * 5) + 1).slice(-2)
        
        let cvv = String(Math.floor(Math.random() * 900) + 100)
        
        let resultado = `
╔════════════════╗
    ✦ GENERADOR BIN
╚════════════════╝

❖ *Tipo:* ${tipo.toUpperCase()}
✰ *BIN:* ${binBase}
ꕤ *Tarjeta:* ${formatearTarjeta(cardNumber)}
✦ *Expira:* ${month}/${year}
✧ *CVV:* ${cvv}
❀ *Nombre:* ${generarNombreAleatorio()}
`.trim()

        await conn.reply(m.chat, resultado, m)

    } catch (e) {
        console.error(e)
        await conn.reply(m.chat, `ꕤ Error al generar BIN: ${e.message}`, m)
    }
}

function calcularDigitoVerificador(numero) {
    let sum = 0
    let alternate = false
    for (let i = numero.length - 1; i >= 0; i--) {
        let n = parseInt(numero[i])
        if (alternate) {
            n *= 2
            if (n > 9) n -= 9
        }
        sum += n
        alternate = !alternate
    }
    return String((10 - (sum % 10)) % 10)
}

function formatearTarjeta(numero) {
    return numero.replace(/(\d{4})/g, '$1 ').trim()
}

function generarNombreAleatorio() {
    const nombres = ['Juan Perez', 'Maria Garcia', 'Carlos Lopez', 'Ana Martinez', 'David Rodriguez']
    return nombres[Math.floor(Math.random() * nombres.length)]
}

handler.help = ['bin <tipo>']
handler.tags = ['tools']
handler.command = ['bin', 'creditcard', 'generarbin']
export default handler