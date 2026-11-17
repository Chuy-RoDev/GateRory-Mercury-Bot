<h1 align="center">🖤 Rory Mercury Bot</h1>

<p align="center"><i>Versión mejorada y personalizada de Shiroko-Bot con temática gótica de Rory Mercury</i></p>

<p align="center">
  <img src="./src/RoryMercury.jpg" width="100%"/>
</p>

<p align="center">
  <img src="./src/assets/rory-gif-1.gif" width="100%"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20%2B-339933?style=for-the-badge&logo=node.js"/>
  <img src="https://img.shields.io/badge/Baileys-7%20MultiDevice-25D366?style=for-the-badge&logo=whatsapp"/>
  <img src="https://img.shields.io/badge/Comandos-149%2B-blueviolet?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/Termux%20%26%20Cloud%20Shell-OK-4285F4?style=for-the-badge"/>
</p>

---

## `❕ Información 🖤`

**Rory-Mercury-Bot** es un bot de WhatsApp basado en **Node.js** con la librería **@whiskeysockets/Baileys 7**. **149 comandos** (con **573 alias** en total) organizados en 11 categorías con temática gótica, listo para correr en **Termux (Android)**, **Cloud Shell** o cualquier **VPS Linux**.

🚫 Este proyecto **NO** está afiliado a WhatsApp ni WhatsApp LLC.

---

## 🛡️ Créditos

