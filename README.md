# SongsApp

A private music player for one person. Your songs stay on your phone — they're stored in the browser's own storage (IndexedDB), never uploaded anywhere. No accounts, no ads, works offline.

Mascot: **Drift** the jellyfish. Look: midnight teal `#05121a`, aqua `#4fe3d0` (light theme `#eef4f3` / `#0c8f83`), Syne headings, Hanken Grotesk text. Auto light/dark, or pick one in the Looks tab.

## Features
- Add songs from your phone (MP3, M4A, WAV, FLAC, OGG…); title, artist, album and cover art are read from the file's tags
- Library, search, favourites, playlists, recently played, queue ("play next" / "add to queue")
- Shuffle, repeat (off / all / one), seek, lock-screen controls
- 8 original wallpapers (3 animated "live" ones) for the app backdrop, also used as cover art for songs that have none
- Installable as an app on your home screen (PWA), opens offline

## Run it
It's plain HTML/CSS/JS with no build step.

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

To use it on a phone it needs to be served over HTTPS (for example GitHub Pages, Cloudflare Pages or Netlify — all have free tiers). Open the address in the phone's browser, then "Add to Home Screen".

## Files
- `index.html`, `styles.css`, `app.js` — the app
- `sw.js`, `manifest.webmanifest` — offline + install support
- `icons/` — Drift (`mascot.svg`) and the app icon
- `wallpapers/` — the 8 wallpapers (SVG)
- `design/` — mockup screenshots

## Android app
`releases/SongsApp.apk` is a ready-to-install Android build (Android 5.1+). It shows lock-screen / notification controls and keeps playing with the screen off.

Rebuild it (needs JDK 17+ and the Android SDK):

```sh
npm install
npm run android:apk      # output: android/app/build/outputs/apk/debug/app-debug.apk
```
