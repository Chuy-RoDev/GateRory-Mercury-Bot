import fs from 'fs'

let handler = async (m, { conn, usedPrefix: _p, args, sender }) => {
  try {
    const username = m.pushName || conn.getName(sender) || sender.split('@')[0]

    let totalreg = Object.keys(global.db.data.users).length
    let totalCommands = Object.keys(global.plugins || {}).length

    const chatData = global.db.data.chats[m.chat] || {}
    const botnameLocal = chatData.botname || global.botname
    const currencyLocal = chatData.currency || global.currency
    const etiquetaLocal = global.etiqueta || 'Arlette-Xz'

    let menuImage
    if (chatData.menuImage) {
      menuImage = Buffer.from(chatData.menuImage, 'base64')
    } else {
      const menuImages = ['menu.jpg', 'menu2.jpg', 'menu3.jpg', 'menu4.jpg', 'menu5.jpg', 'menu6.jpg', 'menu7.jpg']
      let existingImages = []
      for (let imgName of menuImages) {
        const imgPath = `./src/assets/${imgName}`
        if (fs.existsSync(imgPath)) existingImages.push(imgPath)
      }
      if (existingImages.length > 0) {
        const randomIndex = Math.floor(Math.random() * existingImages.length)
        menuImage = fs.readFileSync(existingImages[randomIndex])
      } else {
        menuImage = global.icono
      }
    }

    const menuHeader = `
「🖤」 ¡Hola! *${username}*, Soy *${botnameLocal}*
> Aquí tienes la lista de comandos.

╭┈ ↷
│❀ 𝗠𝗼𝗱𝗼 » Público
│ᰔ 𝗧𝗶𝗽𝗼 » ${(conn.user.jid == global.conn.user.jid ? 'Principal' : 'Sub-Bot')}
│❀ 𝗖𝗿𝗲𝗮𝗱𝗼𝗿𝗮 & 𝗠𝗼𝗱𝗲𝗮𝗱𝗼 » ${etiquetaLocal}
│⚘ 𝗣𝗿𝗲𝗳𝗶𝗷𝗼 » ${_p}
│✰ 𝗨𝘀𝘂𝗮𝗿𝗶𝗼𝘀 » ${totalreg.toLocaleString()}
│⚘ 𝗩𝗲𝗿𝘀𝗶𝗼𝗻 » ${vs}
│🜸 𝗕𝗮𝗶𝗹𝗲𝘆𝘀 » Multi Device
│💰 𝗠𝗼𝗻𝗲𝗱𝗮 » ${currencyLocal}
╰─────────────────
`.trim()

    const menus = {

      // ──────────────────────────────────────
      //  INFO
      // ──────────────────────────────────────
      info: `
\`˚.⋆ֹ  ꒰ I N F O - B O T ꒱ ㆍ₊⊹\`
> Comandos de 𝗜𝗻𝗳𝗼-𝗯𝗼𝘁.
> *${_p}help • ${_p}menu*
> ⚘ Ver el menú de comandos.
> *${_p}creditos • ${_p}credits*
> ⚘ Ver los créditos y agradecimientos del bot.
> *${_p}p • ${_p}ping*
> ⚘ Ver la velocidad de respuesta del bot.
> *${_p}status*
> ⚘ Ver estado del sistema de alojamiento.
> *${_p}sug • ${_p}suggest*
> ⚘ Sugerir nuevas funciones al desarrollador.
> *${_p}report*
> ⚘ Reportar fallas o problemas del bot.
> *${_p}ds • ${_p}fixmsg*
> ⚘ Eliminar archivos de sesión innecesarios.`,

      // ──────────────────────────────────────
      //  UTILIDADES
      // ──────────────────────────────────────
      utilidades: `
\`˚.⋆ֹ  ꒰ U T I L I D A D E S ꒱ ㆍ₊⊹\`
> Comandos de 𝗨𝘁𝗶𝗹𝗶𝗱𝗮𝗱𝗲𝘀.
> *${_p}calcular • ${_p}cal*
> ⚘ Calcular tipos de ecuaciones.
> *${_p}chatgpt • ${_p}ia* + [consulta]
> ⚘ Hacer una consulta a la inteligencia artificial.
> *${_p}factos • ${_p}facto*
> ⚘ Tirar verdades absolutas.
> *${_p}fetch* + [URL]
> ⚘ Obtener información de una URL.
> *${_p}getnum*
> ⚘ Obtener el número de un usuario.
> *${_p}letra* + [canción]
> ⚘ Buscar la letra de una canción.
> *${_p}onlycc*
> ⚘ Comando restrictivo de control.
> *${_p}react* + {citar mensaje}
> ⚘ Reaccionar a un mensaje con un emoji.
> *${_p}read • ${_p}readviewonce*
> ⚘ Ver imágenes y videos viewonce.
> *${_p}speedtest*
> ⚘ Ver la velocidad de conexión del servidor.
> *${_p}sticker • ${_p}s*
> ⚘ Convertir una imagen/video a sticker.
> *${_p}toimg • ${_p}img*
> ⚘ Convertir un sticker a imagen.
> *${_p}tourl • ${_p}catbox*
> ⚘ Convertir imagen/video en URL.
> *${_p}translate • ${_p}traducir • ${_p}trad* + [idioma] [texto]
> ⚘ Traducir palabras en otros idiomas.`,

      // ──────────────────────────────────────
      //  DIVERSIÓN
      // ──────────────────────────────────────
      diversion: `
\`˚.⋆ֹ  ꒰ D I V E R S I Ó N ꒱ ㆍ₊⊹\`
> Comandos para pasar el rato.
> *${_p}8ball* + [pregunta]
> ⚘ Pregunta a la bola mágica del destino.
> *${_p}compatibilidad • ${_p}love • ${_p}ship* + <@mencion>
> ⚘ Medir compatibilidad entre dos personas.
> *${_p}emo* + <@mencion>
> ⚘ Medir el porcentaje emo de alguien.
> *${_p}gay* + <@mencion>
> ⚘ Medidor de porcentaje gay.
> *${_p}hetero* + <@mencion>
> ⚘ Medir el porcentaje heterosexual de alguien.
> *${_p}impostor* + <@mencion>
> ⚘ Descubrir quién es el impostor del grupo.
> *${_p}ppccpp*
> ⚘ Genera imágenes compartidas para parejas/amigos.
> *${_p}puta* + <@mencion>
> ⚘ Medir el nivel de puta de alguien.
> *${_p}top10*
> ⚘ Ver el top 10 aleatorio de usuarios del grupo.`,

      // ──────────────────────────────────────
      //  DESCARGAS
      // ──────────────────────────────────────
      descargas: `
\`˚.⋆ֹ  ꒰ D E S C A R G A S ꒱ ㆍ₊⊹\`
> Comandos de 𝗗𝗲𝘀𝗰𝗮𝗿𝗴𝗮𝘀 para descargar archivos de varias fuentes.
> *${_p}applemusic* + [canción]
> ⚘ Descargar música de Apple Music.
> *${_p}facebook • ${_p}fb* + [Link]
> ⚘ Descargar un video de Facebook.
> *${_p}image • ${_p}imagen* + [busqueda]
> ⚘ Buscar y descargar imágenes de Google.
> *${_p}ig • ${_p}instagram* + [Link]
> ⚘ Descargar un reel de Instagram.
> *${_p}mediafire • ${_p}mf* + [Link]
> ⚘ Descargar un archivo de MediaFire.
> *${_p}mega • ${_p}mg* + [Link]
> ⚘ Descargar un archivo de MEGA.
> *${_p}modapk • ${_p}apk* + [busqueda]
> ⚘ Buscar y descargar APKs modificados.
> *${_p}pinterest • ${_p}pin* + [busqueda] / [Link]
> ⚘ Buscar y descargar imágenes de Pinterest.
> *${_p}play • ${_p}play2 • ${_p}ytmp3 • ${_p}ytmp4* + [canción] / [Link]
> ⚘ Descargar una canción o vídeo de YouTube.
> *${_p}spotify* + [canción] / [Link]
> ⚘ Descargar música de Spotify.
> *${_p}tiktok • ${_p}tt* + [Link] / [busqueda]
> ⚘ Descargar un video de TikTok.
> *${_p}twitter • ${_p}x* + [Link]
> ⚘ Descargar un video de Twitter/X.
> *${_p}ytsearch* + [busqueda]
> ⚘ Buscar videos de YouTube.`,

      // ──────────────────────────────────────
      //  GACHA
      // ──────────────────────────────────────
      gacha: `
\`˚.⋆ֹ  ꒰ G A C H A ꒱ ㆍ₊⊹\`
> Comandos de 𝗚𝗮𝗰𝗵𝗮 para reclamar y coleccionar personajes.
> *${_p}buycharacter • ${_p}buychar • ${_p}buyc* + [nombre]
> ⚘ Comprar un personaje en venta.
> *${_p}charimage • ${_p}cimage • ${_p}wimage* + [nombre]
> ⚘ Ver una imagen aleatoria de un personaje.
> *${_p}charinfo • ${_p}winfo • ${_p}waifuinfo* + [nombre]
> ⚘ Ver información de un personaje.
> *${_p}claim • ${_p}c • ${_p}reclamar* + {citar personaje}
> ⚘ Reclamar un personaje.
> *${_p}deletewaifu • ${_p}delwaifu • ${_p}delchar* + [nombre]
> ⚘ Eliminar un personaje reclamado.
> *${_p}favoritetop • ${_p}favtop*
> ⚘ Ver el top de personajes favoritos.
> *${_p}gachainfo • ${_p}ginfo • ${_p}infogacha*
> ⚘ Ver tu información de gacha.
> *${_p}giveallharem* + [@usuario]
> ⚘ Regalar todos tus personajes a otro usuario.
> *${_p}regalar* + [@usuario] [nombre]
> ⚘ Regalar un personaje a otro usuario.
> *${_p}harem • ${_p}waifus • ${_p}claims* + <@usuario>
> ⚘ Ver tus personajes reclamados.
> *${_p}haremshop • ${_p}tiendawaifus • ${_p}wshop* + <Pagina>
> ⚘ Ver los personajes en venta.
> *${_p}protegerwaifu* + [nombre]
> ⚘ Proteger un personaje de robos por tiempo limitado.
> *${_p}removesale • ${_p}removerventa* + [precio] [nombre]
> ⚘ Eliminar un personaje en venta.
> *${_p}robwaifu • ${_p}robarwaifu* + [@usuario]
> ⚘ Robar un personaje a otro usuario.
> *${_p}rollwaifu • ${_p}rw*
> ⚘ Waifu o husbando aleatorio.
> *${_p}sell • ${_p}vender* + [precio] [nombre]
> ⚘ Poner un personaje a la venta.
> *${_p}serieinfo • ${_p}ainfo • ${_p}animeinfo* + [nombre]
> ⚘ Información de un anime.
> *${_p}serielist • ${_p}slist • ${_p}animelist*
> ⚘ Listar series del bot.
> *${_p}setfav* + [Personaje]
> ⚘ Establecer tu personaje favorito.
> *${_p}trade • ${_p}intercambiar* + [Tu personaje] : [Personaje 2]
> ⚘ Intercambiar un personaje con otro usuario.
> *${_p}vote • ${_p}votar* + [nombre]
> ⚘ Votar por un personaje para subir su valor.
> *${_p}waifusboard • ${_p}waifustop • ${_p}topwaifus • ${_p}wtop* + <número>
> ⚘ Ver el top de personajes con mayor valor.
> *${_p}ogw • ${_p}dar* + [nombre] [@usuario]
> ⚘ Inyectar personaje a un inventario (Solo Creador).`,

      // ──────────────────────────────────────
      //  BOTS
      // ──────────────────────────────────────
      bots: `
\`˚.⋆ֹ  ꒰ B O T S ꒱ ㆍ₊⊹\`
> Comandos para registrar y gestionar Bots.
> *${_p}bots • ${_p}botlist*
> ⚘ Ver el número de bots activos.
> *${_p}botresetall • ${_p}resetbot*
> ⚘ Restablecer configuración del bot en el grupo.
> *${_p}infobot*
> ⚘ Ver información del socket actual.
> *${_p}join* + [Invitacion]
> ⚘ Unir al bot a un grupo.
> *${_p}leave • ${_p}salir*
> ⚘ Salir de un grupo.
> *${_p}logout*
> ⚘ Cerrar sesión del bot.
> *${_p}p • ${_p}ping*
> ⚘ Medir tiempo de respuesta.
> *${_p}qr • ${_p}code*
> ⚘ Crear un Sub-Bot con un código QR/Code.
> *${_p}setbotname* + [nombre]
> ⚘ Cambiar el nombre del bot en el menú (por grupo).
> *${_p}setbotpfp • ${_p}botpfp*
> ⚘ Cambiar la foto de perfil del bot en el menú (por grupo).
> *${_p}setcurrency • ${_p}setbotcoin • ${_p}setmoneda* + [nombre]
> ⚘ Cambiar el nombre de la moneda (por grupo).
> *${_p}setpfp • ${_p}setimage*
> ⚘ Cambiar la imagen de perfil real del bot.
> *${_p}setprimary* + [@bot]
> ⚘ Establecer un bot como primario del grupo.
> *${_p}setstatus* + [estado]
> ⚘ Cambiar el estado del bot.
> *${_p}setusername* + [nombre]
> ⚘ Cambiar el nombre de usuario del bot.
> *${_p}status • ${_p}estado*
> ⚘ Ver estado del bot.`,

      // ──────────────────────────────────────
      //  ECONOMÍA
      // ──────────────────────────────────────
      economia: `
\`˚.⋆ֹ  ꒰ E C O N O M I A ꒱ ㆍ₊⊹\`
> Comandos de 𝗘𝗰𝗼𝗻𝗼𝗺𝗶𝗮 para ganar dinero.
> *${_p}aventura • ${_p}adventure*
> ⚘ Aventuras para ganar ${currencyLocal} y exp.
> *${_p}balance • ${_p}bal • ${_p}bank* + <usuario>
> ⚘ Ver cuántos ${currencyLocal} tienes.
> *${_p}casino • ${_p}apostar • ${_p}slot* + [cantidad]
> ⚘ Apostar ${currencyLocal} en el casino.
> *${_p}cazar • ${_p}hunt*
> ⚘ Cazar animales para ganar ${currencyLocal} y exp.
> *${_p}coinflip • ${_p}flip • ${_p}cf* + [cantidad] <cara/cruz>
> ⚘ Apostar ${currencyLocal} en un cara o cruz.
> *${_p}cofre • ${_p}coffer*
> ⚘ Reclamar tu cofre diario.
> *${_p}crime • ${_p}crimen*
> ⚘ Ganar ${currencyLocal} rápido.
> *${_p}curar • ${_p}heal*
> ⚘ Curar salud para salir de aventuras.
> *${_p}daily • ${_p}diario*
> ⚘ Reclamar tu recompensa diaria.
> *${_p}deposit • ${_p}dep • ${_p}depositar* + [cantidad] / all
> ⚘ Depositar ${currencyLocal} en el banco.
> *${_p}economyboard • ${_p}eboard • ${_p}baltop* + <pagina>
> ⚘ Ver el ranking económico del grupo.
> *${_p}economyinfo • ${_p}einfo*
> ⚘ Ver tu información de economía.
> *${_p}fish • ${_p}pescar*
> ⚘ Ganar ${currencyLocal} y exp pescando.
> *${_p}givecoins • ${_p}pay • ${_p}coinsgive* + [usuario] [cantidad]
> ⚘ Dar ${currencyLocal} a un usuario.
> *${_p}mazmorra • ${_p}dungeon*
> ⚘ Explorar mazmorras para ganar ${currencyLocal} y exp.
> *${_p}miming • ${_p}minar • ${_p}mine*
> ⚘ Realizar trabajos de minería y ganar ${currencyLocal}.
> *${_p}monthly • ${_p}mensual*
> ⚘ Reclamar tu recompensa mensual.
> *${_p}roulette • ${_p}rt* + [red/black] [cantidad]
> ⚘ Apostar ${currencyLocal} en una ruleta.
> *${_p}slut • ${_p}prostituirse*
> ⚘ Ganar ${currencyLocal} prostituyéndote.
> *${_p}steal • ${_p}robar • ${_p}rob* + [@mencion]
> ⚘ Intentar robar ${currencyLocal} a un usuario.
> *${_p}w • ${_p}work • ${_p}trabajar*
> ⚘ Ganar ${currencyLocal} trabajando.
> *${_p}weekly • ${_p}semanal*
> ⚘ Reclamar tu recompensa semanal.
> *${_p}withdraw • ${_p}with • ${_p}retirar* + [cantidad] / all
> ⚘ Retirar ${currencyLocal} del banco.`,

      // ──────────────────────────────────────
      //  PERFIL
      // ──────────────────────────────────────
      perfil: `
\`˚.⋆ֹ  ꒰ P E R F I L ꒱ ㆍ₊⊹\`
> Comandos de 𝗣𝗲𝗿𝗳𝗶𝗹 para ver y configurar tu perfil.
> *${_p}adoptar • ${_p}adopt* + <@Mencion>
> ⚘ Adoptar a un usuario como hijo.
> *${_p}marry* + <@Mencion>
> ⚘ Casarte con alguien.
> *${_p}delbirth*
> ⚘ Borrar tu fecha de cumpleaños.
> *${_p}deldescription • ${_p}deldesc*
> ⚘ Eliminar tu descripción.
> *${_p}delgenre*
> ⚘ Eliminar tu género.
> *${_p}divorce*
> ⚘ Divorciarte de tu pareja.
> *${_p}lboard* + <Página>
> ⚘ Top de usuarios con más experiencia.
> *${_p}level • ${_p}lvl* + <@Mencion>
> ⚘ Ver tu nivel y experiencia actual.
> *${_p}profile* + <@Mencion>
> ⚘ Ver tu perfil.
> *${_p}setbirth* + [fecha]
> ⚘ Establecer tu fecha de cumpleaños.
> *${_p}setdescription • ${_p}setdesc* + [Descripcion]
> ⚘ Establecer tu descripción.
> *${_p}setgenre* + Hombre / Mujer
> ⚘ Establecer tu género.
> *${_p}setpfp*
> ⚘ Cambiar tu foto de perfil del bot.
> *${_p}top10*
> ⚘ Ver el top 10 de usuarios del grupo.`,

      // ──────────────────────────────────────
      //  GRUPOS
      // ──────────────────────────────────────
      grupos: `
\`˚.⋆ֹ  ꒰ G R U P O S ꒱ ㆍ₊⊹\`
> Comandos para Administradores de grupos.
> *${_p}add • ${_p}añadir • ${_p}agregar* + {número}
> ⚘ Agregar un número al grupo.
> *${_p}addwarn • ${_p}warn* + <@usuario>
> ⚘ Advertir a un usuario.
> *${_p}listadv*
> ⚘ Ver lista de usuarios advertidos.
> *${_p}antilink • ${_p}antienlace* + [enable/disable]
> ⚘ Activar/desactivar el antienlace.
> *${_p}bot* + [enable/disable]
> ⚘ Activar/desactivar al bot.
> *${_p}close • ${_p}cerrar*
> ⚘ Cerrar el grupo (solo admins pueden escribir).
> *${_p}del • ${_p}delete* + {citar mensaje}
> ⚘ Eliminar un mensaje.
> *${_p}demote* + <@usuario>
> ⚘ Descender a un usuario de administrador.
> *${_p}detect • ${_p}alertas* + [enable/disable]
> ⚘ Activar/desactivar alertas de promote/demote.
> *${_p}economy* + [enable/disable]
> ⚘ Activar/desactivar los comandos de economía.
> *${_p}gacha* + [enable/disable]
> ⚘ Activar/desactivar los comandos de Gacha.
> *${_p}gp • ${_p}infogrupo*
> ⚘ Ver la información del grupo.
> *${_p}kick* + <@usuario>
> ⚘ Expulsar a un usuario del grupo.
> *${_p}kicknum • ${_p}listnum* + [prefijo]
> ⚘ Eliminar usuarios con prefijo de país.
> *${_p}mute* + <@usuario>
> ⚘ Silenciar a un usuario en el chat.
> *${_p}nsfw* + [enable/disable]
> ⚘ Activar/desactivar los comandos NSFW.
> *${_p}onlyadmin* + [enable/disable]
> ⚘ Solo admins pueden usar comandos.
> *${_p}open • ${_p}abrir*
> ⚘ Abrir el grupo para todos.
> *${_p}promote* + <@usuario>
> ⚘ Ascender a un usuario a administrador.
> *${_p}restablecer • ${_p}revoke*
> ⚘ Restablecer el enlace del grupo.
> *${_p}setbye* + [texto]
> ⚘ Establecer mensaje de despedida personalizado.
> *${_p}setwelcome* + [texto]
> ⚘ Establecer mensaje de bienvenida personalizado.
> *${_p}tag • ${_p}hidetag* + [mensaje]
> ⚘ Mencionar a todos los usuarios del grupo.
> *${_p}unwarn • ${_p}delwarn* + <@usuario>
> ⚘ Quitar advertencias de un usuario.
> *${_p}welcome • ${_p}bienvenida* + [enable/disable]
> ⚘ Activar/desactivar la bienvenida y despedida.`,

      // ──────────────────────────────────────
      //  NSFW
      // ──────────────────────────────────────
      nsfw: `
\`˚.⋆ֹ  ꒰ N S F W ꒱ ㆍ₊⊹\`
> Comandos de contenido para adultos.
> *${_p}rule34 • ${_p}r34* + [Tags]
> ⚘ Buscar imágenes en Rule34.
> *${_p}xvideos • ${_p}xvideosdl* + [Link]
> ⚘ Descargar un video de Xvideos.
> *${_p}anal* + <mencion>
> ⚘ Hacer un anal.
> *${_p}bath* + <mencion>
> ⚘ Bañarse con alguien.
> *${_p}blowjob • ${_p}mamada • ${_p}bj* + <mencion>
> ⚘ Dar una mamada.
> *${_p}boobjob* + <mencion>
> ⚘ Hacer una rusa.
> *${_p}cafe* + <mencion>
> ⚘ Tomarte un cafecito con alguien.
> *${_p}cum* + <mencion>
> ⚘ Venirse en alguien.
> *${_p}fap* + <mencion>
> ⚘ Hacerse una paja.
> *${_p}footjob* + <mencion>
> ⚘ Hacer una paja con los pies.
> *${_p}fuck • ${_p}coger • ${_p}fuck2* + <mencion>
> ⚘ Follarte a alguien.
> *${_p}grabboobs* + <mencion>
> ⚘ Agarrar tetas.
> *${_p}grop* + <mencion>
> ⚘ Manosear a alguien.
> *${_p}lickpussy* + <mencion>
> ⚘ Lamer un coño.
> *${_p}sixnine • ${_p}69* + <mencion>
> ⚘ Hacer un 69 con alguien.
> *${_p}spank • ${_p}nalgada* + <mencion>
> ⚘ Dar una nalgada.
> *${_p}suckboobs* + <mencion>
> ⚘ Chupar tetas.
> *${_p}violar • ${_p}perra* + <mencion>
> ⚘ Violar a alguien.
> *${_p}waifu*
> ⚘ Buscar una waifu aleatoria.
> *${_p}yuri • ${_p}tijeras* + <mencion>
> ⚘ Hacer tijeras.`,

      // ──────────────────────────────────────
      //  ANIME
      // ──────────────────────────────────────
      anime: `
\`˚.⋆ֹ  ꒰ A N I M E ꒱ ㆍ₊⊹\`
> Comandos de reacciones de anime.
> *${_p}angry* + <mencion>
> ⚘ Estar enojado.
> *${_p}bath* + <mencion>
> ⚘ Bañarse.
> *${_p}bite • ${_p}morder* + <mencion>
> ⚘ Morder a alguien.
> *${_p}bleh* + <mencion>
> ⚘ Sacar la lengua.
> *${_p}blush* + <mencion>
> ⚘ Sonrojarte.
> *${_p}bored • ${_p}aburrido* + <mencion>
> ⚘ Estar aburrido.
> *${_p}bully* + <mencion>
> ⚘ Molestar a alguien.
> *${_p}clap* + <mencion>
> ⚘ Aplaudir.
> *${_p}coffee • ${_p}cafe* + <mencion>
> ⚘ Tomar café.
> *${_p}cringe* + <mencion>
> ⚘ Sentir vergüenza ajena.
> *${_p}cry* + <mencion>
> ⚘ Llorar por algo o alguien.
> *${_p}cuddle* + <mencion>
> ⚘ Acurrucarse.
> *${_p}dance* + <mencion>
> ⚘ Sacar los pasitos prohibidos.
> *${_p}dramatic • ${_p}drama* + <mencion>
> ⚘ Drama.
> *${_p}drunk* + <mencion>
> ⚘ Estar borracho.
> *${_p}eat • ${_p}comer* + <mencion>
> ⚘ Comer algo delicioso.
> *${_p}handhold* + <mencion>
> ⚘ Tomarse de la mano.
> *${_p}happy • ${_p}feliz* + <mencion>
> ⚘ Saltar de felicidad.
> *${_p}highfive* + <mencion>
> ⚘ Chocar los cinco.
> *${_p}hug* + <mencion>
> ⚘ Dar un abrazo.
> *${_p}impregnate • ${_p}preg* + <mencion>
> ⚘ Embarazar a alguien.
> *${_p}kill* + <mencion>
> ⚘ Tomar tu arma y matar a alguien.
> *${_p}kiss • ${_p}muak* + <mencion>
> ⚘ Dar un beso.
> *${_p}kisscheek • ${_p}beso* + <mencion>
> ⚘ Beso en la mejilla.
> *${_p}laugh* + <mencion>
> ⚘ Reírte de algo o alguien.
> *${_p}lick* + <mencion>
> ⚘ Lamer a alguien.
> *${_p}love • ${_p}amor* + <mencion>
> ⚘ Sentirse enamorado.
> *${_p}pat* + <mencion>
> ⚘ Acariciar a alguien.
> *${_p}poke* + <mencion>
> ⚘ Picar a alguien.
> *${_p}pout* + <mencion>
> ⚘ Hacer pucheros.
> *${_p}punch* + <mencion>
> ⚘ Dar un puñetazo.
> *${_p}run • ${_p}correr* + <mencion>
> ⚘ Correr.
> *${_p}sad • ${_p}triste* + <mencion>
> ⚘ Expresar tristeza.
> *${_p}scared* + <mencion>
> ⚘ Estar asustado.
> *${_p}seduce* + <mencion>
> ⚘ Seducir a alguien.
> *${_p}shy • ${_p}timido* + <mencion>
> ⚘ Sentir timidez.
> *${_p}slap* + <mencion>
> ⚘ Dar una bofetada.
> *${_p}sleep* + <mencion>
> ⚘ Tumbarte a dormir.
> *${_p}smile* + <mencion>
> ⚘ Sonreír con ternura.
> *${_p}smoke • ${_p}fumar* + <mencion>
> ⚘ Fumar.
> *${_p}smug* + <mencion>
> ⚘ Presumir con estilo.
> *${_p}spit • ${_p}escupir* + <mencion>
> ⚘ Escupir.
> *${_p}step • ${_p}pisar* + <mencion>
> ⚘ Pisar a alguien.
> *${_p}think* + <mencion>
> ⚘ Pensar en algo.
> *${_p}walk* + <mencion>
> ⚘ Caminar.
> *${_p}wave* + <mencion>
> ⚘ Saludar con la mano.
> *${_p}wink* + <mencion>
> ⚘ Guiñar el ojo.`,

      // ──────────────────────────────────────
      //  CRÉDITOS
      // ──────────────────────────────────────
      creditos: `
\`˚.⋆ֹ  ꒰ C R É D I T O S ꒱ ㆍ₊⊹\`
> Créditos y agradecimientos del bot.
> *${_p}creditos • ${_p}credits*
> ⚘ Ver los créditos del bot.`

    }

    const category = args[0]?.toLowerCase()
    let selectedMenu = menus[category]
    if (!selectedMenu) selectedMenu = Object.values(menus).join('\n\n')

    const txt = `${menuHeader}\n\n${selectedMenu}\n\n> ✐ Powered By Arlette Xz, Editado por Perez/Chuy\n>`

    conn.sendMessage(m.chat, {
      image: menuImage,
      caption: txt,
      contextInfo: {
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: '120363383020613271@newsletter',
          serverMessageId: '',
          newsletterName: '【 ✰ 】Rory - Mercury'
        }
      }
    }, { quoted: m })

  } catch (e) {
    conn.sendMessage(m.chat, { text: `✰ Error en el menú:\n${e}` }, { quoted: m })
  }
}

handler.help = ['menu']
handler.tags = ['main']
handler.command = ['menu', 'menú', 'help', 'comandos', 'commands', '']
handler.group = true
export default handler