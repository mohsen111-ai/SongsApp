# SongsApp

A private music player for one person. Your songs stay on your phone — they're stored in the browser's own storage (IndexedDB), never uploaded anywhere. No accounts, no ads, works offline.

Mascot: **Drift** the jellyfish. Look: midnight navy `#090b14`, lavender `#b4a3ff` (light theme `#f3f1ee` / `#6b55c9`), Syne headings, Hanken Grotesk text. Auto light/dark, or pick one in the Looks tab.

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
