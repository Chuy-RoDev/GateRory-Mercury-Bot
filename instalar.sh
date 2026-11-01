#!/bin/bash
# ============================================================
#  instalar.sh — Rory Mercury Bot
#  Prepara el entorno una sola vez (Termux, Cloud Shell o VPS).
#  NO toca start.sh ni nada del arranque; solo instala dependencias.
#  Uso:  bash instalar.sh
# ============================================================

verde='\033[0;32m'; amarillo='\033[1;33m'; rojo='\033[0;31m'; nc='\033[0m'
ok()   { echo -e "${verde}✓ $1${nc}"; }
aviso(){ echo -e "${amarillo}⚠ $1${nc}"; }
fallo(){ echo -e "${rojo}✗ $1${nc}"; }

# ── 1. Detectar entorno ────────────────────────────────────
ES_TERMUX=0
if [ -n "$PREFIX" ] && echo "$PREFIX" | grep -q "com.termux"; then
  ES_TERMUX=1
  ok "Entorno detectado: Termux (Android)"
else
  ok "Entorno detectado: Linux (Cloud Shell / VPS)"
fi

# ── 2. Node.js ≥ 20 ────────────────────────────────────────
if command -v node > /dev/null 2>&1; then
  MAYOR=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$MAYOR" -ge 20 ]; then
    ok "Node.js $(node -v)"
  else
    aviso "Node $(node -v) es viejo; el bot pide 20 o más."
    if [ "$ES_TERMUX" = "1" ]; then
      echo "  → En Termux: pkg upgrade nodejs"
    else
      echo "  → Instala Node 20 LTS desde nodejs.org o con tu gestor."
    fi
  fi
else
  fallo "Node.js no está instalado."
  [ "$ES_TERMUX" = "1" ] && echo "  → En Termux: pkg install nodejs-lts" || echo "  → Instala Node 20 LTS (https://nodejs.org)"
  exit 1
fi

# ── 3. ffmpeg (stickers, audios, videos) ───────────────────
if command -v ffmpeg > /dev/null 2>&1; then
  ok "ffmpeg detectado"
else
  aviso "ffmpeg no encontrado; intentando instalar..."
  if [ "$ES_TERMUX" = "1" ]; then
    pkg install -y ffmpeg && ok "ffmpeg instalado (pkg)" || fallo "Instálalo a mano: pkg install ffmpeg"
  else
    if command -v apt-get > /dev/null 2>&1; then
      sudo apt-get update -y && sudo apt-get install -y ffmpeg && ok "ffmpeg instalado (apt)" || fallo "Instálalo a mano: sudo apt install ffmpeg"
    elif command -v apk > /dev/null 2>&1; then
      apk add --no-cache ffmpeg && ok "ffmpeg instalado (apk)" || fallo "Instálalo a mano: apk add ffmpeg"
    elif command -v dnf > /dev/null 2>&1; then
      dnf install -y ffmpeg && ok "ffmpeg instalado (dnf)" || fallo "Instálalo a mano: dnf install ffmpeg"
    else
      fallo "No encontré gestor de paquetes; instala ffmpeg a mano."
    fi
  fi
fi

# ── 4. Dependencias del bot ────────────────────────────────
echo ""
echo "→ Instalando dependencias con npm (esto tarda unos minutos)..."
if npm install --no-audit --no-fund; then
  ok "Dependencias instaladas"
else
  fallo "npm install falló. Revisa el mensaje de arriba."
  exit 1
fi

# ── 5. Resumen ─────────────────────────────────────────────
echo ""
echo -e "${verde}══════════════════════════════════════${nc}"
ok "Todo listo. Arranca el bot con:  ./start.sh"
echo -e "${verde}══════════════════════════════════════${nc}"
