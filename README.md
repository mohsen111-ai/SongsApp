# SongsApp

A private music player for one person. Your songs stay on your phone — they're stored in the browser's own storage (IndexedDB), never uploaded anywhere. No accounts, no ads, works offline.

Mascot: **Needle** the hedgehog. Palette: midnight `#14101f`, amber `#ffb347`, coral `#ff6b8b`, violet `#8f7ae0`.

## Features
- Add songs from your phone (MP3, M4A, WAV, FLAC, OGG…); title, artist, album and cover art are read from the file's tags
- Library, search, favourites, playlists, recently played, queue ("play next" / "add to queue")
- Shuffle, repeat (off / all / one), seek, lock-screen controls
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
- `icons/` — Needle (`mascot.svg`) and the app icon
- `design/` — mockup screenshots
