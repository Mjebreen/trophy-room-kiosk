# Trophy Room Kiosk

Offline LAN kiosk for an esports trophy room: a bilingual (AR/EN) trophy gallery
on a big screen, with physical WLED shelf lighting synced to whatever is on screen.

## Quick start on a new machine (laptop)

1. Download the repo: `git clone https://github.com/Mjebreen/trophy-room-kiosk.git`
   (or GitHub → *Code* → *Download ZIP* and extract it).
2. Double-click **`start.bat`**.

That's it. If Node.js is missing, `start.bat` installs it automatically
(via winget, or by downloading a portable copy into `runtime/` — no admin
rights needed). It then starts the server and opens the browser.
Internet is only needed for that one-time Node download; after that the
kiosk runs **fully offline**.

## Run manually

Requires only [Node.js](https://nodejs.org) — **zero npm packages, zero internet**.

```
node server.js          # or double-click start.bat  (port 8484)
node server.js 9090     # custom port
```

The console prints the LAN address, e.g. `http://192.168.1.50:8080`.
Open that on the TV, phones, and PCs. Everything (fonts, icons, images, code)
is served from the host — nothing loads from the internet.

- **Default admin PIN: `1234`** (change it in Admin → System)
- Admin panel: the small ⚙ button in the top corner (works from any device).

## How it behaves

| Screen state            | Shelf lights                                                        |
|-------------------------|---------------------------------------------------------------------|
| Gallery, nothing chosen | All 4 strips fully ON in the global idle color                      |
| Trophy detail open      | Only that trophy's LED range in its color — everything else OFF     |
| Back to gallery         | All lights back ON (touch anywhere, or automatic after 30 seconds)  |

Lighting commands go **directly from the browser to the WLED controllers**
over the LAN using WLED's JSON API (`POST http://<controller-ip>/json/state`).
A dead controller never blocks the UI (1.8 s timeout, fire-and-forget).

## Data

Everything lives on the host in two files:

- `base-config.json` — the shipped base: built-in trophies + default settings.
- `data/db.json` — the single live database: edits, deletions, added trophies,
  WLED mappings, global settings, admin PIN (hashed). Any change made from any
  device is pushed instantly to all other devices (Server-Sent Events).

**Export**: Admin → System → *Download base-config.json* gives you the merged
config as code; *Bake changes into base* writes it into `base-config.json`
directly (a `.bak` backup is kept) and clears the delta.

## Low-end / smart-TV notes

- Background animation renders internally at ≤1280×720 (≤960×540 reduced) and
  is CSS-scaled to the 4K panel; frame rate capped at 24 fps (20 reduced).
- Reduced-effects mode (no blur, fewer particles, no shadows/glow) turns on
  automatically on TV browsers and low-memory devices; you can force it
  on/off in Admin → System → Performance.
- Animation fully pauses when the tab is hidden or after 2 minutes idle.
- The loading screen force-hides after 4 seconds no matter what.

## WLED setup per trophy

In Admin → Trophies → Edit: pick the device (1–4), first/last LED index and a
color, then press **Test this range** to see it live on the shelf. Controller
IPs and per-strip LED counts are in Admin → Lighting & Devices.
