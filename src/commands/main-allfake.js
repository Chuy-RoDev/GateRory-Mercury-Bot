import fs from 'fs'
var handler = m => m
handler.all = async function (m) { 
    global.idchannel = global.ch.ch1
    global.namechannel = global.canalNombre
    
    global.d = new Date(new Date + 3600000)
    global.locale = 'es'
    global.fecha = d.toLocaleDateString('es', {day: 'numeric', month: 'numeric', year: 'numeric'})
    global.tiempo = d.toLocaleString('en-US', {hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true})
    global.nombre = m.pushName || 'Usuario'
    global.packsticker = `┊ Shiroko Team\n⤷ https://github.com/Chuy-RoDev/GateRory-Mercury-Bot\n\n┊INFO\n ⤷ speed3xz.bot.nu/soporte`
    global.packsticker2 = `┊Bot\n┊⤷${global.botname} \n\n┊Usuario:\n┊⤷${nombre}`
    
    global.rcanal = {}
    global.rcanalw = {}
    global.rcanalden2 = {}
    global.rcanalx = {}
    global.rcanalr = {}
    global.rcanalden = {}
    global.rcanaldev = {}

    global.fkontak = { 
        key: { 
            participants: "0@s.whatsapp.net", 
            remoteJid: "status@broadcast", 
            fromMe: false, 
            id: "Halo" 
        }, 
        message: { 
            contactMessage: { 
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:y\nitem1.TEL;waid=${m.sender.split('@')[0]}:${m.sender.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD` 
            }
        }, 
        participant: "0@s.whatsapp.net" 
    }
}
export default handler