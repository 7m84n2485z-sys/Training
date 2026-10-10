# Training

Web App fürs Krafttraining: Pläne anlegen, Training aufzeichnen, Fortschritt auswerten.

* Läuft ohne Bauschritt, nur HTML, CSS und JavaScript
* Daten liegen im localStorage des Geräts, Sicherung als JSON Datei in den Einstellungen
* Offline Betrieb über den Service Worker (`sw.js`). Bei neuen Dateien die Liste dort ergänzen und `CACHE` hochzählen

## Lokal testen

```
python3 -m http.server 8765
```

Dann http://localhost:8765 öffnen.

## Symbole neu erzeugen

```
node tools/make-icons.mjs
```
