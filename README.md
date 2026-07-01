# MMM-EventCountdown

Countdown zum nächsten Kalender-Event für [MagicMirror²](https://github.com/MichMich/MagicMirror/).

Ab Version 2.0 enthält das Modul einen **eigenen serverseitigen Kalender-Fetcher** (`node_helper.js`). Die Abhängigkeit von MMM-CalendarExt2 entfällt.

## Screenshots

![Screenshot](screenshots/Screenshot_start_5r_green.png)
![Screenshot](screenshots/Screenshot_running_g5.png)

---

## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/ppjoern/MMM-EventCountdown.git
cd MMM-EventCountdown
npm install
```

---

## Kalender-URLs konfigurieren

> **Die Kalender-URLs gehören NICHT in die Modul-Dateien** (`MMM-EventCountdown.js`, `node_helper.js`).
> Sie werden an **zwei Stellen** in der MagicMirror-Hauptkonfiguration hinterlegt:

### Schritt 1: Geheime URL in `config.env` eintragen

Datei: **`~/MagicMirror/config/config.env`**

```bash
# Google Calendar – private ICS-URL (aus Google Calendar → Einstellungen → Kalender integrieren)
SECRET_CAL_URL_1="https://calendar.google.com/calendar/ical/deine.email@gmail.com/private-abc123def456/basic.ics"

# Optional: weiterer Kalender
SECRET_CAL_URL_2="https://outlook.office365.com/owa/calendar/..."
```

> **Wo finde ich die URL?**
> - **Google Calendar:** Kalender → ⚙ Einstellungen → Kalender auswählen → „Geheime Adresse im iCal-Format" → URL kopieren
> - **Outlook/Office365:** Kalender → Einstellungen → Geteilte Kalender → Veröffentlichen → ICS-Link
>
> Die URL enthält ein **geheimes Token** – behandle sie wie ein Passwort!

### Schritt 2: Modul in `config.js` eintragen

Datei: **`~/MagicMirror/config/config.js`**

Root-Level in `config.js` (einmalig):

```js
let config = {
  hideConfigSecrets: true,
  // ...
  modules: [ /* … */ ],
};
```

Vollständiger Modul-Block (direkt in `modules: [ ... ]` einfügen):

```js
{
  module: "MMM-EventCountdown",
  position: "middle_center",

  config: {
    // --- Kalender (URLs in config.env, hier nur Verweis!) ---
    calendars: [
      {
        name: "Mein Kalender",
        url: "${SECRET_CAL_URL_1}",
        fetchTimeout: 30000,
      },
    ],
    allowedHosts: [],

    // --- Aktualisierung ---
    fetchInterval: 60000,   // Kalender neu laden (ms)
    customInterval: 1000,   // Countdown-Tick (ms)

    // --- Darstellung ---
    showLight: true,
    showColons: false,      // true = 05:23:45  |  false = 052345
    useUrgencyColors: true, // Farben je nach Restzeit | false = immer weiß

    size: "xlarge",         // small | medium | large | xlarge
    unitWidth: 2.8,         // Breite jeder Zahlengruppe (ch)
    groupGap: 0.5,          // Abstand zwischen Gruppen (ch)
    scale: 1,               // optional: globaler Größenfaktor
    // scaleBrowser: 1,     // optional: nur großer Screen (>1920px)
    // scaleHdmi: 1.1,      // optional: nur Pi/HDMI (≤1920px)

    showDebugBorders: false, // Layout-Rahmen (siehe unten)

    // --- Beschriftungen ---
    daysLabel: "DAYS",
    hoursLabel: "HOURS",
    minutesLabel: "MINUTES",
    secondsLabel: "SECONDS",
    noEventText: "NO SCHEDULED EVENT!",
    runningText: "is running",
    startsInText: "starts in",
  },
},
```

> Die gleiche Vorlage liegt als `config.example.js` im Modul-Ordner.

Minimal-Beispiel:

```js
{
  module: "MMM-EventCountdown",
  position: "middle_center",
  config: {
    calendars: [{ name: "Mein Kalender", url: "${SECRET_CAL_URL_1}" }],
    size: "xlarge",
    showColons: false,
    showLight: true,
  },
},
```

### Zusammenfassung: Wo was hingehört

| Was | Wo | Beispiel |
|-----|----|----------|
| **Echte Kalender-URL** (geheim) | `~/MagicMirror/config/config.env` | `SECRET_CAL_URL_1="https://calendar.google.com/..."` |
| **Verweis auf die URL** | `~/MagicMirror/config/config.js` → `calendars[].url` | `url: "${SECRET_CAL_URL_1}"` |
| **Secret-Schutz aktivieren** | `~/MagicMirror/config/config.js` (Root-Level) | `hideConfigSecrets: true` |
| **Modul-Code** | `modules/MMM-EventCountdown/` | ❌ Keine URLs hier eintragen! |

### Sicherheitshinweise

1. **`hideConfigSecrets: true`** setzen – verhindert, dass URLs im Browser (`/config`) sichtbar sind.
2. **`SECRET_`-Präfix** für alle Kalender-URLs in `config.env` verwenden.
3. **`ipWhitelist`** in `config.js` setzen, damit nur vertrauenswürdige Geräte auf den Spiegel zugreifen können:
   ```js
   ipWhitelist: ["127.0.0.1", "::ffff:127.0.0.1", "::1", "192.168.1.0/24"],
   ```
4. Der `node_helper` lädt Kalender **nur serverseitig** – die URL erreicht nie den Browser.
5. Nur bekannte Kalender-Domains sind erlaubt (SSRF-Schutz). Eigene Server über `allowedHosts` freigeben:
   ```js
   allowedHosts: ["mein-kalender.example.com"],
   ```

---

## Konfigurationsoptionen

### Kalender & Sicherheit

| Option | Beschreibung | Standard |
|--------|-------------|----------|
| `calendars` | Array mit `{ name, url, fetchTimeout? }` | `[]` |
| `calendars[].name` | Anzeigename (nur für Logs) | – |
| `calendars[].url` | Verweis auf Env-Variable, z. B. `"${SECRET_CAL_URL_1}"` | – |
| `calendars[].fetchTimeout` | Timeout pro Kalender-Abruf (ms) | `30000` |
| `allowedHosts` | Zusätzliche erlaubte Domains (SSRF-Whitelist) | `[]` |
| `fetchInterval` | Kalender-Neuladen (ms) | `60000` |
| `customInterval` | Countdown-Aktualisierung (ms) | `1000` |

### Darstellung

| Option | Beschreibung | Standard |
|--------|-------------|----------|
| `size` | Größen-Preset: `small`, `medium`, `large`, `xlarge` | `"medium"` |
| `unitWidth` | Breite jeder Zahlengruppe in `ch` | `2.8` |
| `groupGap` | Abstand zwischen Zahlengruppen in `ch` | `0.5` |
| `showColons` | Doppelpunkte zwischen Gruppen (`05:23:45`) | `false` |
| `showLight` | Ampel-Grafik unter dem Countdown | `false` |
| `useUrgencyColors` | Farben je nach Restzeit (grün → orange) | `true` |
| `valueSize` | Feste Schriftgröße (z. B. `"12rem"`) – nur bei **einem** Display | `null` |

### Skalierung (optional)

| Option | Beschreibung | Standard |
|--------|-------------|----------|
| `scale` | Globaler Faktor auf die CSS-Größe | `1` |
| `scaleBrowser` | Faktor nur für großen Screen (max. Dimension > 1920px) | `null` (= `scale`) |
| `scaleHdmi` | Faktor nur für kleinen Screen (Pi/HDMI, ≤ 1920px) | `null` (= `scale`) |

Die Basisgröße kommt aus **CSS `clamp(vmin)`** und passt sich pro Browser automatisch an. `scale*` ist nur für Feintuning.

| Preset | CSS-Formel (Ziffernhöhe) |
|--------|--------------------------|
| `small` | `clamp(4vmin, 8vmin, 15vmin)` |
| `medium` | `clamp(5vmin, 11vmin, 20vmin)` |
| `large` | `clamp(6vmin, 13vmin, 26vmin)` |
| `xlarge` | `clamp(8vmin, 17vmin, 34vmin)` |

### Texte

| Option | Beschreibung | Standard |
|--------|-------------|----------|
| `daysLabel` | Label Tage | `"DAYS"` |
| `hoursLabel` | Label Stunden | `"HOURS"` |
| `minutesLabel` | Label Minuten | `"MINUTES"` |
| `secondsLabel` | Label Sekunden | `"SECONDS"` |
| `noEventText` | Text wenn kein Event | `"NO SCHEDULED EVENT!"` |
| `runningText` | Text während Event läuft | `"is running"` |
| `startsInText` | Text vor Event-Start | `"starts in"` |

### Debug

| Option | Beschreibung | Standard |
|--------|-------------|----------|
| `showDebugBorders` | Farbige Rahmen um Layout-Zellen | `false` |

Alternativ ohne `config.js`:

- URL: `http://<spiegel-ip>:8080/?debugBorders=1`
- Browser-Konsole: `localStorage.setItem("MMM-EventCountdown-debug","1"); location.reload();`

---

## Tipps zur Feinjustierung

### Größe

```js
size: "xlarge",   // Hauptregler – skaliert mit Viewport (vmin)
```

### Abstände zwischen Zifferngruppen

```js
groupGap: 0.5,    // kleiner = enger  |  größer = weiter
unitWidth: 2.8,   // Spaltenbreite pro Gruppe (2 Ziffern + etwas Luft)
```

Bei `showColons: true` sitzt der Doppelpunkt **in** der `groupGap`-Breite – der Abstand wird nicht verdoppelt.

### Gemischte Displays (Browser + HDMI)

Eine `config.js` für alle Clients. Jeder Browser rechnet mit seinem Viewport:

```js
size: "xlarge",
// nur falls ein Display noch abweicht:
// scaleBrowser: 0.95,
// scaleHdmi: 1.1,
```

### Farben

- `useUrgencyColors: true` – Countdown-Ziffern wechseln je nach Restzeit; laufende Events grün
- Titel und Untertitel („starts in“ / „is running“) sind immer weiß
- Bei `showColons: true` haben Doppelpunkte die gleiche Farbe wie die Ziffern

---

## Migration von MMM-CalendarExt2

Wenn du bisher MMM-CalendarExt2 genutzt hast:

1. Die Kalender-URL aus der CalExt2-Config (`calendars[].url`) in `config.env` als `SECRET_CAL_URL_1` übernehmen.
2. MMM-CalendarExt2 aus `config.js` entfernen (optional, wenn nicht mehr benötigt).
3. `npm install` im Modul-Ordner ausführen (neue Abhängigkeit `node-ical`).
4. MagicMirror neu starten.

---

## Architektur

```
config.env (SECRET_CAL_URL_1)  ──┐
config.js  (calendars[].url)   ──┤
                                   ▼
                          node_helper.js  (Server, Node.js)
                          ├── URL aus process.env auflösen
                          ├── ICS-Feed abrufen (HTTPS only)
                          ├── SSRF-Whitelist prüfen
                          └── Events parsen (node-ical)
                                   │
                          Socket: "EVENTS"
                                   ▼
                          MMM-EventCountdown.js  (Browser)
                          ├── Nächstes Event filtern
                          ├── Countdown berechnen
                          └── DOM sicher aufbauen (textContent)
```

---

## Lizenz

MIT