| Rol | Encargado | Enlace |
|---|---|---|
| **Creadora Original** | Arlette Xz | [Shiroko-Bot](https://github.com/Arlette-Xz/Shiroko-Bot/) |
| **Modding & Edición** | Pérez / Chuy | [Chuy-RoDev](https://github.com/Chuy-RoDev) |

---

## ✨ Novedades de esta versión

- ⚡ **Instalación en un solo comando** — `bash instalar.sh` detecta tu entorno (Termux/Cloud Shell/VPS), verifica Node 20, instala ffmpeg y las dependencias solito.
- 🚀 **Descargas re-reparadas** — las APIs de descargas se mueren seguido, así que cada comando (YouTube, TikTok, Instagram, Facebook, ChatGPT, MediaFire, Spotify, Pinterest, subidas y gifs) se probó en vivo contra 4 bots conocidos y quedó con cadena de respaldo: si una API se cae, la siguiente entra sola.
- 🛡️ **Capa antiban integrada** — rate-limiter por usuario, typing humano con pausas naturales, watchdog de reconexión con backoff, circuit breaker de plugins y avisos al owner. 0 dependencias nuevas.
- 🧪 **158 plugins auditados** — más de 1400 ejecuciones de simulación; bugs de inyección, path traversal y crashes corregidos.
- 🔒 **Repo liviano y limpio** — unos 27 MB con todo y los gifs HD de Rory, sin `node_modules`: clonas, `npm install` y listo. Sin datos sensibles en el historial.
- 🎴 **16 personajes de gacha** con arte verificado de AniList.
- 🤖 **Robot de CI** — en cada push un workflow revisa la sintaxis de todos los `.js` (no ejecuta nada del bot).

<p align="center">
  <img src="./src/assets/rory-gif-4.gif" width="100%"/>
</p>

<details>
<summary><b>🖤 FUNCIONES</b></summary>

```
╭─────────────────────────────────────────
│  🖤  RORY MERCURY BOT — MÓDULOS
├─────────────────────────────────────────
│
│  🗂️  INFO & UTILIDADES
│  ✦ Menú, ping, estado del sistema, créditos
│  ✦ ChatGPT / IA integrada
│  ✦ Stickers (imagen / video / gif / URL)
│  ✦ Traductor, calculadora, letra de canciones
│  ✦ FakeWapp, fetch, speedtest, ssweb
│  ✦ Subir archivos a URL (catbox)
│  ✦ Ver imágenes viewonce, clonar repos
│  ✦ Info de IPs, números y usuarios LID
│
│  🎮  DIVERSIÓN
│  ✦ Medidores: gay · emo · hetero · puta
│  ✦ Compatibilidad / ship entre usuarios
│  ✦ 8ball, impostor, top10 aleatorio
│  ✦ AFK / modo ausente, adivinanzas
│  ✦ Imágenes para parejas/amigos (ppccpp)
│
│  🎌  ANIME
│  ✦ +80 reacciones animadas en mp4
│     hug · kiss · slap · cry · dance · bite...
│  ✦ Info de animes y waifus aleatorias
│
│  🔞  NSFW  ── requiere /nsfw enable (admins)
│  ✦ Rule34 con tags (imagen y video)
│  ✦ +18 reacciones con videos
│  ✦ Descarga de Xvideos
│
│  📥  DESCARGAS
│  ✦ YouTube (audio, video y búsqueda)
│  ✦ Spotify, Apple Music
│  ✦ TikTok, Instagram, Facebook, Twitter/X
│  ✦ Pinterest, MediaFire, MEGA, ModAPK
│  ✦ Búsqueda y descarga de imágenes
│
│  🎴  GACHA
│  ✦ Roll, claim y harem de personajes
│  ✦ Tienda, venta e intercambio de waifus
│  ✦ Proteger, regalar y robar personajes
│  ✦ Votar y ver top global de personajes
│  ✦ Favoritos, listas de serie y info
│
│  💰  ECONOMÍA RPG  (Soul-Coins 🖤)
│  ✦ Balance, banco, depósito y retiro
│  ✦ Casino, ruleta, coinflip, slots
│  ✦ Trabajar, crimen, minería, pesca, caza
│  ✦ Aventuras, mazmorras, cofres, curar salud
│  ✦ Robar monedas, dar monedas
│  ✦ Recompensas diaria, semanal y mensual
│  ✦ Ranking económico del grupo
│
│  👤  PERFIL
│  ✦ Ver y editar perfil personal
│  ✦ Niveles, experiencia y leaderboard
│  ✦ Top 10 del grupo
│  ✦ Matrimonio y adopción
│  ✦ Foto de perfil, descripción, género
│  ✦ Fecha de cumpleaños, waifu favorita
│
│  👥  GRUPOS  ── solo administradores
│  ✦ Hidetag / tagall — mención masiva
│  ✦ Usuarios activos del grupo
│  ✦ Kick, add, mute, warn, ban
│  ✦ Promote, demote, kicknum por país
│  ✦ Antilink, modo admin, antiraid
│  ✦ Abrir / cerrar grupo
│  ✦ Bienvenida y despedida personalizadas
│  ✦ Info del grupo, cambiar nombre/foto/desc
│  ✦ Prefijo propio por grupo
│  ✦ Restablecer enlace de invitación
│  ✦ Publicar tu grupo en gruposwats.com (asistente guiado)
│
│  🤖  BOTS & SOCKETS
│  ✦ Sub-bots con QR o código
│  ✦ Lista de bots, info de sockets
│  ✦ Cambiar banner, nombre, foto del bot
│  ✦ Cambiar moneda, bot primario y prefijo
│  ✦ Join/salir a grupos, self/public, reload
│  ✦ Reset total de configuración por grupo
│
│  🔧  OWNER  ── solo creador
│  ✦ Ban/unban, exec, restart, update
│  ✦ Backup, savefiles, onlycc, tourl
│  ✦ Dar waifus, editar personajes del sistema
│  ✦ Autoadmin, gestión de grupos
│
╰─────────────────────────────────────────
```

</details>

---

## ✦ Comandos destacados

### 🔞 `/r34` — Rule34 con flujo completo

| Cómo lo llamas | Qué hace |
|---|---|
| `/r34 (tag)` | **Directo en mixto**: hasta 25 imágenes + 25 vídeos en un álbum |
| `/r34 (tag) video 50` | **Directo solo vídeos** (máx. 50, sin número usa 25) |
| `/r34 (tag) mix 10` | Mixto con cantidad personalizada (máx. 25 de cada) |
| `/r34vid (tag)` · `/rulevid (tag)` | Igual que `video` directo |
| `/r34 (tag) imagen` o `/r34 (tag) menu` | **Pasos con menú** (única forma de pedir solo imágenes) |

Los **pasos** son: te muestra cuántos posts tiene el tag → *"Este tag ya existe, ¿es correcto?"* (respondes **Si/No**) → menú de formato (`videos`, `imagenes`, `mixto`, o cantidad como `videos 20`) — si respondes **No**, te lista tags parecidos numerados y eliges por número. Si el tag no existe, la lista de parecidos sale de una vez. Topes: vídeos 50, imágenes 50, mixto 25 de cada. `cancelar` aborta la sesión (dura 5 min). El `/r34` tiene cooldown de **45 s por chat** (owners/premium libres) para proteger la sesión de WhatsApp.

### 🎨 Otras mejoras recientes

- **`/personalidad rory|generico`** — cambia la voz del bot (mensajes de errores, menús) entre Rory Mercury y bot genérico.
- **`/s` · `/sticker` · `/stiker`** unificados: acepta imagen, vídeo (≤15 s), sticker (re-marca sin re-encodar) y **URLs**; marca personalizada con `pack • autor`; si ffmpeg falla, usa servidores web de respaldo.
- **`/update` · `/fix` · `/actualizar` · `/up`** unificados: `git stash` + `pull` + reinicio automático de pm2, con reporte de archivos cambiados y detección de conflictos locales.
- **Anti-spam por comando**: comandos pesados tienen cooldown por chat configurable en `lib/cooldown.js`.
- **Errores visibles**: si un plugin falla, verás `[PLUGIN-ERROR] hora · archivo · mensaje` en consola, se guarda en `tmp/plugin-errors.log` y se avisa al owner por WhatsApp.

---

## 🛡️ Protección antiban (integrada)

El bot trae una capa que trabaja sola para **parecer más humano y evitar el baneo**:

| Protección | Qué hace |
|---|---|
| **Visto automático** | Marca ✓✓ leídos únicamente los comandos que le escriben en privado y que va a atender (nunca mensajes normales ni grupos), con una pausa humana (0.3–1.2s) |
| **Rate limiter** | Cooldown bajo (0.4s) siempre, respuesta rápida, si un usuario satura (5+ comandos/min) el cooldown vuelve a 2.5s, y al pasar el tope de 8/min castiga con 10s. Owners y premium sin límite |
| **Typing humano** | Antes de responder muestra "escribiendo..." con duración proporcional al texto y pausas naturales |
| **Envíos espaciados** | Normal: ~100ms entre envíos, cuando hay saturación vuelve al peak 350–900ms, y si hay sobrecarga de RAM se duplican |
| **Watchdog de conexión** | Si la sesión entra en bucle de reconexión, espacia los reintentos (backoff), ante cierres fatales (401/403/405/440) pausa 10 minutos y avisa al owner con la causa |
| **Vigilante de sobrecarga** | Si la RAM o el lag se disparan, entra en modo preservación 5 minutos y avisa al owner (máx 1 aviso/hora) |
| **Circuit breaker** | Un plugin que falle 5 veces en un minuto entra en cuarentena 2 minutos en vez de tirar spam de errores |

Todo es local (`lib/antiban.js`), sin dependencias nuevas, y se puede desactivar con `global.antibanCfg.enabled = false` en `src/config.js`.

<p align="center">
  <img src="./src/assets/rory-gif-2.gif" width="100%"/>
</p>

---

## 📥 Instalación

### ⚡ Rápida — un solo comando (Termux, Cloud Shell o VPS)

```bash
git clone https://github.com/Chuy-RoDev/GateRory-Mercury-Bot && cd GateRory-Mercury-Bot
bash instalar.sh
```

El script detecta tu entorno, verifica Node 20+, instala ffmpeg si falta y ejecuta `npm install`. Cuando termine, arranca:

```bash
bash start.sh
```

<p align="center">
  <a href="https://f-droid.org/es/packages/com.termux/"><img src="https://img.shields.io/badge/DESCARGAR-Termux-black?style=for-the-badge&logo=android"/></a>
  <a href="https://shell.cloud.google.com/"><img src="https://img.shields.io/badge/ABRIR-Cloud%20Shell-4285F4?style=for-the-badge&logo=google-cloud"/></a>
</p>

<details>
<summary><b>✰ Instalación Manual (Termux)</b></summary>

### Paso 1 — Permisos y dependencias

```bash
termux-setup-storage
```

```bash
apt update && apt upgrade -y && pkg install -y git nodejs ffmpeg imagemagick yarn build-essential python
```

### Paso 2 — Clonar el repositorio

```bash
git clone https://github.com/Chuy-RoDev/GateRory-Mercury-Bot && cd GateRory-Mercury-Bot
```

### Paso 3 — Aprobar scripts de instalación nativos

```bash
npm approve-scripts @whiskeysockets/baileys && npm approve-scripts sharp && npm approve-scripts protobufjs
```

> Necesita **npm 11 o superior**. En versiones anteriores los scripts se ejecutan solos y este paso se puede saltar.

### Paso 4 — Instalar dependencias

```bash
npm install
```

### Paso 5 — Iniciar el bot

```bash
npm start
```

> Si aparece `(Y/I/N/O/D/Z) [default=N]` usa `"y"` y luego `ENTER`.

---

### ⏱️ Mantener activo con PM2

```bash
termux-wake-lock && npm i -g pm2 && pm2 start index.js -- --session TuNombre && pm2 save && pm2 logs
```

> Reemplaza `TuNombre` por el nombre de tu sesión. Ejemplo: `Principal`, `Rory`, `Chuy`.

---

### ♻️ Si el bot se detiene y quieres reiniciarlo

```bash
cd GateRory-Mercury-Bot && npm start
```

### 🔑 Si necesitas un nuevo código QR o de vinculación

```bash
cd GateRory-Mercury-Bot && rm -rf Sessions/Principal && npm start
```

</details>

<details>
<summary><b>✰ Instalación en Google Cloud Shell</b></summary>

```bash
git clone https://github.com/Chuy-RoDev/GateRory-Mercury-Bot && cd GateRory-Mercury-Bot
```

```bash
npm install
```

```bash
node index.js -- --session TuNombre
```

> Reemplaza `TuNombre` por el nombre de tu sesión. Ejemplo: `Tonaituh`, `Miku`, `Rory`.

### ⏱️ Mantener activo con PM2

```bash
npm i -g pm2 && pm2 start index.js -- --session TuNombre && pm2 save && pm2 logs
```

> Cloud Shell cierra sesión por inactividad. Con PM2 se mantiene mientras la pestaña esté abierta.

</details>

<p align="center">
  <img src="./src/assets/rory-gif-5.gif" width="100%"/>
</p>

---

## ⚙️ Configuración

Edita `src/config.js`:

| Variable | Descripción | Ejemplo |
|---|---|---|
| `global.owner` | Tu número con código de país | `["58XXXXXXXXXX"]` |
| `global.botname` | Nombre del bot | `"Rory Mercury"` |
| `global.prefix` | Prefijos de comandos | `[":", "💙", "/"]` |
| `global.currency` | Moneda del sistema RPG | `"Soul-Coins 🖤"` |
| `global.modes.nsfw` | NSFW activado por defecto | `false` |
| `global.modes.gacha` | Gacha activado por defecto | `true` |
| `global.modes.economy` | Economía activada por defecto | `true` |
| `global.modes.welcome` | Bienvenida activada por defecto | `false` |
| `global.modes.antilink` | Antilink activado por defecto | `false` |

> El bot acepta **tres prefijos**: `:`, `💙` y `/` — ejemplos: `:menu`, `💙menu`, `/menu`.

> 🗂️ Los scripts de mantenimiento que no son parte del bot (`dedup.js`, `populate.js`, parches antiguos) viven en **`extras/`** — ver `extras/README.md`.

---

## 📌 Notas importantes

- El bot responde en **privados y grupos**, los comandos de administración solo funcionan en grupos y requieren ser admin
- El owner puede operar desde privado con: `restart`, `update`, `join`, `reload`
- Si el bot reacciona con ⏳ a un comando es el **rate-limiter antiban** trabajando — espera unos segundos, owners y premium no tienen límite
- Cloud Shell cierra sesión por inactividad — la sesión queda guardada en `Sessions/`
- `ffmpeg` puede perderse entre sesiones — el bot lo reinstala automáticamente al arrancar
- La base de datos es compartida entre todas las sesiones (`src/database/database.json`)
- El NSFW está **desactivado por defecto** — actívalo por grupo con `/nsfw enable` (admins) y desactívalo con `/nsfw disable`
- El sistema de economía y gacha son **independientes por grupo**
- En Termux, los errores `Bad MAC` al inicio son normales si vienes de una sesión de Cloud Shell — desaparecen solos conforme los contactos interactúan con el bot

<p align="center">
  <img src="./src/assets/rory-gif-3.gif" width="100%"/>
</p>

---

> 🖤 *Base original por Arlette Xz — Modificado y mantenido por Pérez / Chuy*
