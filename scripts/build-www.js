// Copies the web app into www/ (what the Android app ships) and bundles the native media-session bridge.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const www = path.join(root, 'www');
fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });
for (const f of ['index.html', 'styles.css', 'app.js', 'moods.js']) fs.copyFileSync(path.join(root, f), path.join(www, f));
for (const d of ['icons', 'wallpapers']) fs.cpSync(path.join(root, d), path.join(www, d), { recursive: true });
// native bridge for the lock-screen controls + background playback (the Android WebView has no Media Session API)
require('esbuild').buildSync({
  stdin: { contents: "import { MediaSession } from '@jofr/capacitor-media-session'; window.NativeMediaSession = MediaSession;", resolveDir: root, loader: 'js' },
  bundle: true, minify: true, format: 'iife', outfile: path.join(www, 'native.js'), logLevel: 'error'
});
let html = fs.readFileSync(path.join(www, 'index.html'), 'utf8');
if (!html.includes('native.js')) html = html.replace('<script src="moods.js"></script>', '<script src="native.js"></script>\n<script src="moods.js"></script>');
fs.writeFileSync(path.join(www, 'index.html'), html);
console.log('www ready');
