<h1 align="center">🖤 Rory Mercury Bot</h1>

<p align="center"><i>Versión mejorada y personalizada de Shiroko-Bot con temática gótica de Rory Mercury</i></p>

<p align="center">
  <img src="./src/RoryMercury.jpg" width="100%"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20%2B-339933?style=for-the-badge&logo=node.js"/>
  <img src="https://img.shields.io/badge/Baileys-7%20MultiDevice-25D366?style=for-the-badge&logo=whatsapp"/>
  <img src="https://img.shields.io/badge/Comandos-148%2B-blueviolet?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/Termux%20%26%20Cloud%20Shell-OK-4285F4?style=for-the-badge"/>
</p>

---

## `❕ Información 🖤`

**Rory-Mercury-Bot** es un bot de WhatsApp basado en **Node.js** con la librería **@whiskeysockets/Baileys 7**. **149 comandos** (con **572 alias** en total) organizados en 11 categorías con temática gótica, lista para correr en **Termux (Android)**, **Cloud Shell** o cualquier **VPS Linux**.

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
- 🛡️ **Capa antiban integrada** — rate-limiter por usuario, typing humano con pausas naturales, watchdog de reconexión con backoff, circuit breaker de plugins y avisos al owner. 0 dependencias nuevas.
- 🔒 **Repo liviano y limpio** — ~2 MB (sin `node_modules`): clona y ejecuta, npm lo instala todo. Sin datos sensibles en el historial.
- 🧪 **158 plugins auditados** — más de 1400 ejecuciones de simulación; bugs de inyección, path traversal y crashes corregidos.
- 🎴 **16 personajes de gacha** con arte verificado de AniList.
- 🤖 **Robot de CI** — en cada push un workflow revisa la sintaxis de todos los `.js` (no ejecuta nada del bot).

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
│  ✦ Facebook, Pinterest
│  ✦ MediaFire, MEGA, ModAPK
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
│  ✦ Publicar tu grupo en gruposwats.com
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

## 🛡️ Protección antiban (integrada)

El bot trae una capa que trabaja sola para **parecer más humano y evitar el baneo**:

| Protección | Qué hace |
|---|---|
| **Rate limiter** | Cooldown por usuario (2.5s) y tope de 8 comandos/min; reacciona con ⏳ si vas muy rápido. Owners y premium sin límite |
| **Typing humano** | Antes de responder muestra "escribiendo..." con duración proporcional al texto y pausas naturales |
| **Envíos espaciados** | Todo mensaje sale con un retardo aleatorio (350–900ms), sin ráfagas de bot |
| **Watchdog de conexión** | Si la sesión entra en bucle de reconexión, espacia los reintentos (backoff); ante cierres fatales (401/403/405/440) pausa 10 minutos y avisa al owner con la causa |
| **Vigilante de sobrecarga** | Si la RAM o el lag se disparan, entra en modo preservación 5 minutos y avisa al owner (máx 1 aviso/hora) |
| **Circuit breaker** | Un plugin que falle 5 veces en un minuto entra en cuarentena 2 minutos en vez de tirar spam de errores |

Todo es local (`lib/antiban.js`), sin dependencias nuevas, y se puede desactivar con `global.antibanCfg.enabled = false` en `src/config.js`.

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

---

## 📌 Notas importantes

- El bot responde en **privados y grupos**; los comandos de administración solo funcionan en grupos y requieren ser admin
- El owner puede operar desde privado con: `restart`, `update`, `join`, `reload`
- Si el bot reacciona con ⏳ a un comando es el **rate-limiter antiban** trabajando — espera unos segundos; owners y premium no tienen límite
- Cloud Shell cierra sesión por inactividad — la sesión queda guardada en `Sessions/`
- `ffmpeg` puede perderse entre sesiones — el bot lo reinstala automáticamente al arrancar
- La base de datos es compartida entre todas las sesiones (`src/database/database.json`)
- El NSFW está **desactivado por defecto** — actívalo por grupo con `/nsfw enable` (admins) y desactívalo con `/nsfw disable`
- El sistema de economía y gacha son **independientes por grupo**
- En Termux, los errores `Bad MAC` al inicio son normales si vienes de una sesión de Cloud Shell — desaparecen solos conforme los contactos interactúan con el bot

---

> 🖤 *Base original por Arlette Xz — Modificado y mantenido por Pérez / Chuy*
