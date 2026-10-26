# fretlearn 🎸

**Lerne, wo jeder Ton auf dem Gitarren-Griffbrett liegt** – in kurzen Runden zwischendurch, am Handy, ohne Gitarre und ohne Noten lesen zu müssen.

> ⚡ **Diese Website ist fully vibecoded** – komplett mit KI (Claude) gebaut, ohne eine Zeile von Hand zu schreiben.

👉 **Live:** https://rustamakhmedov.github.io/fretlearn/

## Was kann's?

- **Lernpfad in 8 Lektionen:** tiefe E-Saite → A-Saite → Oktav-Formen → D/G → B/e → ♯/♭ → alles gemischt → Brücke zu Akkorden
- **4 Übungsmodi:** Ton benennen · Ton finden · Alle Stellen eines Tons finden · Oktaven
- **Erkunden:** freies Griffbrett, Töne ein-/ausblenden und anhören
- **Tipps & Tricks** mit interaktiven Mini-Griffbrettern: Oktav-Formen, B-Saiten-Knick, Stimm-Logik, Powerchords, Barré-Formen, Pentatonik
- **Lernt mit dir:** schwache Töne kommen öfter dran; „sicher“ ist ein Ton erst, wenn du ihn dreimal schnell (< 3 s) richtig weißt
- **Fehler werden erklärt:** z. B. „Oktav-Form: tiefe E-Saite, Bund 5 ist auch A“
- **Fortschritts-Heatmap**, Tages-Serie, Gitarrenton direkt im Browser
- Internationale Notennamen (B) oder deutsche (H), Bund 0–12 oder 0–24
- **Offline nutzbar** (PWA) – im Browser „Zum Startbildschirm hinzufügen“

Alles wird nur lokal im Browser gespeichert – kein Account, kein Server.

## Technik

Reines HTML/CSS/JavaScript (ES-Module), kein Build-Schritt. Läuft direkt auf GitHub Pages.

```
index.html          Grundgerüst
css/style.css       Design
js/app.js           Seiten & Navigation
js/quiz.js          Übungsrunden
js/fretboard.js     SVG-Griffbrett
js/theory.js        Töne, Namen, Herleitungen
js/lessons.js       Lernpfad
js/tips.js          Tipps & Tricks
js/store.js         Fortschritt (localStorage)
js/audio.js         Gitarrenton (Karplus-Strong, Web Audio)
sw.js               Offline-Cache
android/            Android-App (WebView-Hülle, Fortschritt als Datei)
```

Lokal starten: `python3 -m http.server` im Ordner, dann http://localhost:8000 öffnen.
Tests: `node --test tests/*.test.mjs`

Bei Änderungen an Dateien die `VERSION` in `sw.js` erhöhen.

## Android-App

Im Browser kann der Fortschritt verloren gehen, wenn der Browser aufräumt. Deshalb gibt's fretlearn auch als eigene Android-App: dieselbe Website, eingepackt in eine WebView. Der Fortschritt wird zusätzlich als Datei im App-Speicher abgelegt.

```
android/build.sh            APK bauen → android/build/fretlearn.apk
android/build.sh install    bauen + per USB (adb) aufs Handy
```

Braucht nur das Android-SDK (`~/Android/Sdk` oder `ANDROID_HOME`, Build-Tools + eine Plattform) und ein JDK – kein Gradle.
