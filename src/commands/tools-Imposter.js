/**
 * Ni CAGANDO LOGRO HACER ESTO SIN IA XDDDDDDDDDDDDD. Es 80/20, 80% Ia 20% modificado por mi asdasjdasjdkasdj
 */

const bancoDeDatos = {
    'Genshin Impact': [
        { palabra: 'Raiden Shogun', pista: 'Gobierna con mano de hierro y busca la estasis eterna.' },
        { palabra: 'Hu Tao', pista: 'Su negocio florece cuando la vida se apaga; le gusta bromear.' },
        { palabra: 'Furina', pista: 'Una estrella de teatro que oculta una gran soledad bajo el agua.' },
        { palabra: 'Nahida', pista: 'La mente más brillante encerrada en un cuerpo pequeño.' },
        { palabra: 'Zhongli', pista: 'Un consultor que olvida su cartera pero recuerda cada contrato.' },
        { palabra: 'Yelan', pista: 'Se mueve entre las sombras usando hilos y juegos de azar.' },
        { palabra: 'Arlecchino', pista: 'La "Padre" que cuida a sus niños con una elegancia letal.' },
        { palabra: 'Xiao', pista: 'Carga con el dolor del pasado eliminando demonios en solitario.' },
        { palabra: 'Kazuha', pista: 'Un viajero errante que escucha la voz de la naturaleza.' },
        { palabra: 'Venti', pista: 'Un bardo amante del vino que prefiere la libertad a gobernar.' },
        { palabra: 'Neuvillette', pista: 'Juez supremo al que le gusta catar diferentes tipos de agua.' },
        { palabra: 'Childe', pista: 'Un guerrero sediento de batalla que usa el arco como último recurso.' },
        { palabra: 'Navia', pista: 'Líder con gafas de sol que resuelve problemas a cañonazos.' },
        { palabra: 'Alhaitham', pista: 'Un escriba que solo quiere leer en paz con sus auriculares.' }
    ],
    'Honkai: Star Rail': [
        { palabra: 'Kafka', pista: 'Toca el violín imaginario y usa hilos para controlar a sus presas.' },
        { palabra: 'Firefly', pista: 'Una chica dulce que esconde un traje de combate destructivo.' },
        { palabra: 'Acheron', pista: 'Se pierde constantemente, pero su espada corta hasta el vacío.' },
        { palabra: 'Dan Heng', pista: 'El guardia del tren que huye de su pasado y usa una lanza.' },
        { palabra: 'March 7th', pista: 'Toma fotos de todo para no olvidar quién es. Usa arco y hielo.' },
        { palabra: 'Himeko', pista: 'Le encanta preparar café, aunque a nadie le gusta cómo sabe.' },
        { palabra: 'Jing Yuan', pista: 'Un general perezoso que invoca a un gigante eléctrico.' },
        { palabra: 'Aventurine', pista: 'Un apostador empedernido que siempre apuesta al todo o nada.' },
        { palabra: 'Black Swan', pista: 'Lectora de recuerdos que flota y usa cartas del tarot.' },
        { palabra: 'Sparkle', pista: 'Una maestra del disfraz a la que solo le importa la diversión caótica.' }
    ],
    'Zenless Zone Zero': [
        { palabra: 'Ellen Joe', pista: 'Tiene cola, quiere dormir y siempre está cansada de trabajar.' },
        { palabra: 'Jane Doe', pista: 'Una escurridiza agente que se infiltra como un roedor.' },
        { palabra: 'Zhu Yuan', pista: 'Mantiene el orden con una disciplina impecable y uniforme.' },
        { palabra: 'Anby Demara', pista: 'Fría como el rayo, apasionada por el cine y las hamburguesas.' },
        { palabra: 'Nicole Demara', pista: 'La jefa que siempre está en bancarrota a pesar de sus planes.' },
        { palabra: 'Von Lycaon', pista: 'Un caballero con pelaje que sirve con una etiqueta perfecta.' },
        { palabra: 'Grace Howard', pista: 'Trata a las máquinas como si fueran sus propios hijos.' },
        { palabra: 'Koleda Belobog', pista: 'Pequeña pero lidera una constructora con un martillo gigante.' },
        { palabra: 'Nekomata', pista: 'Gata callejera que ataca por la espalda y ama el pescado.' }
    ],
    'Blue Archive': [
        { palabra: 'Azusa', pista: 'Una estudiante seria que busca derrotar al mal a toda costa.' },
        { palabra: 'Hoshino', pista: 'Le gusta dormir en cualquier lado y se hace llamar "tío".' },
        { palabra: 'Yuuka', pista: 'La tesorera que te regaña por gastar dinero en figuras.' },
        { palabra: 'Aris', pista: 'Una heroína de videojuegos que dispara luz con un cañón enorme.' },
        { palabra: 'Aru', pista: 'Quiere ser una forajida ruda, pero siempre termina en pánico.' },
        { palabra: 'Hina', pista: 'La prefecta más fuerte y temida, aunque solo quiere descansar.' },
        { palabra: 'Mika', pista: 'Fuerza bruta escondida detrás de una sonrisa de princesa.' },
        { palabra: 'Plana', pista: 'Una IA del sistema operativo que viste de negro y rojo.' }
    ],
    'Las Quintillizas': [
        { palabra: 'Miku Nakano', pista: 'La tercera que siempre lleva algo alrededor del cuello.' },
        { palabra: 'Nino Nakano', pista: 'Es ruda por fuera pero cocina con un amor inmenso.' },
        { palabra: 'Itsuki Nakano', pista: 'La más responsable y con un apetito insaciable.' },
        { palabra: 'Ichika Nakano', pista: 'La hermana mayor que sabe fingir muy bien frente a las cámaras.' },
        { palabra: 'Yotsuba Nakano', pista: 'Energía pura con un lazo en la cabeza que no sabe mentir.' }
    ],
    'Dragon Ball': [
        { palabra: 'Goku', pista: 'Siempre busca rivales fuertes y su hambre no tiene límite.' },
        { palabra: 'Vegeta', pista: 'El príncipe orgulloso que odia estar en segundo lugar.' },
        { palabra: 'Piccolo', pista: 'Empezó como un rey demonio y terminó de niñero verde.' },
        { palabra: 'Frieza', pista: 'Un emperador tirano que tiene varias transformaciones.' },
        { palabra: 'Cell', pista: 'Un bio-androide que absorbe a otros para alcanzar la perfección.' },
        { palabra: 'Majin Buu', pista: 'Convierte a sus enemigos en dulces para comérselos.' },
        { palabra: 'Broly', pista: 'Su poder crece sin control y pierde la razón al enojarse.' }
    ],
    'Naruto': [
        { palabra: 'Naruto', pista: 'Un ninja ruidoso que ama el ramen y nunca rompe su palabra.' },
        { palabra: 'Sasuke', pista: 'Busca venganza y tiene poderes oculares especiales.' },
        { palabra: 'Kakashi', pista: 'Siempre llega tarde y lee libros para adultos en público.' },
        { palabra: 'Itachi', pista: 'Asesinó a su propio clan para proteger a su hermano menor.' },
        { palabra: 'Jiraiya', pista: 'Un sabio ermitaño al que le gusta espiar en las aguas termales.' },
        { palabra: 'Gaara', pista: 'Carga una calabaza gigante y la arena lo protege automáticamente.' }
    ],
    'Leyendas y Waifus': [
        { palabra: 'Hatsune Miku', pista: 'Su voz llega a todo el mundo a través de bits y luz azul.' },
        { palabra: 'Rem', pista: 'La sirvienta de pelo azul que daría la vida por su héroe.' },
        { palabra: 'Megumin', pista: 'Una sola magia al día es suficiente para dejarlo todo en cenizas.' },
        { palabra: '2B', pista: 'Lucha por la humanidad en un mundo donde solo quedan máquinas.' },
        { palabra: 'Makima', pista: 'Te mira fijamente y te ordena ser su mascota.' },
        { palabra: 'Power', pista: 'Miente, odia bañarse y tiene una obsesión con la sangre.' },
        { palabra: 'Anya Forger', pista: 'Sabe lo que estás pensando y le encantan los cacahuetes.' },
        { palabra: 'Asuka', pista: 'Piloto pelirroja de temperamento fuerte y orgullosa de su origen.' },
        { palabra: 'Marin Kitagawa', pista: 'Otaku apasionada que necesita ayuda para hacer sus trajes.' },
        { palabra: 'Yor Forger', pista: 'Una madre torpe en casa, pero una asesina letal en el trabajo.' },
        { palabra: 'Kurumi Tokisaki', pista: 'Controla el tiempo y tiene un reloj en su ojo izquierdo.' },
        { palabra: 'Zero Two', pista: 'Llama a su compañero "Darling" y tiene cuernos.' }
    ]
};

