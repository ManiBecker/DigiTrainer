# DigiTrainer

**Web-based simulator for the ITT Digi-Trainer 2 digital electronics training system.**

Der DigiTrainer ist ein browserbasierter Simulator des historischen **ITT Digi-Trainer 2**, eines Lehrsystems für digitale Elektronik.

Ziel des Projekts ist es, die Experimente des Originals möglichst realitätsnah am Bildschirm nachzubilden – einschließlich Schaltern, LEDs, Steckbuchsen, Patchkabeln und digitalen Logikbausteinen.

Der Simulator basiert auf einem Foto des originalen Geräts. Die Bedienelemente und Steckbuchsen werden durch interaktive Elemente ergänzt.

## Live-Demo

Der aktuelle Entwicklungsstand kann direkt im Browser ausprobiert werden:

👉 [DigiTrainer ausprobieren](https://manibecker.github.io/DigiTrainer/)

<a href="https://manibecker.github.io/DigiTrainer/">
  <img src="images/digitrainer-qr.jpg"
       alt="QR-Code zur DigiTrainer Live-Demo"
       width="150">
</a>

## Bereits implementierte Funktionen

### Bedienung und Verdrahtung

- Originalgetreue Darstellung des ITT Digi-Trainer 2
- Interaktive Hauptschalter- und Betriebs-LED-Simulation
- Acht bedienbare Schiebeschalter S0–S7
- Simulation der Schalter- und Ausgangs-LEDs D0–D7
- Mehr als 200 definierte Steckbuchsen (Hotspots)
- Patchkabel durch Ziehen zwischen zwei Buchsen verbinden
- Grafische Darstellung der Kabel mit leichtem Durchhang
- Elektrische Auswertung der gesteckten Verbindungen
- Gemeinsame +5-V- und GND-Versorgungsschienen
- Erkennung von Kurzschlüssen und Ausgangskonflikten
- Anzeige von Anschlussbezeichnungen und IC-Pinfunktionen

Die Verdrahtung ist bei ausgeschaltetem DigiTrainer möglich. Nach dem Einschalten können die Schalter betätigt und die logischen Zustände beobachtet werden.

### Simulierte Logik-ICs

Die sechs IC-Sockel des DigiTrainers sind inzwischen mit folgenden Bausteinen implementiert:

| Sockel | IC | Funktion |
|---|---|---|
| 0 | SN74LS02N | 4 × NOR mit je 2 Eingängen |
| 1 | SN74LS04N | 6 × NOT (Inverter) |
| 2 | SN74LS08N | 4 × AND mit je 2 Eingängen |
| 3 | SN74LS86AN | 4 × XOR mit je 2 Eingängen |
| 4 | 74LS00PC | 4 × NAND mit je 2 Eingängen |
| 5 | CD4069UBE | 6 × CMOS-NOT (Inverter) |

Die Logikgatter lassen sich über Patchkabel miteinander kombinieren. Ihre Ausgänge werden anhand der Eingangszustände berechnet.

Die ICs benötigen eine korrekte Verbindung zu +5 V und GND. Nicht angeschlossene Eingänge können einen unbestimmten Zustand annehmen.

Die Simulation bildet derzeit die digitale Logik ab, nicht jedoch analoge Eigenschaften wie Schaltzeiten, Spannungspegel oder Stromaufnahme.

### Zoom und Vollbild

- Zoom von 100 % bis 400 %
- Zoom über Schaltflächen und Tastatur
- Mausrad-Zoom am PC
- Zwei-Finger-Zoom auf Touchscreens
- Verschieben der vergrößerten Platine
- Automatische Anpassung an die verfügbare Bildschirmgröße
- Vollbildmodus auf PC und iPad
- Pseudo-Vollbildmodus auf dem iPhone

Der Simulator ist damit auch auf Smartphones und Tablets bedienbar.

### Vermessungsmodus

Mit der Taste **M** kann zwischen Verdrahtungs- und Vermessungsmodus umgeschaltet werden.

Im Vermessungsmodus lassen sich Positionen und rechteckige Bereiche auf der Platine bestimmen. Die Koordinaten werden im JSON-Format ausgegeben und erleichtern die Definition weiterer Hotspots.

## Bedienung

| Aktion | Funktion |
|---|---|
| Hauptschalter | DigiTrainer ein- oder ausschalten |
| Ziehen von Buchse zu Buchse | Patchkabel stecken |
| Schiebeschalter anklicken | Logischen Zustand ändern |
| M | Vermessungsmodus umschalten |
| + / − | Vergrößern / Verkleinern |
| 0 | Zoom auf 100 % zurücksetzen |
| Mausrad | Zoom am Mauszeiger |
| Zwei-Finger-Geste | Zoom auf Touchscreens |
| Vollbild | Vollbildmodus aktivieren oder beenden |

## Technische Umsetzung

Der DigiTrainer wird mit HTML, CSS und JavaScript umgesetzt und benötigt keine Installation.

Die wichtigsten Projektdateien sind:

- `index.html` – Benutzeroberfläche
- `css/digitrainer.css` – Darstellung und Layout
- `js/simulator.js` – Bedienung, Verdrahtung und Logiksimulation
- `boards/itt-digitrainer2/board.jpg` – Foto des Originalgeräts
- `boards/itt-digitrainer2/board.json` – Positionen und Definitionen der Hotspots, Schalter und LEDs

Das Projekt wird über GitHub Pages bereitgestellt.

## Geplante Erweiterungen

- Bereits gesteckte Patchkabel einzeln entfernen
- Weitere Baugruppen des DigiTrainers simulieren
- ALU und Zähler
- Siebensegmentanzeige
- Taktgenerator
- A/D-Wandler
- Experimente aus dem originalen ITT-Lehrmaterial nachbilden
- Schaltungen beziehungsweise Verdrahtungen speichern und wieder laden

## Projektstatus

**Work in Progress – Stand Oktober 2026**

Die grundlegende Bedienung, elektrische Verdrahtung und Simulation der sechs Logik-ICs sind implementiert. Weitere Baugruppen und Funktionen befinden sich in Planung.

Fehlermeldungen, Anregungen und Verbesserungsvorschläge sind willkommen!

## Links

- **Live-Demo:** https://manibecker.github.io/DigiTrainer/
- **GitHub:** https://github.com/ManiBecker/DigiTrainer
