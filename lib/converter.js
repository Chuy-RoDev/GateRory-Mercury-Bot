import {promises, mkdirSync} from 'fs';
import {join, dirname} from 'path';
import {spawn} from 'child_process';
import { fileURLToPath } from 'url';

// FIX: antes se escribía en <repo>/lib/tmp, un directorio que nadie crea,
// así que toAudio/toPTT/toVideo fallaban SIEMPRE con ENOENT.
// Ahora usamos <repo>/tmp (el que crea main.js) y lo creamos si falta.
const TMP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'tmp');

function ffmpeg(buffer, args = [], ext = '', ext2 = '') {
  return new Promise(async (resolve, reject) => {
    try {
      mkdirSync(TMP_DIR, { recursive: true });
      const tmp = join(TMP_DIR, + new Date + '.' + ext);
      const out = tmp + '.' + ext2;
      await promises.writeFile(tmp, buffer);
      spawn('ffmpeg', [
        '-y',
        '-i', tmp,
        ...args,
        out,
      ])
          .on('error', reject)
          .on('close', async (code) => {
            try {
              await promises.unlink(tmp);
              if (code !== 0) return reject(code);
              resolve({
                data: await promises.readFile(out),
                filename: out,
                delete() {
                  return promises.unlink(out);
                },
              });
            } catch (e) {
              reject(e);
            }
          });
    } catch (e) {
      reject(e);
    }
  });
}

function toPTT(buffer, ext) {
  return ffmpeg(buffer, [
    '-vn',
    '-c:a', 'libopus',
    '-b:a', '128k',
    '-vbr', 'on',
  ], ext, 'ogg');
}

function toAudio(buffer, ext) {
  return ffmpeg(buffer, [
    '-vn',
    '-c:a', 'libopus',
    '-b:a', '128k',
    '-vbr', 'on',
    '-compression_level', '10',
  ], ext, 'opus');
}

function toVideo(buffer, ext) {
  return ffmpeg(buffer, [
    '-c:v', 'libx264',
    '-c:a', 'aac',
    '-ab', '128k',
    '-ar', '44100',
    '-crf', '32',
    '-preset', 'slow',
  ], ext, 'mp4');
}

export {
  toAudio,
  toPTT,
  toVideo,
  ffmpeg,
};