global.impostorGame = global.impostorGame || {};

// Función auxiliar para garantizar la existencia de la cuenta de usuario en la BD
const initUser = (id) => {
    if (!global.db.data.users[id]) global.db.data.users[id] = {};
    if (typeof global.db.data.users[id].coin !== 'number') global.db.data.users[id].coin = 0;
};

let handler = async (m, { conn, usedPrefix, command }) => {
    const chat = m.chat;
    if (global.impostorGame[chat]) return m.reply('`[!] Operación activa en este sector.` 🛡️');

    let mentionedJid = m.mentionedJid || [];
    let targets = mentionedJid.length ? mentionedJid : (m.quoted && m.quoted.sender ? [m.quoted.sender] : []);
    const allPlayers = [...new Set([m.sender, ...targets])].slice(0, 9);

    if (allPlayers.length < 3) {
        return conn.reply(chat, `*｢ 📂 ERROR DE PROTOCOLO ｣*\n\nSe requieren al menos 3 operativos (Máx 9).\n\n> _Usa:_ *${usedPrefix}${command} @user1 @user2*`, m);
    }

    // Inicializar cuentas en base de datos
    allPlayers.forEach(id => initUser(id));

    global.impostorGame[chat] = {
        state: 'ACCEPTANCE',
        players: allPlayers.map((id, index) => ({ 
            id, 
            index: index + 1,
            accepted: false, 
            name: global.db.data.users[id]?.name || id.split('@')[0].trim()
        })),
        impostor: null,
        word: null,
        hint: null,
        category: null,
        rounds: allPlayers.length * 2,
        currentRound: 0,
        turn: null,
        lastTurn: null,
        votes: {},
        jackpot: 0,
        bet: 200000,
        pistaCosto: 100000,
        pistaComprada: false,
        timeout: setTimeout(() => {
            if (global.impostorGame[chat] && global.impostorGame[chat].state === 'ACCEPTANCE') {
                conn.reply(chat, '*｢ 📡 TIEMPO AGOTADO ｣*\n\nLa unidad no confirmó a tiempo. Abortando misión.', null);
                delete global.impostorGame[chat];
            }
        }, 120000) 
    };

    const playerList = global.impostorGame[chat].players.map(p => `> ● @${p.id.split('@')[0]}`).join('\n');
    const logs = `*｢ 📡 PROTOCOLO DE IDENTIDAD ｣*\n\nEsperando autorización (2 min):\n${playerList}\n\n*Escriban:* "aceptar" para confirmar.`;

    await conn.reply(chat, logs, m, { mentions: allPlayers });
};

