import fetch from 'node-fetch'

const captions = {
  peek: (from, to) => from === to ? `\`${from}\` está espiando detrás de una puerta! 👀` : `\`${from}\` está espiando a \`${to}\`! 👀`,
  comfort: (from, to) => from === to ? `\`${from}\` se está dando ánimos a sí mismo/a! ૮(˶ᵔᵕᵔ˶)ა` : `\`${from}\` está consolando a \`${to}\`! ૮(˶ᵔᵕᵔ˶)ა`,
  thinkhard: (from, to) => from === to ? `\`${from}\` está pensando muy intensamente! (⸝⸝╸-╺⸝⸝)` : `\`${from}\` está pensando profundamente en \`${to}\`! (⸝⸝╸-╺⸝⸝)`,
  curious: (from, to) => from === to ? `\`${from}\` siente curiosidad por todo! (,,◕.◕,,)` : `\`${from}\` está curioso/a por lo que hace \`${to}\`! (,,◕.◕,,)`,
  sniff: (from, to) => from === to ? `\`${from}\` se olfatea a sí mismo/a! (ㅇㅅㅇ❀)` : `\`${from}\` está olfateando a \`${to}\`! (ㅇㅅㅇ❀)`,
  stare: (from, to) => from === to ? `\`${from}\` se queda mirando al techo sin razón! ( ¬_¬)` : `\`${from}\` se le queda mirando fijamente a \`${to}\`! ( ¬_¬)`,
  trip: (from, to) => from === to ? `\`${from}\` se tropezó solito/a! ಥ_ಥ` : `\`${from}\` tropezó accidentalmente con \`${to}\`! ಥ_ಥ`,
  blowkiss: (from, to) => from === to ? `\`${from}\` se manda un beso al espejo! (˶ ˘ ³˘)` : `\`${from}\` le lanzó un beso a \`${to}\`! (˶ ˘ ³˘)`,
  snuggle: (from, to) => from === to ? `\`${from}\` se acurruca con una almohada! ꒰ঌ(˶ˆᗜˆ˵)໒꒱` : `\`${from}\` se acurruca dulcemente con \`${to}\`! ꒰ঌ(˶ˆᗜˆ˵)໒꒱`,
  sleep: (from, to) => from === to ? `\`${from}\` está durmiendo plácidamente! (∪｡∪)｡｡｡zzz` : `\`${from}\` está durmiendo junto a \`${to}\`! (∪｡∪)｡｡｡zzz`,
  cold: (from, to) => from === to ? `\`${from}\` tiene mucho frío! 🥶` : `\`${from}\` se está congelando por el frío de \`${to}\`! 🥶`,
  sing: (from, to) => from === to ? `\`${from}\` está cantando solo/a! 🎶` : `\`${from}\` le está cantando una canción a \`${to}\`! 🎶`,
  tickle: (from, to) => from === to ? `\`${from}\` se hace cosquillas solo/a! ٩(ˊᗜˋ*)و` : `\`${from}\` le está haciendo cosquillas a \`${to}\`! ٩(ˊᗜˋ*)و`,
  scream: (from, to) => from === to ? `\`${from}\` está gritando al viento! (꒪ka꒪)` : `\`${from}\` le está gritando a \`${to}\`! 😱`,
  push: (from, to) => from === to ? `\`${from}\` se empujó a sí mismo/a!` : `\`${from}\` empujó a \`${to}\`! 💥`,
  nope: (from, to) => from === to ? `\`${from}\` dice que no con la cabeza! (ভ_ visual)` : `\`${from}\` le dice claramente "¡No!" a \`${to}\`! 🙅‍♂️`,
  jump: (from, to) => from === to ? `\`${from}\` salta de emoción! ┗(＾0＾)┓` : `\`${from}\` salta de felicidad con \`${to}\`! ┗(＾0＾)┓`,
  heat: (from, to) => from === to ? `\`${from}\` siente mucho calor! 🥵` : `\`${from}\` tiene calor por estar cerca de \`${to}\`! 🥵`,
  gaming: (from, to) => from === to ? `\`${from}\` está jugando solo/a! 🎮` : `\`${from}\` está jugando videojuegos con \`${to}\`! 🎮`,
  draw: (from, to) => from === to ? `\`${from}\` está dibujando algo lindo! 🎨` : `\`${from}\` está haciendo un dibujo inspirado en \`${to}\`! 🎨`,
  call: (from, to) => from === to ? `\`${from}\` se llama a sí mismo/a! 📞` : `\`${from}\` le está marcando por teléfono a \`${to}\`! 📞`,
  seduce: (from, to) => from === to ? `\`${from}\` lanzó una mirada seductora al aire! ( ͡° ͜ʖ ͡°)` : `\`${from}\` está intentando seducir a \`${to}\`! ( ͡° ͜ʖ ͡°)`,
  shy: (from, to) => from === to ? `\`${from}\` se sonrojó tímidamente! (⸝⸝⸝-﹏-⸝⸝⸝)` : `\`${from}\` se siente demasiado tímido/a para mirar a \`${to}\`! (⸝⸝⸝-﹏-⸝⸝⸝)`,
  slap: (from, to) => from === to ? `\`${from}\` se dio una bofetada a sí mismo/a! ᕙ(⇀‸↼‵‵)ᕗ` : `\`${from}\` le dio una bofetada a \`${to}\`! ᕙ(⇀‸↼‵‵)ᕗ`,
  bath: (from, to) => from === to ? `\`${from}\` se está bañando! ٩(ˊᗜˋ )و` : `\`${from}\` está bañando a \`${to}\`! ٩(ˊᗜˋ )و`,
  angry: (from, to) => from === to ? `\`${from}\` está enojado/a! 凸ಠ益ಠ)凸` : `\`${from}\` está super enojado/a con \`${to}\`! 凸ಠ益ಠ)凸`,
  bored: (from, to) => from === to ? `\`${from}\` está aburrido/a! ( ¬_¬)` : `\`${from}\` está aburrido/a de \`${to}\`! ( ¬_¬)`,
  bite: (from, to) => from === to ? `\`${from}\` se mordió solito/a! ≽^•⩊•^≼` : `\`${from}\` mordió a \`${to}\`! ≽^•⩊•^≼`,
  bleh: (from, to) => from === to ? `\`${from}\` saca la lengua! (｡╹ω╹｡)` : `\`${from}\` le sacó la lengua a \`${to}\`! (｡╹ω╹｡)`,
  bonk: (from, to) => from === to ? `\`${from}\` se dio un bonk solo/a! 🔨` : `\`${from}\` le dio un bonk en la cabeza a \`${to}\`! 🔨`,
  blush: (from, to) => from === to ? `\`${from}\` se sonrojó! ( ˶o˶˶o˶)` : `\`${from}\` se sonrojó por \`${to}\`! ( ˶o˶˶o˶)`,
  impregnate: (from, to) => from === to ? `\`${from}\` se embarazó solito/a... misterioso! (¬ω¬)` : `\`${from}\` le regaló 9 meses de espera a \`${to}\`! (¬ω¬)`,
  bully: (from, to) => from === to ? `\`${from}\` se hace bullying solo/a… alguien abrácelo/a! ༼ ಠДಠ ༽` : `\`${from}\` le está haciendo bullying a \`${to}\`! ༼ ಠДಠ ༽`,
  cry: (from, to) => from === to ? `\`${from}\` está llorando! (╥_╥)` : `\`${from}\` está llorando por \`${to}\`! (╥_╥)`,
  happy: (from, to) => from === to ? `\`${from}\` está feliz! ٩(˶ˆᗜˆ˵)و` : `\`${from}\` está feliz por \`${to}\`! ٩(˶ˆᗜˆ˵)و`,
  coffee: (from, to) => from === to ? `\`${from}\` está tomando café! ٩(●ᴗ●)۶` : `\`${from}\` está tomando café con \`${to}\`! ٩(●ᴗ●)۶`,
  clap: (from, to) => from === to ? `\`${from}\` está aplaudiendo! (୨୧•͈ᴗ•͈)` : `\`${from}\` está aplaudiendo por \`${to}\`! (୨୧•͈ᴗ•͈)`,
  cringe: (from, to) => from === to ? `\`${from}\` siente cringe! (ᇂ_ᇂ|||)` : `\`${from}\` siente cringe por \`${to}\`! (ᇂ_ᇂ|||)`,
  dance: (from, to) => from === to ? `\`${from}\` está bailando! (ﾉ^ヮ^)ﾉ*:・ﾟ✧` : `\`${from}\` está bailando con \`${to}\`! (ﾉ^ヮ^)ﾉ*:・ﾟ✧`,
  cuddle: (from, to) => from === to ? `\`${from}\` se acurrucó solo/a! ꒰ঌ(˶ˆᗜˆ˵)໒꒱` : `\`${from}\` se acurrucó con \`${to}\`! ꒰ঌ(˶ˆᗜˆ˵)໒꒱`,
  drunk: (from, to) => from === to ? `\`${from}\` está borracho/a! (⸝⸝๑﹏๑⸝⸝)` : `\`${from}\` está borracho/a con \`${to}\`! (⸝⸝๑﹏๑⸝⸝)`,
  dramatic: (from, to) => from === to ? `\`${from}\` está haciendo un drama! (┬┬﹏┬┬)` : `\`${from}\` le está haciendo un drama a \`${to}\`! (┬┬﹏┬┬)`,
  handhold: (from, to) => from === to ? `\`${from}\` se dio la mano consigo mismo/a! (∩•̀ω•́)⊃` : `\`${from}\` le agarró la mano a \`${to}\`! (∩•̀ω•́)⊃`,
  eat: (from, to) => from === to ? `\`${from}\` está comiendo! (っ˘ڡ˘ς)` : `\`${from}\` está comiendo con \`${to}\`! (っ˘ڡ˘ς)`,
  highfive: (from, to) => from === to ? `\`${from}\` chocó los cinco en el espejo! (•̀o•́)ง` : `\`${from}\` chocó los 5 con \`${to}\`! (•̀o•́)ง٩(ˊᗜˋ)`,
  hug: (from, to) => from === to ? `\`${from}\` se abrazó a sí mismo/a! (づ˶•༝•˶)づ♡` : `\`${from}\` le dio un abrazo a \`${to}\`! (づ˶•༝•˶)づ♡`,
  kill: (from, to) => from === to ? `\`${from}\` se mató a sí mismo/a! ( ⚆ _ ⚆ )` : `\`${from}\` mató a \`${to}\`! ( ⚆ _ ⚆ )`,
  kiss: (from, to) => from === to ? `\`${from}\` se besó a sí mismo/a! ( ˘ ³˘)♥` : `\`${from}\` le dio un beso a \`${to}\`! ( ˘ ³˘)♥`,
  kisscheek: (from, to) => from === to ? `\`${from}\` se besó la mejilla en el espejo! (˶ ˘ ³˘)` : `\`${from}\` le dio un beso en la mejilla a \`${to}\`! (˶ ˘ ³˘)`,
  lick: (from, to) => from === to ? `\`${from}\` se lamió por curiosidad! （＾ω＾）` : `\`${from}\` lamió a \`${to}\`! （＾ω＾）`,
  laugh: (from, to) => from === to ? `\`${from}\` se está riendo! (≧▽≦)` : `\`${from}\` se está burlando de \`${to}\`! (≧▽≦)`,
  pat: (from, to) => from === to ? `\`${from}\` se da palmaditas de apoyo! ଘ(੭ˊᵕˋ)੭` : `\`${from}\` acaricia suavemente a \`${to}\`! ଘ(੭ˊᵕˋ)੭`,
  love: (from, to) => from === to ? `\`${from}\` se ama a sí mismo/a! (≧◡≦) ♡` : `\`${from}\` siente atracción por \`${to}\`! (≧◡≦) ♡`,
  pout: (from, to) => from === to ? `\`${from}\` hace pucheros! (๑•́ ₃ •̀๑)` : `\`${from}\` está haciendo pucheros por \`${to}\`! (๑•́ ₃ •̀๑)`,
  punch: (from, to) => from === to ? `\`${from}\` lanzó un golpe al aire! (ദി˙ᗜ˙)` : `\`${from}\` le dio un golpe a \`${to}\`! (ദി˙ᗜ˙)`,
  run: (from, to) => from === to ? `\`${from}\` está haciendo cardio! ┗(＾0＾)┓` : `\`${from}\` sale corriendo al ver a \`${to}\`! ┗(＾0＾)┓`,
  scared: (from, to) => from === to ? `\`${from}\` se asustó! (꒪ཀ꒪)` : `\`${from}\` está aterrorizado/a de \`${to}\`! (꒪ཀ꒪)`,
  sad: (from, to) => from === to ? `\`${from}\` está triste... (｡•́︿•̀｡)` : `\`${from}\` está triste por \`${to}\`... (｡•́︿•̀｡)`,
  smoke: (from, to) => from === to ? `\`${from}\` está fumando! (￣ー￣)_旦~` : `\`${from}\` está fumando con \`${to}\`! (￣ー￣)_旦~`,
  smile: (from, to) => from === to ? `\`${from}\` está sonriendo! ( ˶ˆᗜˆ˵ )` : `\`${from}\` le sonrió a \`${to}\`! ( ˶ˆᗜˆ˵ )`,
  spit: (from, to) => from === to ? `\`${from}\` se escupió solo/a por accidente! ٩(๑˘^˘๑)۶` : `\`${from}\` le escupió a \`${to}\`! ٩(๑˘^˘๑)۶`,
  smug: (from, to) => from === to ? `\`${from}\` está presumiendo! (๑•ᴗ•๑)ଓ` : `\`${from}\` le presume a \`${to}\`! (๑•ᴗ•๑)ଓ`,
  think: (from, to) => from === to ? `\`${from}\` está pensando! (⸝⸝╸-╺⸝⸝)` : `\`${from}\` está pensando en \`${to}\`! (⸝⸝╸-╺⸝⸝)`,
  step: (from, to) => from === to ? `\`${from}\` se pisó solito/a! ಥ_ಥ` : `\`${from}\` está pisando a \`${to}\`! ಥ_ಥ`,
  wave: (from, to) => from === to ? `\`${from}\` se saluda en el espejo! (๑˃̵ᴗ˂̵)و` : `\`${from}\` está saludando a \`${to}\`! (๑˃̵ᴗ˂̵)و`,
  walk: (from, to) => from === to ? `\`${from}\` salió a caminar! ┌( ಠ‿ಠ)┘` : `\`${from}\` está caminando con \`${to}\`! ┌( ಠ‿ಠ)┘`,
  wink: (from, to) => from === to ? `\`${from}\` se guiñó en el espejo! (⸝⸝> ᴗ•⸝⸝)` : `\`${from}\` le guiñó el ojo a \`${to}\`! (⸝⸝> ᴗ•⸝⸝)`
}

