# nightmare / the whole site as plates

Every page is one composed scene, re-printed by the same engraving shader.
All of a page's content is in view at once: nothing to walk through or scroll
around. On desktop the camera eases slowly after your mouse.

Double-click any .html file to open it. No server or install needed.

## the pages

- **index**: four gates in an arc under the sun with the eye in it. Click a gate
  (or a header link) and you walk through it before the next page loads.
- **about**: an altarpiece. The portrait is pressed into stone as a relief,
  haloed and candlelit. The ledger is on two standing stones, and the altar
  under the face has the teeth in it. Click the mouth (or "telepathize") to go
  to contact.
- **videos**: the end wall of a cathedral hung with all 23 videos as woven
  tapestries. Gusts of wind lift them. Hover one for its title, click it to
  play. "index of frames" is a plain list too. The wall rearranges itself to
  fit the window.
- **writing**: the original generator, untouched, on a panel. The words you're
  given rise out of a field as carved tablets and catch fire when you use them.
  All of them burning turns the sky.
- **entries**: same field, with a tablet for each submitter's name. The one
  you're reading burns. Clicking a tablet opens that entry.
- **contact**: telegraph wire strung across a night plain, every line running
  to one mast, with the email grave at its foot. "SEND A TRANSMISSION" (or the
  grave) sends the signals racing up the mast and into the sky, then opens your
  mail client.

Shared across all pages: pages fade in out of blank paper and burn back to it
when you leave; random omens (negative flashes, site copy surfacing mid-air,
plus one per page); the "hum" drone, which now remembers being on as you move
between pages.

## files

- `three.js`: three.js r170 as a plain script, so file:// works
- `assets.js`: the spritesheets and portrait, inlined (also for file://)
- `plate.js` + `plate.css`: the shared engine and styles
- `scene-*.js`: one per page
- `writing-generator.js`, `entries.js`, `submission-config.js`,
  `data/words-data.js`: copied unchanged from the repo. The scenes only watch
  the page they build, so the Google Sheets submission keeps working.

## dropping it into the repo

Copy everything here into the repo root. That replaces index, about, videos,
writing, entries and contact; the four copied scripts are identical to what's
already there. The old pre2010.css and gifs can stay; nothing here uses them.

Note: YouTube thumbnails and the embedded player both load from YouTube. If a
thumbnail can't load, its tapestry gets woven static with the title instead.
Opened from disk, YouTube sometimes refuses to embed; the player has a "watch it
on youtube" link for that. Both work properly once it's on GitHub Pages.

## knobs

- `?raw` on any URL shows the scene without the print pass
- `pixel` in `P.create` (plate.js, default 380): lower = crunchier
- the `hatch(...)` lines and `P(...)` palette rows in plate.js
- `P.follow(... { yaw, pitch, rate })` per scene: how far and how lazily the
  camera follows the mouse
