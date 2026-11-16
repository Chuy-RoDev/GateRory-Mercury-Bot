// /personalidad — alterna entre la voz de Rory Mercury y el bot genérico
import { getModo, setModo, aplicar, PACKS } from '../../lib/personalidad.js'

let handler = async (m, { args, usedPrefix }) => {
    const pedido = (args[0] || '').toLowerCase()

    if (!pedido) {
        const actual = getModo()
        return m.reply(`ꕤ Personalidad actual: *${actual === 'rory' ? '🗡️ Rory Mercury' : '🤖 Bot genérico'}*\n\n> Cambiar a Rory: *${usedPrefix}personalidad rory*\n> Cambiar a genérico: *${usedPrefix}personalidad generico*`)
    }

    if (!['rory', 'generico'].includes(pedido)) {
        return m.reply(`ꕤ Modo no reconocido: *${pedido}*\n\n> Opciones: *rory* o *generico*`)
    }

    const antes = getModo()
    setModo(pedido)
    aplicar()

    if (pedido === 'rory') {
        return m.reply(antes === 'rory'
            ? 'ꕤ Fufufu~ ¿me pides que sea yo misma estando siéndolo? Qué mortal tan curioso... ya lo estaba, por supuesto.~'
            : 'ꕤ Fufufu~ la apóstol Rory Mercury ha despertado. Mis textos ahora tienen el filo de mi halberd... y sin reiniciar, que hasta los dioses se sorprenden.~')
    }
    return m.reply(antes === 'generico'
        ? `ꕤ El modo genérico ya estaba activo.\n> Volver a Rory: *${usedPrefix}personalidad rory*`
        : 'ꕤ Personalidad genérica activada. Los textos vuelven a ser los de siempre (también en vivo).')
}

handler.help = ['personalidad <rory|generico>']
handler.tags = ['owner']
handler.command = ['personalidad', 'estilobot', 'vocerory']
handler.rowner = true

export default handler
