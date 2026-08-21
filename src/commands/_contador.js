// --- SISTEMA INTEGRAL: CONTADOR + RESET SEMANAL + OPTIMIZACIÓN ---
export async function before(m) {
    if (!m.chat || m.fromMe || !m.isGroup) return
    
    let db = global.db.data
    let user = db.users[m.sender]
    
    // 1. ASEGURAR QUE EL USUARIO EXISTE EN LA DB
    if (!user) return 

    // 2. LÓGICA DE RESET SEMANAL (SILENCIOSO)
    const unaSemana = 7 * 24 * 60 * 60 * 1000 
    const tiempoActual = Date.now()
    
    if (!db.lastReset) db.lastReset = tiempoActual

    if (tiempoActual - db.lastReset >= unaSemana) {
        // Solo log en consola para el administrador del bot
        console.log('✨ [SISTEMA] Reinicio semanal de estadísticas completado.')
        
        Object.keys(db.users).forEach(id => {
            db.users[id].chat = 0
            db.users[id].message = 0
            db.users[id].messages = 0
            db.users[id].commandCount = 0
            db.users[id].commands = 0
        })

        db.lastReset = tiempoActual 
        return
    }

    // 3. CONTADOR DE MENSAJES
    if (typeof user.chat !== 'number') user.chat = 0
    
    const esComando = /^[./#!]/.test(m.text)
    if (!esComando && m.text) {
        user.chat += 1
    }
}