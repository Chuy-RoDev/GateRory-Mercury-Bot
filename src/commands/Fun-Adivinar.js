import axios from 'axios'

const CAUSA_API_KEY = 'causa-ee5ee31dcfc79da4'

var handler = async (m, { conn, usedPrefix, command, args, text }) => {
    conn.adivinar = conn.adivinar ? conn.adivinar : {}
    let id = m.chat
    const userCurrency = global.getUserCurrency ? global.getUserCurrency(m.sender) : (global.currency || 'monedas')

    // --- LÓGICA DE JUEGO EN CURSO ---
    if (id in conn.adivinar) {
        let game = conn.adivinar[id]
        let userRpta = text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        
        // 1. ACEPTAR EL DUELO
        if (game.status === 'WAITING') {
            if (m.sender !== game.p2) return 
            if (userRpta === 'aceptar') {
                
                // VALIDACIÓN DE FONDOS REAL (Usando .bank como tu comando pay)
                let p1 = global.db.data.users[game.p1]
                let p2 = global.db.data.users[game.p2]

                if (p1.bank < game.apuesta) {
                    delete conn.adivinar[id]
                    return conn.reply(m.chat, `「❌」 Duelo cancelado. El iniciador ya no tiene fondos suficientes en el banco.`, m)
                }
                if (p2.bank < game.apuesta) {
                    delete conn.adivinar[id]
                    return conn.reply(m.chat, `「❌」 No tienes suficientes ${userCurrency} en el banco para aceptar este reto.`, m)
                }

                // COBRO AUTOMÁTICO
                p1.bank -= game.apuesta
                p2.bank -= game.apuesta
                
                game.status = 'PLAYING'
                clearTimeout(game.timeout)
                
                game.timeout = setTimeout(() => {
                    if (conn.adivinar[id]) {
                        conn.reply(m.chat, `╭━━━[ ⏰ TIEMPO AGOTADO ]━━━╮\n┃\n┣ • *El objetivo era:* ${game.chosen.nombre}\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━╯`, m)
                        delete conn.adivinar[id]
                    }
                }, 180000)

                let startTxt = `╭━━━[ 🎯 DUELO INICIADO ]━━━╮\n`
                startTxt += `┃\n`
                startTxt += `┣ ❀ *Franquicia:* ${game.chosen.anime}\n`
                startTxt += `┣ ✰ *Pista 1:* ${game.chosen.pistas[0]}\n`
                startTxt += `┃\n`
                startTxt += `┣ > _Responde con el nombre o_\n`
                startTxt += `┣ > _escribe *pista* (Costo: 500 XP)_\n`
                startTxt += `╰━━━━━━━━━━━━━━━━━━━━━━╯`
                
                return conn.reply(m.chat, startTxt, m)
            }
            return
        }

        // 2. JUGANDO
        if (game.status === 'PLAYING') {
            if (m.sender !== game.p1 && m.sender !== game.p2) return

            if (userRpta === 'pista') {
                if (game.pistaNum >= 2) return conn.reply(m.chat, `「⚠️」 Ya no hay más pistas.`, m)
                let userExp = global.db.data.users[m.sender].exp
                if (userExp < 500) return conn.reply(m.chat, `「❌」 XP insuficiente.`, m)
                
                game.pistaNum++
                global.db.data.users[m.sender].exp -= 500
                return conn.reply(m.chat, `╭━━━[ 🔍 PISTA ${game.pistaNum + 1} ]━━━╮\n┃\n┣ > ${game.chosen.pistas[game.pistaNum]}\n┃\n╰━━━━━━━━━━━━━━━━━╯`, m)
            }

            let nameRpta = game.chosen.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            if (userRpta.includes(nameRpta)) {
                let premio = game.apuesta * 2
                let xp = Math.floor(Math.random() * 2000) + 1000
                
                global.db.data.users[m.sender].bank += premio
                global.db.data.users[m.sender].exp += xp

                let winTxt = `╭━━━[ 💸 OPERACIÓN EXITOSA ]━━━╮\n`
                winTxt += `┃\n`
                winTxt += `┣ • @${m.sender.split('@')[0]} ganó el duelo.\n`
                winTxt += `┣ ❀ *Identidad:* ${game.chosen.nombre.toUpperCase()}\n`
                winTxt += `┣ ✰ *Botín:* ${premio.toLocaleString()} ${userCurrency}\n`
                winTxt += `┃\n`
                winTxt += `┣ > _Buen trabajo. Nn._\n`
                winTxt += `╰━━━━━━━━━━━━━━━━━━━━━━━╯`
                
                await conn.sendMessage(m.chat, { image: { url: game.foto }, caption: winTxt, mentions: [m.sender] }, { quoted: m })
                clearTimeout(game.timeout)
                delete conn.adivinar[id]
            }
            return
        }
    }

    // --- INICIO / INVITACIÓN ---
    let mentionedJid = await m.mentionedJid
    let who = mentionedJid && mentionedJid.length ? mentionedJid[0] : (m.quoted ? m.quoted.sender : null)

    if (!who) return conn.reply(m.chat, `「🎯」 Menciona a quién retar.\n> Ejemplo: *${usedPrefix + command} @user 50000*`, m)
    if (who === m.sender) return conn.reply(m.chat, `「🤡」 No seas baboso jsjs, no puedes jugar contigo mismo.`, m)

    let monto = args[0] && !isNaN(args[0]) ? Math.abs(parseInt(args[0])) : (args[1] && !isNaN(args[1]) ? Math.abs(parseInt(args[1])) : 10000)
    
    let user = global.db.data.users[m.sender]
    let target = global.db.data.users[who]

    if (!user || (user.bank || 0) < monto) return conn.reply(m.chat, `「🏦」 No tienes suficientes ${userCurrency} en el banco.`, m)
    if (!target || (target.bank || 0) < monto) return conn.reply(m.chat, `「🏦」 Tu oponente está limpio, no tiene para la apuesta.`, m)

    let personajes = [
        // SOLICITADOS POR ALEX MIJO & CHUY
        { nombre: 'Rimuru Tempest', anime: 'Tensei Shitara Slime Datta Ken', pistas: ['Es un slime', 'Gobernante de Jura Tempest', 'Se llamaba Satoru Mikami'] },
        { nombre: 'Suguru Geto', anime: 'Jujutsu Kaisen', pistas: ['Manipula maldiciones', 'Llama "monos" a los humanos', 'Ex mejor amigo de Gojo'] },
        { nombre: 'Yuta Okkotsu', anime: 'Jujutsu Kaisen', pistas: ['Hechicero de grado especial', 'Tiene a la reina de las maldiciones', 'Usa katana y anillo'] },
        { nombre: 'Rory Mercury', anime: 'GATE', pistas: ['Apóstol de Emloy', 'Usa un hacha gigante', 'Viste de lolita gótica'] },

        // DATE A LIVE
        { nombre: 'Tohka Yatogami', anime: 'Date A Live', pistas: ['Espíritu Princesa', 'Ama el pan de kinako', 'Su ángel es Sandalphon'] },
        { nombre: 'Origami Tobiichi', anime: 'Date A Live', pistas: ['Miembro del AST', 'Espíritu Ángel', 'Acosadora inexpresiva'] },
        { nombre: 'Kotori Itsuka', anime: 'Date A Live', pistas: ['Hermana menor', 'Espíritu de fuego', 'Comandante de Fraxinus'] },
        { nombre: 'Yoshino Himekawa', anime: 'Date A Live', pistas: ['Espíritu Ermitaño', 'Usa un títere en la mano', 'Controla el hielo'] },
        { nombre: 'Kurumi Tokisaki', anime: 'Date A Live', pistas: ['Espíritu Pesadilla', 'Reloj en el ojo izquierdo', 'Manipula el tiempo'] },
        { nombre: 'Kaguya Yamai', anime: 'Date A Live', pistas: ['Espíritu Berserk (Gemela)', 'Personalidad chuunibyou', 'Usa una lanza'] },
        { nombre: 'Yuzuru Yamai', anime: 'Date A Live', pistas: ['Espíritu Berserk (Gemela)', 'Habla como robot', 'Usa un péndulo'] },
        { nombre: 'Miku Izayoi', anime: 'Date A Live', pistas: ['Espíritu Diva', 'Odia a los hombres', 'Controla con su voz'] },
        { nombre: 'Natsumi Kyouno', anime: 'Date A Live', pistas: ['Espíritu Bruja', 'Puede transformarse', 'Baja autoestima'] },
        { nombre: 'Mukuro Hoshimiya', anime: 'Date A Live', pistas: ['Espíritu Zodiaco', 'Sella emociones y recuerdos', 'Viaja en el espacio'] },

        // DRAGON BALL
        { nombre: 'Goku', anime: 'Dragon Ball', pistas: ['Criado en la Tierra', 'Usa el Ultra Instinto', 'Siempre quiere pelear'] },
        { nombre: 'Vegeta', anime: 'Dragon Ball', pistas: ['Príncipe Saiyajin', 'Usa el Big Bang Attack', 'Esposo de Bulma'] },
        { nombre: 'Gohan', anime: 'Dragon Ball', pistas: ['Hijo de Goku', 'Derrotó a Cell', 'Desbloqueó el Modo Bestia'] },
        { nombre: 'Piccolo', anime: 'Dragon Ball', pistas: ['Es un Namekiano', 'Maestro de Gohan', 'Usa el Makankosappo'] },
        { nombre: 'Freezer', anime: 'Dragon Ball', pistas: ['Emperador del mal', 'Destruyó el planeta Vegeta', 'Tiene una forma Golden'] },
        { nombre: 'Cell', anime: 'Dragon Ball', pistas: ['Androide biológico', 'Tiene células de todos', 'Organizó un torneo'] },
        { nombre: 'Majin Buu', anime: 'Dragon Ball', pistas: ['Monstruo rosa', 'Convierte a la gente en dulces', 'Duerme mucho'] },
        { nombre: 'Trunks', anime: 'Dragon Ball', pistas: ['Viene del futuro', 'Usa una espada', 'Hijo de Vegeta'] },
        { nombre: 'Krillin', anime: 'Dragon Ball', pistas: ['Mejor amigo de Goku', 'No tiene nariz', 'Usa el Kienzan'] },
        { nombre: 'Androide 18', anime: 'Dragon Ball', pistas: ['Humana modificada', 'Esposa de Krillin', 'Hermana de 17'] },

        // QUINTILLIZAS
        { nombre: 'Ichika Nakano', anime: 'The Quintessential Quintuplets', pistas: ['La hermana mayor', 'Es actriz', 'Pelo corto rosa'] },
        { nombre: 'Nino Nakano', anime: 'The Quintessential Quintuplets', pistas: ['La segunda hermana', 'Cocina muy bien', 'Pelo largo con cintas'] },
        { nombre: 'Miku Nakano', anime: 'The Quintessential Quintuplets', pistas: ['La tercera hermana', 'Usa audífonos', 'Le gusta la historia'] },
        { nombre: 'Yotsuba Nakano', anime: 'The Quintessential Quintuplets', pistas: ['La cuarta hermana', 'Usa un moño verde', 'Muy atlética'] },
        { nombre: 'Itsuki Nakano', anime: 'The Quintessential Quintuplets', pistas: ['La menor', 'Come mucho', 'Quiere ser profesora'] },
        { nombre: 'Fuutarou Uesugi', anime: 'The Quintessential Quintuplets', pistas: ['El tutor privado', 'Muy estudioso', 'Familia pobre'] },
        { nombre: 'Raiha Uesugi', anime: 'The Quintessential Quintuplets', pistas: ['Hermana menor del tutor', 'Muy tierna', 'Cocina para su familia'] },
        { nombre: 'Maruo Nakano', anime: 'The Quintessential Quintuplets', pistas: ['Padre adoptivo', 'Es médico', 'Muy estricto'] },
        { nombre: 'Rena Nakano', anime: 'The Quintessential Quintuplets', pistas: ['Madre de las chicas', 'Era profesora', 'Falleció por enfermedad'] },
        { nombre: 'Takebayashi', anime: 'The Quintessential Quintuplets', pistas: ['Amiga de la infancia del tutor', 'Líder de clase', 'Causa celos en las hermanas'] },

        // VOCALOID
        { nombre: 'Hatsune Miku', anime: 'Vocaloid', pistas: ['Cantante virtual', 'Coletas cian', 'Usa un puerro'] },
        { nombre: 'Kagamine Rin', anime: 'Vocaloid', pistas: ['Pelo rubio', 'Lleva un lazo gigante', 'Hermana de Len'] },
        { nombre: 'Kagamine Len', anime: 'Vocaloid', pistas: ['Pelo rubio atado atrás', 'Le gustan las bananas', 'Hermano de Rin'] },
        { nombre: 'Megurine Luka', anime: 'Vocaloid', pistas: ['Pelo rosa largo', 'Voz madura', 'Canta bilingüe'] },
        { nombre: 'KAITO', anime: 'Vocaloid', pistas: ['Pelo azul', 'Usa bufanda azul', 'Ama el helado'] },
        { nombre: 'MEIKO', anime: 'Vocaloid', pistas: ['Pelo castaño corto', 'Traje rojo', 'Le gusta beber sake'] },
        { nombre: 'GUMI', anime: 'Vocaloid', pistas: ['Pelo verde', 'Lleva gafas de aviador', 'Voz de Megumi Nakajima'] },
        { nombre: 'IA', anime: 'Vocaloid', pistas: ['Pelo rubio/rosado largo', 'Diseño etéreo', 'Aria On The Planetes'] },
        { nombre: 'Yuzuki Yukari', anime: 'Vocaloid', pistas: ['Chaqueta de conejo morada', 'Habla y canta', 'Lleva motosierra a veces'] },
        { nombre: 'Otomachi Una', anime: 'Vocaloid', pistas: ['Sombrero de anguila', 'Voz muy aguda', 'Pelo azul marino'] },

        // RE:ZERO
        { nombre: 'Subaru Natsuki', anime: 'Re:Zero', pistas: ['Regreso por la muerte', 'Chaqueta deportiva', 'Ama a Emilia'] },
        { nombre: 'Emilia', anime: 'Re:Zero', pistas: ['Media elfa', 'Pelo plateado', 'Acompañada de Pack'] },
        { nombre: 'Rem', anime: 'Re:Zero', pistas: ['Maid de pelo azul', 'Demonio con un cuerno', 'Usa lucero del alba'] },
        { nombre: 'Ram', anime: 'Re:Zero', pistas: ['Maid de pelo rosa', 'Perdió su cuerno', 'Magia de viento'] },
        { nombre: 'Beatrice', anime: 'Re:Zero', pistas: ['Espíritu artificial', 'Biblioteca prohibida', 'Dice mucho "supongo"'] },
        { nombre: 'Roswaal L. Mathers', anime: 'Re:Zero', pistas: ['Mago de la corte', 'Maquillaje de bufón', 'Patrocinador de Emilia'] },
        { nombre: 'Echidna', anime: 'Re:Zero', pistas: ['Bruja de la Avaricia', 'Pelo blanco', 'Toma té'] },
        { nombre: 'Otto Suwen', anime: 'Re:Zero', pistas: ['Comerciante', 'Habla con animales', 'Sufre mucho'] },
        { nombre: 'Garfiel Tinsel', anime: 'Re:Zero', pistas: ['Guardián del Santuario', 'Mitad bestia', 'Pelo rubio'] },
        { nombre: 'Reinhard Van Astrea', anime: 'Re:Zero', pistas: ['Santo de la espada', 'Pelo rojo', 'Demasiadas protecciones'] },

        // KONOSUBA
        { nombre: 'Kazuma Satou', anime: 'Konosuba', pistas: ['Muchos puntos en suerte', 'Habilidad Robar', 'Igualdad de género'] },
        { nombre: 'Aqua', anime: 'Konosuba', pistas: ['Diosa inútil', 'Líder del culto de Axis', 'Odia a los no-muertos'] },
        { nombre: 'Megumin', anime: 'Konosuba', pistas: ['Archimaga', 'Solo usa un hechizo', 'Demonio Carmesí'] },
        { nombre: 'Darkness', anime: 'Konosuba', pistas: ['Paladín masoquista', 'Pelo rubio', 'Hija de la familia Dustiness'] },
        { nombre: 'Yunyun', anime: 'Konosuba', pistas: ['Rival de Megumin', 'No tiene amigos xd', 'Hija del jefe'] },
        { nombre: 'Wiz', anime: 'Konosuba', pistas: ['Es una Lich', 'Tiene una tienda mágica', 'Muy amable'] },
        { nombre: 'Vanir', anime: 'Konosuba', pistas: ['Duque del infierno', 'Máscara', 'Lee el corazón'] },
        { nombre: 'Eris', anime: 'Konosuba', pistas: ['Diosa de la fortuna', 'Usa relleno v:', 'Cicatriz en la cara'] },
        { nombre: 'Chris', anime: 'Konosuba', pistas: ['Ladrona', 'Amiga de Darkness', 'Realmente es una diosa'] },
        { nombre: 'Luna', anime: 'Konosuba', pistas: ['Recepcionista del gremio', 'Pelo castaño', 'Da misiones'] },

        // SEIREI GENSOUKI
        { nombre: 'Rio', anime: 'Seirei Gensouki', pistas: ['Reencarnación de Haruto', 'Busca venganza', 'Cabello gris'] },
        { nombre: 'Celia Claire', anime: 'Seirei Gensouki', pistas: ['Profesora', 'Pelo plateado', 'Genio mágica'] },
        { nombre: 'Aishia', anime: 'Seirei Gensouki', pistas: ['Espíritu de Rio', 'Pelo rosado pálido', 'Inexpresiva'] },
        { nombre: 'Latifa', anime: 'Seirei Gensouki', pistas: ['Chica zorro', 'Ex-asesina', 'Hermana menor'] },
        { nombre: 'Miharu Ayase', anime: 'Seirei Gensouki', pistas: ['Amiga de la infancia', 'Pelo negro', 'Corazón puro'] },
        { nombre: 'Liselotte Cretia', anime: 'Seirei Gensouki', pistas: ['Comerciante', 'Pelo rubio', 'Gobernadora de Amande'] },
        { nombre: 'Flora Beltrum', anime: 'Seirei Gensouki', pistas: ['Princesa tímida', 'Cabello lila', 'Fue secuestrada'] },
        { nombre: 'Christina Beltrum', anime: 'Seirei Gensouki', pistas: ['Princesa inteligente', 'Cabello rojo', 'Líder'] },
        { nombre: 'Satsuki Sumeragi', anime: 'Seirei Gensouki', pistas: ['Héroe invocada', 'Pelo negro largo', 'Galarc'] },
        { nombre: 'Gouki Saga', anime: 'Seirei Gensouki', pistas: ['Samurái', 'Leal a la realeza', 'Pelo negro'] },

        // SHUUMATSU NO VALKYRIE
        { nombre: 'Adan', anime: 'Shuumatsu no Valkyrie', pistas: ['Padre de la humanidad', 'Ojos del Señor', 'Manzana'] },
        { nombre: 'Zeus', anime: 'Shuumatsu no Valkyrie', pistas: ['Dios supremo', 'Forma Adamas', 'Pelea a puño limpio'] },
        { nombre: 'Belcebu', anime: 'Shuumatsu no Valkyrie', pistas: ['Vibraciones', 'Odia su propia existencia', 'Científico'] },
        { nombre: 'Loki', anime: 'Shuumatsu no Valkyrie', pistas: ['Engaño', 'Pelo verde', 'Cadenas'] },
        { nombre: 'Sasaki Kojiro', anime: 'Shuumatsu no Valkyrie', pistas: ['Escanea', 'Espadachín', 'Perdedor más fuerte'] },
        { nombre: 'Jack el Destripador', anime: 'Shuumatsu no Valkyrie', pistas: ['Londres', 'Té', 'Maldad pura'] },
        { nombre: 'Poseidon', anime: 'Shuumatsu no Valkyrie', pistas: ['Tridente', 'Perfección', 'Dios de los mares'] },
        { nombre: 'Buda', anime: 'Shuumatsu no Valkyrie', pistas: ['Iluminación', 'Dulces', 'Bastón de los seis reinos'] },
        { nombre: 'Thor', anime: 'Shuumatsu no Valkyrie', pistas: ['Mjolnir', 'Pelo rojo', 'Guantes'] },
        { nombre: 'Hades', anime: 'Shuumatsu no Valkyrie', pistas: ['Rey del Helheim', 'Bidente', 'Hermano mayor'] },

        // EXTRA DE TU LISTA
        { nombre: 'Astolfo', anime: 'Fate Series', pistas: ['Trapito supremo', 'Hipogrifo', 'Lazo rosa'] },
        { nombre: 'Arturia Pendragon', anime: 'Fate Series', pistas: ['Saber', 'Excalibur', 'Rey Arturo'] },
        { nombre: 'Gilgamesh', anime: 'Fate Series', pistas: ['Archer', 'Babilonia', 'Mestizo'] },
        { nombre: 'Emiya Shirou', anime: 'Fate Series', pistas: ['Proyección', 'Espadas', 'Héroe de la justicia'] },
        { nombre: 'Raiden Shogun', anime: 'Genshin Impact', pistas: ['Eternidad', 'Electro', 'Plano de la eutimia'] },
        { nombre: 'Zhongli', anime: 'Genshin Impact', pistas: ['Geo', 'Orden', 'Viviendo entre humanos'] },
        { nombre: 'Furina', anime: 'Genshin Impact', pistas: ['Hydro', 'Teatro', 'Fontaine'] },
        { nombre: 'Ellen Joe', anime: 'Zenless Zone Zero', pistas: ['Tiburón', 'Maid', 'Victoria Housekeeping'] },
        { nombre: 'Von Lycaon', anime: 'Zenless Zone Zero', pistas: ['Lobo', 'Hielo', 'Elegancia'] },
        { nombre: 'Anby Demara', anime: 'Zenless Zone Zero', pistas: ['Soldado', 'Hamburguesas', 'Liebres Astutas'] },

        // --- AGREGADOS SORPRESA EXTRAS ---
        
        // NARUTO
        { nombre: 'Naruto Uzumaki', anime: 'Naruto', pistas: ['Jinchuriki del Kyubi', 'Ama el ramen', 'Quiere ser Hokage'] },
        { nombre: 'Sasuke Uchiha', anime: 'Naruto', pistas: ['Tiene el Sharingan', 'Quiere vengar a su clan', 'Usa el Chidori'] },
        { nombre: 'Kakashi Hatake', anime: 'Naruto', pistas: ['Ninja que copia', 'Lee libros raros', 'Lleva máscara siempre'] },
        { nombre: 'Itachi Uchiha', anime: 'Naruto', pistas: ['Asesinó a su clan', 'Se unió a Akatsuki', 'Hermano mayor'] },
        { nombre: 'Hinata Hyuga', anime: 'Naruto', pistas: ['Posee el Byakugan', 'Muy tímida', 'Esposa del Hokage'] },

        // ONE PIECE
        { nombre: 'Monkey D. Luffy', anime: 'One Piece', pistas: ['Hombre de goma', 'Sombrero de paja', 'Quiere ser el Rey de los Piratas'] },
        { nombre: 'Roronoa Zoro', anime: 'One Piece', pistas: ['Usa tres espadas', 'Se pierde siempre', 'Pelo verde'] },
        { nombre: 'Sanji', anime: 'One Piece', pistas: ['Cocinero', 'Solo pelea con las piernas', 'Ama a las mujeres'] },
        { nombre: 'Nami', anime: 'One Piece', pistas: ['Navegante', 'Ama el dinero', 'Usa un Clima-Tact'] },
        { nombre: 'Tony Tony Chopper', anime: 'One Piece', pistas: ['Reno médico', 'Comió la fruta Hito Hito', 'Le gusta el algodón de azúcar'] },

        // DEMON SLAYER (KIMETSU NO YAIBA)
        { nombre: 'Tanjiro Kamado', anime: 'Kimetsu no Yaiba', pistas: ['Respiración del Agua', 'Cicatriz en la frente', 'Carga una caja de madera'] },
        { nombre: 'Nezuko Kamado', anime: 'Kimetsu no Yaiba', pistas: ['Demonio pacífico', 'Lleva un bambú en la boca', 'Se encoge'] },
        { nombre: 'Zenitsu Agatsuma', anime: 'Kimetsu no Yaiba', pistas: ['Respiración del Rayo', 'Pelea dormido', 'Muy cobarde'] },
        { nombre: 'Inosuke Hashibira', anime: 'Kimetsu no Yaiba', pistas: ['Cabeza de jabalí', 'Respiración de la Bestia', 'Muy agresivo'] },
        { nombre: 'Kyojuro Rengoku', anime: 'Kimetsu no Yaiba', pistas: ['Pilar de la Llama', 'Grita UMAI', 'Corazón ardiente'] },

        // CHAINSAW MAN
        { nombre: 'Denji', anime: 'Chainsaw Man', pistas: ['Corazón de Pochita', 'Tira de una cuerda en su pecho', 'Solo quiere tocar pechos'] },
        { nombre: 'Makima', anime: 'Chainsaw Man', pistas: ['Demonio del Control', 'Cazadora de Seguridad Pública', 'Pelo rojo'] },
        { nombre: 'Power', anime: 'Chainsaw Man', pistas: ['Demonio de la Sangre', 'No tira la cadena del baño', 'Tiene cuernos'] },
        { nombre: 'Aki Hayakawa', anime: 'Chainsaw Man', pistas: ['Usa el Demonio Zorro', 'Fuma mucho', 'Pelo atado'] },

        // EVANGELION
        { nombre: 'Shinji Ikari', anime: 'Evangelion', pistas: ['Pilota el EVA 01', 'Huye de sus problemas', 'Hijo de Gendo'] },
        { nombre: 'Asuka Langley', anime: 'Evangelion', pistas: ['Pilota el EVA 02', 'Tsundere pelirroja', 'De Alemania'] },
        { nombre: 'Rei Ayanami', anime: 'Evangelion', pistas: ['Pilota el EVA 00', 'Pelo azul', 'Muy inexpresiva'] }
    ]

    let elegido = personajes[Math.floor(Math.random() * personajes.length)]
    let foto = 'https://telegra.ph/file/0db4473e655e88417c244.jpg' 
    
    try {
        let res = await axios.get(`https://rest.apicausas.xyz/api/v1/buscadores/pinterest?q=${encodeURIComponent(elegido.nombre + ' anime icon aesthetic')}&apikey=${CAUSA_API_KEY}`)
        if (res.data.data.length > 0) foto = res.data.data[Math.floor(Math.random() * res.data.data.length)].image
    } catch (e) { }

    conn.adivinar[id] = {
        p1: m.sender,
        p2: who,
        status: 'WAITING',
        apuesta: monto,
        chosen: elegido,
        pistaNum: 0,
        foto: foto,
        timeout: setTimeout(() => {
            if (conn.adivinar[id]) {
                conn.reply(m.chat, `╭━━━[ ⏰ INVITACIÓN CADUCADA ]━━━╮\n┃\n┣ • @${who.split('@')[0]} no aceptó.\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯`, m, { mentions: [who] })
                delete conn.adivinar[id]
            }
        }, 60000)
    }

    let txt = `╭━━━[ ⚔️ RETO DE DUELO ]━━━╮\n`
    txt += `┃\n`
    txt += `┣ • *Iniciador:* @${m.sender.split('@')[0]}\n`
    txt += `┣ • *Objetivo:* @${who.split('@')[0]}\n`
    txt += `┣ • *Botín:* ${monto.toLocaleString()} ${userCurrency}\n`
    txt += `┃\n`
    txt += `┣ > @${who.split('@')[0]},\n`
    txt += `┣ > escribe *aceptar* para jugar.\n`
    txt += `╰━━━━━━━━━━━━━━━━━━━━━╯`

    await conn.reply(m.chat, txt, m, { mentions: [m.sender, who] })
}

handler.help = ['adivinar @user <monto>']
handler.tags = ['juegos']
handler.command = ['adivinar', 'guess']
handler.group = true

export default handler