const commandAliases = {
  muak: 'kiss', beso: 'kisscheek', cafe: 'coffee', aburrido: 'bored',
  drama: 'dramatic', preg: 'impregnate', timido: 'shy', correr: 'run',
  triste: 'sad', amor: 'love', fumar: 'smoke', escupir: 'spit',
  pisar: 'step', comer: 'eat', nom: 'eat', feliz: 'happy', morder: 'bite'
}

const getVideo = async (category) => {
  try {
    const res = await fetch(`https://api.alyacore.xyz/sfw/interaction?inter=${category}&key=LUFFY-FIX67`)
    if (res.ok) {
      const json = await res.json()
      if (json.status && json.result) return json.result
    }
  } catch {}

  try {
    const res = await fetch(`https://nekos.best/api/v2/${category}`)
    if (res.ok) {
      const json = await res.json()
      if (json.results?.[0]?.url) return json.results[0].url
    }
  } catch {}

  return null
}

let handler = async (m, { conn, command, usedPrefix }) => {
  const currentCommand = commandAliases[command.toLowerCase()] || command.toLowerCase()
  if (!captions[currentCommand]) return

  const contextInfo = m.message?.extendedTextMessage?.contextInfo || m.msg?.contextInfo

  let senderJid = typeof m.sender === 'string' ? m.sender : String(await m.sender || '')
  let quotedSender = m.quoted ? (typeof m.quoted.sender === 'string' ? m.quoted.sender : String(await m.quoted.sender || '')) : null
  let mentionedJid = (m.mentionedJid && m.mentionedJid.length > 0) ? m.mentionedJid[0] : contextInfo?.mentionedJid?.[0]

  let who = quotedSender || mentionedJid || senderJid
  if (typeof who !== 'string' || !who.includes('@')) who = senderJid

  let getUsername = async (jid) => {
    try {
      if (!jid || typeof jid !== 'string') return 'usuario'
      const name = global.db?.data?.users?.[jid]?.name || await conn.getName(jid)
      return typeof name === 'string' && name.trim() ? name : jid.split('@')[0]
    } catch {
      return typeof jid === 'string' ? jid.split('@')[0] : 'usuario'
    }
  }

  let fromName = await getUsername(senderJid)
  let toName = await getUsername(who)

  const caption = captions[currentCommand](fromName, toName)

  try {
    const videoUrl = await getVideo(currentCommand)
    if (!videoUrl) return m.reply('ꕥ No se pudo obtener la animación en este momento.')

    const mentions = [senderJid, who].filter(j => typeof j === 'string' && j.includes('@'))

    await conn.sendMessage(m.chat, {
      video: { url: videoUrl },
      gifPlayback: true,
      caption,
      mentions
    }, { quoted: m })
  } catch (e) {
    console.error(e)
    const pref = Array.isArray(global.prefix) ? global.prefix[0] : (global.prefix || usedPrefix || '/')
    return m.reply(`⚠︎ Se ha producido un problema.\n> Usa *${pref}report* para informarlo.\n\n${e.message}`)
  }
}

handler.help = Object.keys(captions)
handler.tags = ['anime']
handler.command = /^(angry|bleh|bored|aburrido|beso|clap|coffee|cafe|dramatic|drama|drunk|impregnate|preg|kisscheek|laugh|love|amor|pout|punch|run|correr|sad|triste|scared|seduce|shy|timido|sleep|smoke|fumar|spit|escupir|step|pisar|think|walk|hug|kill|eat|nom|comer|kiss|muak|wink|pat|happy|bully|bite|morder|blush|wave|bath|smug|smile|highfive|handhold|cringe|bonk|cry|lick|slap|dance|cuddle|cold|sing|tickle|scream|push|nope|jump|heat|gaming|draw|call|feliz|snuggle|blowkiss|trip|stare|sniff|curious|thinkhard|comfort|peek)$/i
handler.group = true

export default handler