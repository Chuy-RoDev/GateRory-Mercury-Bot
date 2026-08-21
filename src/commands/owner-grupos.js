// CAMBIÉ LA RUTA DE IMPORTACIÓN PARA QUE ENCUENTRE EL ARCHIVO
import { smsg } from "../../lib/simple.js" 

let handler = async (m, { conn, text }) => {
    // SUB-COMANDO PARA SALIR DE UN GRUPO POR ID
    if (text) {
        let id = text.trim()
        if (!id.endsWith('@g.us')) return m.reply('⚠️ El ID debe terminar en @g.us')
        await m.reply(`👋 Saliendo del grupo: ${id}...`)
        await conn.groupLeave(id)
        return m.reply('✅ Shiroko se ha retirado del grupo con éxito.')
    }

    // COMANDO PRINCIPAL: LISTAR GRUPOS Y LINKS
    await m.reply('⏳ Generando reporte táctico de grupos...')
    let groups = Object.values(await conn.groupFetchAllParticipating())
    let links = []

    for (let group of groups) {
        try {
            // Intenta sacar el link (Solo si es ADMIN)
            let code = await conn.groupInviteCode(group.id)
            links.push(`✅ *${group.subject}*\n🔗 https://chat.whatsapp.com/${code}`)
        } catch {
            // Si no es admin, manda el ID para control remoto
            links.push(`❌ *${group.subject}*\n🆔 \`${group.id}\`\n⚠️ (Sin admin para link)`)
        }
    }

    let footer = `\n\n💡 *TIP:* Si quieres que Shiroko se salga de un grupo sin link, usa:\n\`:links [ID-del-grupo]\``
    let texto = `📊 *REPORTE DE GRUPOS - SHIROKO*\n\n${links.join('\n\n')}${footer}`
    
    await conn.reply(m.sender, texto, m)
    m.reply('📦 Reporte enviado al privado, Comandante.')
}

handler.help = ['links']
handler.tags = ['owner']
handler.command = ['getlinks', 'links', 'grupos']
handler.owner = true 

export default handler
