# extras/ — scripts de mantenimiento (NO son parte del bot)

Nada de aquí se importa ni se ejecuta al arrancar el bot. Son utilidades de una
sola vez que vivían en la raíz y se movieron aquí para dejarla limpia.

## Qué hay

| Archivo | Qué hace | Cómo se usa |
|---|---|---|
| `dedup.js` | Detecta y elimina personajes duplicados en `src/json/characters.json` | `node extras/dedup.js` (desde la raíz del repo) |
| `populate.js` | Poblado/descarga masiva de datos del gacha (danbooru → characters.json + caché) | `node extras/populate.js` (desde la raíz del repo) |
| `fix.js` | Parche de una vez sobre `src/commands/*.js` | `node extras/fix.js` |
| `fix-getname-local.js` | Parche de una vez (getName local) sobre `src/commands/*.js` | `node extras/fix-getname-local.js` |
| `README.md.bak` | Respaldo del README original | solo referencia |
| `salida.log` | Log de una ejecución antigua | solo referencia |

## Notas

- `dedup.js` y `populate.js` usan rutas relativas al directorio de ejecución
  (`./src/json/...`): hay que lanzarlos **desde la raíz del repo**.
- `fix.js` y `fix-getname-local.js` resuelven `src/commands` respecto a su propia
  ubicación: se pueden lanzar desde cualquier lado.
- Los `*.log` nuevos ya no se rastrean en git (ver `.gitignore`); si aparece otro
  log en la raíz, bórralo o muévelo aquí sin hacer commit.
