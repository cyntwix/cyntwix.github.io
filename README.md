# Cyntwix

A hand-built personal site with a shared writing-submission archive backed by
Google Sheets and Google Apps Script for GitHub Pages.

## Run locally

```sh
python3 server.py
```

Open <http://127.0.0.1:8000>. The writing and entries pages use the Apps Script
deployment configured in `submission-config.js`. Opening the HTML files
directly keeps using browser-local storage as an offline preview.

## Raspberry Pi deployment

See `PI-SETUP.md` for the complete Raspberry Pi 5 imaging, installation,
networking, HTTPS, backup, and update procedure.
