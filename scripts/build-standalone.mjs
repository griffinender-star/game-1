import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFile(path.join(root, name), 'utf8');
const [template, css, engine, stadium, app, icon] = await Promise.all(
  ['index.html', 'style.css', 'engine.js', 'stadium.js', 'app.js', 'icon-192.png'].map(name =>
    name.endsWith('.png') ? readFile(path.join(root, name)).then(b => b.toString('base64')) : read(name))
);
// Keep each module's private names in its own scope (both app and engine define clamp).
const wrapModule = (source, names) => `(() => {\n${source.replace(/^export /gm, '')}\nreturn {${names.join(',')}};\n})()`;
const localApp = app.replace(/^import .*;\n/gm, '').replace(/\nif\('serviceWorker' in navigator[\s\S]*$/, `\n$('offlineStatus').textContent = 'SINGLE-FILE EDITION · NO CONNECTION NEEDED';\n`)
  .replace('Use your browser’s Add to Home Screen option for an app-like view.', 'Keep this file on your device and open it in a browser that supports local HTML.')
  .replace('On iPhone: Share → Add to Home Screen. On Android: browser menu → Install app or Add to Home screen. Serve the game over HTTPS for offline play.', 'This edition needs no downloads or connection. Open it in a browser that supports local HTML. iPhone Files only previews HTML; to play on iPhone, open a hosted version in Safari.');
const script = `(() => {\n'use strict';\nconst {BaseballGame,teams,roster,pitchers}=${wrapModule(engine,['BaseballGame','teams','roster','pitchers'])};\nconst {Stadium,FIELD}=${wrapModule(stadium,['Stadium','FIELD'])};\ndocument.getElementById('fileNotice')?.remove();\n${localApp}\n})();`;
const html = template
  .replace(/\s*<link rel="manifest"[^>]*>/, '')
  .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" type="image/png" href="data:image/png;base64,${icon}">`)
  .replace(/<link rel="apple-touch-icon"[^>]*>/, `<link rel="apple-touch-icon" href="data:image/png;base64,${icon}">`)
  .replace('<link rel="stylesheet" href="style.css">', `<style>\n${css}\n.file-notice{padding:18px;background:#f5c66d;color:#11252d;font:15px/1.5 sans-serif}.file-notice b{display:block}\n</style>`)
  .replace('<body>', '<body>\n<div id="fileNotice" class="file-notice"><b>Open in a web browser to play.</b>This is an interactive game. File preview apps may disable games. On iPhone, Files only previews HTML; use a hosted version in Safari.</div>')
  .replace('Use your browser’s Add to Home Screen option for an app-like view.', 'Open this single file in a browser that supports local HTML.')
  .replace('Offline play becomes available after loading once from a web server.', 'All graphics and game code are included; no connection is needed.')
  .replace('<script type="module" src="app.js"></script>', `<script>\n${script.replace(/<\/script/gi,'<\\/script')}\n</script>`);
await writeFile(path.join(root, 'Pixel-Dugout.html'), html);
console.log(`Built Pixel-Dugout.html (${Buffer.byteLength(html).toLocaleString()} bytes).`);
