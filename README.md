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

```js
let config = {
  address: "0.0.0.0",
  port: 8080,

  // WICHTIG: Secrets vor dem Browser schützen
  hideConfigSecrets: true,

  modules: [
    {
      module: "MMM-EventCountdown",
      position: "middle_center",
      config: {
        // Kalender-Referenz – URL kommt aus config.env (Schritt 1)
        calendars: [
          {
            name: "Mein Kalender",
            url: "${SECRET_CAL_URL_1}",   // ← Verweis auf config.env-Variable
          },
          // {
          //   name: "Arbeit",
          //   url: "${SECRET_CAL_URL_2}",
          // },
        ],

        showLight: true,
        size: "medium",          // "small" | "medium" | "large"
        fetchInterval: 60000,    // Kalender alle 60s neu laden
        customInterval: 1000,    // Countdown jede Sekunde aktualisieren
      },
    },
  ],
};
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

| Option | Beschreibung | Standard |
|--------|-------------|----------|
| `calendars` | Array mit Kalender-Objekten `{ name, url }` | `[]` |
| `calendars[].name` | Anzeigename (nur für Logs) | – |
| `calendars[].url` | Verweis auf Env-Variable, z. B. `"${SECRET_CAL_URL_1}"` | – |
| `allowedHosts` | Zusätzliche erlaubte Domains für SSRF-Whitelist | `[]` |
| `fetchInterval` | Intervall für Kalender-Neuladen (ms) | `60000` |
| `customInterval` | Countdown-Aktualisierung (ms) | `1000` |
| `showLight` | Ampel-Grafik anzeigen | `false` |
| `size` | Größe: `"small"`, `"medium"`, `"large"` | `"medium"` |
| `daysLabel` | Label für Tage | `"DAYS"` |
| `hoursLabel` | Label für Stunden | `"HOURS"` |
| `minutesLabel` | Label für Minuten | `"MINUTES"` |
| `secondsLabel` | Label für Sekunden | `"SECONDS"` |

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