handler.before = async function (m, { conn }) {
    if (!m.chat || !global.impostorGame) return;
    const chat = m.chat;
    const game = global.impostorGame[chat];
    const user = global.db.data.users;
    const sender = m.sender;
    const text = (m.text || '').trim();
    const textLC = text.toLowerCase();

    // Manejo de PM (Compra de pistas en privado)
    if (!m.isGroup) {
        const activeChat = Object.keys(global.impostorGame).find(id => 
            global.impostorGame[id].impostor === sender && global.impostorGame[id].state === 'PLAYING'
        );
        
        if (activeChat && (textLC.includes('pista') || textLC.includes('ayuda'))) {
            const g = global.impostorGame[activeChat];
            initUser(sender);
            
            if (user[sender].coin < g.pistaCosto) return m.reply('`[-] Fondos insuficientes. Requieres $100,000.`');
            if (g.pistaComprada) return m.reply('`[!] Filtración ya agotada.`');
            
            user[sender].coin -= g.pistaCosto;
            g.jackpot += g.pistaCosto;
            g.pistaComprada = true;
            
            return m.reply(`*｢ 📡 FILTRACIÓN ｣*\n\n*Categoría:* ${g.category}\n\n_Usa esta información para mimetizarte con los inocentes._`);
        }
        return;
    }

    if (!game) return;
    const isPlayer = game.players.find(p => p.id === sender);
    if (!isPlayer) return;

    // Fase de Aceptación
    if (game.state === 'ACCEPTANCE' && textLC === 'aceptar') {
        if (isPlayer.accepted) return;
        isPlayer.accepted = true;
        const faltan = game.players.filter(p => !p.accepted).length;
        
        if (faltan > 0) {
            return m.reply(`\`[+] @${sender.split('@')[0]} confirmado. Faltan ${faltan}.\``, null, { mentions: [sender] });
        } else {
            clearTimeout(game.timeout);
            
            const categorias = Object.keys(bancoDeDatos);
            const catAleatoria = categorias[Math.floor(Math.random() * categorias.length)];
            const target = bancoDeDatos[catAleatoria][Math.floor(Math.random() * bancoDeDatos[catAleatoria].length)];
            
            game.word = target.palabra;
            game.hint = target.pista;
            game.category = catAleatoria;
            game.impostor = game.players[Math.floor(Math.random() * game.players.length)].id;

            for (let p of game.players) {
                const isImp = p.id === game.impostor;
                const msg = isImp 
                    ? `*｢ 🌑 ROL: IMPOSTOR ｣*\n\n*Pista Críptica:* ${game.hint}\n\n_No conoces la palabra. Escribe "pista" aquí por $100k para saber la categoría._` 
                    : `*｢ 🛡️ ROL: INOCENTE ｣*\n\n*Categoría:* ${game.category}\n*Palabra Secreta:* ${game.word}\n\n_Describe el objetivo sin ser demasiado obvio._`;
                await conn.sendMessage(p.id, { text: msg });
            }

            game.state = 'PLAYING';
            const firstPlayer = game.players[Math.floor(Math.random() * game.players.length)].id;
            game.turn = firstPlayer;
            game.lastTurn = firstPlayer;
            
            return conn.reply(chat, `*｢ ⚔️ MISIÓN INICIADA ｣*\n\nLos roles y datos han sido enviados por privado. No revelen nada en este chat.\n\nTurno de: @${game.turn.split('@')[0]}\n> _Responde al mensaje del bot con tu descripción._`, m, { mentions: [game.turn] });
        }
    }

    // Fase de Juego
    if (game.state === 'PLAYING') {
        // Victoria anticipada del impostor al descubrir la palabra
        if (sender === game.impostor && textLC.includes(game.word.toLowerCase())) {
            initUser(sender);
            user[sender].coin += game.bet;
            await conn.reply(chat, `*｢ 🌑 OPERACIÓN FALLIDA ｣*\n\nEl impostor @${sender.split('@')[0]} ha descubierto la palabra: *${game.word}*.\n\nSe retira con $${game.bet.toLocaleString()}.`, m, { mentions: [sender] });
            delete global.impostorGame[chat];
            return;
        }

        if (game.turn === sender) {
            if (!(m.quoted && m.quoted.sender === conn.user.jid)) return m.reply('`[!] Responde al mensaje del bot para validar tu turno.`');
            game.currentRound++;
            
            if (game.currentRound >= game.rounds) {
                game.state = 'VOTING';
                const listV = game.players.map(p => `*${p.index}.* @${p.id.split('@')[0]}`).join('\n');
                return conn.reply(chat, `*｢ ⚖️ JUICIO FINAL ｣*\n\nEl tiempo de hablar terminó. Respondan con el *NÚMERO* del traidor:\n\n${listV}`, m, { mentions: game.players.map(p => p.id) });
            }

            // Selección segura del siguiente turno evitando bucles infinitos
            const candidatos = game.players.filter(p => p.id !== game.lastTurn);
            const next = candidatos.length ? candidatos[Math.floor(Math.random() * candidatos.length)].id : game.players[0].id;
            
            game.turn = next;
            game.lastTurn = next;
            return conn.reply(chat, `*RONDA ${game.currentRound + 1}/${game.rounds}*\nTurno de: @${next.split('@')[0]}`, m, { mentions: [next] });
        }
    }

    // Fase de Votación
    if (game.state === 'VOTING') {
        const voteIndex = parseInt(text);
        const voteTarget = game.players.find(p => p.index === voteIndex);
        
        if (voteTarget) {
            if (game.votes[sender]) return;
            game.votes[sender] = voteTarget.id;
            const totalVotes = Object.keys(game.votes).length;

            if (totalVotes === game.players.length) {
                const counts = {};
                Object.values(game.votes).forEach(v => counts[v] = (counts[v] || 0) + 1);
                const expulsadoId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

                if (expulsadoId === game.impostor) {
                    game.state = 'RISK';
                    await conn.reply(chat, `*｢ 🛡️ TRAIDOR IDENTIFICADO ｣*\n\n@${expulsadoId.split('@')[0]}, última oportunidad: Escribe la palabra exacta ahora.`, m, { mentions: [expulsadoId] });
                } else {
                    initUser(game.impostor);
                    const winAmt = game.bet + game.jackpot;
                    user[game.impostor].coin += winAmt;
                    await conn.reply(chat, `*｢ 🌑 ERROR DE LA UNIDAD ｣*\n\n@${expulsadoId.split('@')[0]} era inocente. El traidor era @${game.impostor.split('@')[0]}.\n\nBotín: $${winAmt.toLocaleString()}.`, m, { mentions: [expulsadoId, game.impostor] });
                    delete global.impostorGame[chat];
                }
            } else {
                return m.reply(`\`[+] Voto registrado (${totalVotes}/${game.players.length}).\``);
            }
        }
    }

    // Fase de Última Oportunidad (Riesgo)
    if (game.state === 'RISK' && sender === game.impostor) {
        initUser(sender);
        if (textLC === game.word.toLowerCase()) {
            user[sender].coin += game.bet;
            await conn.reply(chat, `*｢ 🌑 ESCAPE EXITOSO ｣*\n\nAdivinó la palabra: *${game.word}*. Se retira con su recompensa.`, m);
        } else {
            user[sender].coin = Math.max(0, user[sender].coin - game.bet);
            const rew = Math.floor((game.bet + game.jackpot) / (game.players.length - 1));
            game.players.filter(p => p.id !== game.impostor).forEach(p => {
                initUser(p.id);
                user[p.id].coin += rew;
            });
            await conn.reply(chat, `*｢ 🛡️ SENTENCIA ｣*\n\nIncorrecto. La palabra era: *${game.word}*.\nMulta cobrada y repartida entre los inocentes.`, m);
        }
        delete global.impostorGame[chat];
    }
};

handler.help = ['impostor']
handler.tags = ['games']
handler.command = ['impostor', 'traidor']
handler.group = true

export default handler