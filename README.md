# DigiTrainer

**A web-based simulator of the ITT Digi-Trainer 2 digital electronics training system.**

<a href="https://manibecker.github.io/DigiTrainer/">
  <img src="images/digitrainer-v0.67.jpg"
       alt="DigiTrainer Live-Demo"
       width="800"
       style="max-width: 100%; height: auto;">
</a>

Der **DigiTrainer** ist ein browserbasierter Simulator des historischen **ITT Digi-Trainer 2**, eines Lehr- und Experimentiersystems für digitale Elektronik.

Ziel des Projekts ist es, die Funktionen und Experimente des Originals möglichst realitätsnah am Bildschirm nachzubilden. Dazu gehören Schalter, LEDs, Steckbuchsen, Patchkabel und verschiedene digitale Logikbausteine.

Der Simulator basiert auf Fotografien eines originalen ITT Digi-Trainer 2. Die Bedienelemente und Steckbuchsen wurden durch interaktive Elemente ergänzt. Die gesteckten Verbindungen werden elektrisch ausgewertet, sodass sich digitale Schaltungen aufbauen und unmittelbar ausprobieren lassen.

**Für die Online-Version ist keine Installation und keine zusätzliche Hardware erforderlich – ein moderner Browser genügt.**

## 🚀 Live-Demo

Der aktuelle Entwicklungsstand kann direkt im Browser ausprobiert werden:

👉 **[DigiTrainer starten](https://manibecker.github.io/DigiTrainer/)**

<a href="https://manibecker.github.io/DigiTrainer/">
  <img src="images/digitrainer-qr.jpg"
       alt="QR-Code zur DigiTrainer Live-Demo"
       width="150">
</a>

## ✨ Bereits implementierte Funktionen

### Bedienung und Verdrahtung

- Originalgetreue Darstellung des ITT Digi-Trainer 2
- Originalgetreuer Hauptschalter mit fotografischem ON-Overlay und roter Betriebsanzeige
- Acht bedienbare Schiebeschalter S0–S7
- Simulation der Schalter- und Ausgangs-LEDs D0–D7
- Mehr als 200 definierte Steckbuchsen (Hotspots)
- Patchkabel durch Ziehen zwischen zwei Buchsen stecken
- Einzelne Patchkabel durch erneutes Ziehen derselben Verbindung entfernen (A → B oder B → A)
- Patchkabel durch Antippen oder Anklicken markieren; erneutes Antippen entfernt die markierte Leitung
- Markierte Kabel mit **Entf**, **Rücktaste** oder per **Rechtsklick** entfernen
- Stecker eines markierten Kabels abziehen und auf eine andere Buchse umstecken; Loslassen im Leeren entfernt das Kabel
- **Rückgängig** über **Strg+Z** (bzw. ⌘+Z) oder die Schaltfläche **↶**, bis zu 50 Kabeländerungen
- Bedienung der Kabelbearbeitung mit Maus und Touch
- Grafische Darstellung der Kabel mit leichtem Durchhang und Schatten
- Unterschiedliche Kabelfarben: elektrisch zusammenhängende Leitungen werden gleichfarbig dargestellt
- Elektrische Auswertung der gesteckten Verbindungen
- Gemeinsame +5-V- und GND-Versorgungsschienen
- Fünf passive Verbindungsschienen L0–L4 mit jeweils vier elektrisch verbundenen Buchsen
- Erkennung von Kurzschlüssen und Ausgangskonflikten
- Anzeige von Anschlussbezeichnungen und IC-Pinfunktionen

Das Stecken, Markieren, Entfernen und Umstecken von Patchkabeln ist nur bei ausgeschaltetem DigiTrainer und außerhalb des Vermessungsmodus möglich. Nach dem Einschalten können die Schalter betätigt und die logischen Zustände beobachtet werden.

### Digitale Logikbausteine

Die sechs Logik-IC-Sockel des DigiTrainers sind bereits implementiert:

| Sockel | IC | Funktion |
|---|---|---|
| 0 | SN74LS02N | 4 × NOR mit je 2 Eingängen |
| 1 | SN74LS04N | 6 × NOT (Inverter) |
| 2 | SN74LS08N | 4 × AND mit je 2 Eingängen |
| 3 | SN74LS86AN | 4 × XOR mit je 2 Eingängen |
| 4 | 74LS00PC | 4 × NAND mit je 2 Eingängen |
| 5 | CD4069UBE | 6 × CMOS-NOT (Inverter) |

Die Logikgatter können über Patchkabel miteinander kombiniert werden. Ihre Ausgangszustände werden anhand der Eingangssignale berechnet.

Die ICs benötigen eine korrekte Verbindung zu +5 V und GND. Offene Eingänge der simulierten 74LS-TTL-Gatter werden bei der logischen Auswertung als HIGH interpretiert; offene CMOS-Eingänge des CD4069 bleiben undefiniert.

### Taktgenerator

Der integrierte Taktgenerator ist ebenfalls simuliert.

- Automatischer Takt mit 1 Hz oder 10 Hz
- Manueller Takt über einen Taster
- Starten und Anhalten des automatischen Takts
- Takt- und invertierter Taktausgang

Damit lassen sich auch zeitabhängige digitale Schaltungen untersuchen.

### 4-Bit-Binärzähler – SN74LS293N

Der **SN74LS293N** ist als digitaler 4-Bit-Zähler implementiert.

- Zwei Takteingänge CK A und CK B
- Vier Ausgänge QA–QD
- Zwei asynchrone Reset-Eingänge
- Binäre Zählfolge von 0 bis 15
- Anschluss an den integrierten Taktgenerator

In Verbindung mit der 7-Segment-Anzeige lassen sich die Zählerstände unmittelbar sichtbar machen.

### 7-Segment-Anzeige – MC14495P

Die integrierte 7-Segment-Anzeige wird durch einen **MC14495P** angesteuert.

- Vier binäre Eingänge mit den Wertigkeiten 1, 2, 4 und 8
- Darstellung der Hexadezimalwerte 0 bis F
- Latch-Funktion über den Eingang E
- Anzeige reagiert auf die elektrisch verbundenen Eingangssignale

Damit können beispielsweise die Ausgänge des Binärzählers oder der ALU direkt angezeigt werden.

### 4-Bit-ALU – SN74LS382N

Auch die **Arithmetic Logic Unit (ALU)** des DigiTrainers ist inzwischen implementiert.

Die ALU verarbeitet zwei 4-Bit-Zahlen und stellt das Ergebnis an vier Ausgängen bereit.

| Anschlüsse | Funktion |
|---|---|
| A0–A3 | Erster 4-Bit-Operand |
| B0–B3 | Zweiter 4-Bit-Operand |
| S0–S2 | Auswahl der Operation |
| Cn | Eingangsübertrag |
| F0–F3 | 4-Bit-Ergebnis |
| OVR | Überlaufsignal |
| Cn+4 | Ausgangsübertrag |

Unterstützt werden arithmetische und logische Operationen, darunter Addition, Subtraktion, AND, OR und XOR.

**Erster erfolgreicher Test: 3 + 2 = 5**

Das Ergebnis wurde über Patchkabel an die 7-Segment-Anzeige übertragen und dort korrekt dargestellt.

### 6-Bit-A/D-Wandler – NE5037N (experimentell)

Der integrierte **NE5037N** ist inzwischen als vereinfachtes Modell eines 6-Bit-Analog-Digital-Wandlers implementiert.

- Berücksichtigung des analogen Eingangssignals im vereinfachten Simulationsmodell
- Sechs digitale Ausgänge Q0–Q5
- Start-, Takt- und Freigabesignale
- Wandlungsablauf über mehrere Taktzyklen
- Darstellung des Wandlungsergebnisses über die Ausgangs-LEDs

**Erfolgreich getestete Grenzwerte:**

- 0 V am Eingang → `000000`
- +5 V am Eingang → `111111`

Die Modellierung ist noch **experimentell**. Insbesondere die tatsächliche analoge Beschaltung des Originalgeräts, Zwischenwerte und zeitliche Details müssen weiter untersucht und verifiziert werden.

## 💾 Projekte speichern und laden

Ab **v0.64** lassen sich aufgebaute Schaltungen über den Button **Projekt** speichern und später wiederherstellen.

- **Im Browser speichern:** Projekte unter einem frei wählbaren Namen im lokalen Browserspeicher (`localStorage`) ablegen, aus einer Liste laden oder löschen.
- **Als Datei exportieren:** Die aktuelle Schaltung als lesbare **JSON-Datei** herunterladen.
- **Datei importieren:** Eine zuvor exportierte JSON-Datei auswählen und die Schaltung wiederherstellen – auch auf einem anderen Rechner oder in einem anderen Browser.

Gespeichert werden die Verbindungen zwischen den Steckbuchsen, die Stellungen der Schalter **S0–S7**, die Einstellungen **f** und **STOP** des Taktgenerators sowie die **Debug-Anzeige**. Die Dateien enthalten Buchsen-IDs und Schalterzustände, keine Bildschirmfotos.

Beim Laden wird der DigiTrainer ausgeschaltet. Interne Laufzeitzustände der simulierten Bausteine, etwa ein aktueller Zählerstand, werden nicht gespeichert. Im Browser abgelegte Projekte sind an den jeweiligen Browser und die Website gebunden und können beim Löschen der Browserdaten verloren gehen. Für eine dauerhafte Sicherung empfiehlt sich der JSON-Export.

Die Projektverwaltung wurde von **[Lutz (lschulze)](https://github.com/lschulze)** als erster externer Beitrag über **[Pull Request #1](https://github.com/ManiBecker/DigiTrainer/pull/1)** beigesteuert.

## 💡 Beispielprojekte

Im Verzeichnis [`projects/`](projects/) stehen vier vorbereitete Beispielschaltungen. Im Dialog **Projekt** lädt der DigiTrainer diese Dateien immer aus dem Repository [ManiBecker/DigiTrainer](https://github.com/ManiBecker/DigiTrainer), Branch `main`. Dafür ist eine Internetverbindung nötig. Ein Tipp auf den Dateinamen zeigt die Beschreibung, Laden übernimmt die Schaltung. Dieselbe JSON-Datei lässt sich weiterhin über **Datei importieren** laden.

Die optionale Beschreibung steht im Feld `description` der JSON-Datei oder in einer Textdatei mit demselben Namen (`counter-1.json` und `counter-1.txt`). Der Dialog liest sie nur. Eine eigene Beschreibung wird beim Speichern im Browser und beim JSON-Export mit der eigenen Schaltung gespeichert. Ohne Beschreibungstext bleibt das Laden möglich.

| Projekt | Beschreibung |
|---|---|
| [`counter-1.json`](projects/counter-1.json) | 4-Bit-Binärzähler mit hexadezimaler 7-Segment-Anzeige (0 bis F) |
| [`counter-2.json`](projects/counter-2.json) | 4-Bit-Binärzähler mit 7-Segment-Anzeige und zusätzlicher binärer Anzeige über D4–D7; S0 beeinflusst den Anzeigeeingang E |
| [`lauflicht-D0-D7.json`](projects/lauflicht-D0-D7.json) | Lauflicht über alle acht LEDs von D0 bis D7 |
| [`lauflicht-D0-D7-Pendel.json`](projects/lauflicht-D0-D7-Pendel.json) | Pendellauflicht von D0 nach D7 und zurück, mit doppelter Leuchtdauer an den Endpunkten |

**Beispiel ausprobieren:**

1. DigiTrainer starten.
2. **Projekt** öffnen und die gewünschte Beispielschaltung laden.
3. DigiTrainer einschalten und den Taktgenerator starten.

Die Lauflichtschaltungen verwenden den integrierten 4-Bit-Zähler, den Taktgenerator und die bereits simulierten Logik-ICs. Es sind keine zusätzlichen virtuellen Bauteile erforderlich. Die Beispielprojekte wurden im Simulator erfolgreich ausprobiert.

## 🐞 Debug-Anzeige

Über die Checkbox **Debug** lassen sich bei eingeschaltetem Gerät die logischen Zustände der Verdrahtung farblich anzeigen: **Rot** für HIGH (1), **Hellblau** für LOW (0) und **Hellgrau** für einen unbestimmten Zustand. Zusätzlich erscheinen die binären Zustände **0/1** unter den Schaltern S0–S7 und den Ausgangs-LEDs D0–D7.

Ohne Debug-Anzeige bleiben die Kabelfarben sichtbar: Zusammenhängende elektrische Netze erhalten dieselbe Farbe; Versorgung und Masse haben eigene Farben. Die Patchkabel werden außerdem mit Schatten dargestellt.

## 🔍 Zoom und Vollbild

- Zoom von 100 % bis 400 %
- Zoom über Schaltflächen und Tastatur
- Mausrad-Zoom am PC
- Zwei-Finger-Zoom auf Touchscreens
- Verschieben der vergrößerten Platine
- Automatische Anpassung an die Bildschirmgröße
- Vollbildmodus auf PC und iPad
- Pseudo-Vollbildmodus auf dem iPhone

Der Simulator ist damit auch auf Smartphones und Tablets bedienbar.

## 📐 Vermessungsmodus

Mit der Taste **M** kann zwischen Verdrahtungs- und Vermessungsmodus umgeschaltet werden.

Im Vermessungsmodus lassen sich Positionen und rechteckige Bereiche auf der Platine bestimmen. Die Koordinaten werden im JSON-Format ausgegeben und erleichtern die Definition weiterer Hotspots.

## 🎮 Bedienung

| Aktion | Funktion |
|---|---|
| Hauptschalter | DigiTrainer ein- oder ausschalten |
| Ziehen von Buchse A zu Buchse B | Patchkabel stecken |
| Erneutes Ziehen zwischen denselben Buchsen | Vorhandenes Patchkabel entfernen (auch B → A) |
| Kabel einmal anklicken/antippen | Kabel markieren |
| Markiertes Kabel erneut anklicken/antippen | Kabel entfernen |
| Entf / Rücktaste | Markiertes Kabel entfernen |
| Rechtsklick auf ein Kabel | Kabel entfernen |
| Stecker eines markierten Kabels ziehen | Kabel umstecken; im Leeren loslassen entfernt das Kabel |
| Strg+Z / ⌘+Z oder ↶ | Letzte Kabeländerung rückgängig (bis zu 50 Schritte) |
| Esc | Kabelmarkierung aufheben |
| Schiebeschalter anklicken | Logischen Zustand ändern |
| Taktgenerator bedienen | Manuellen oder automatischen Takt erzeugen |
| M | Vermessungsmodus umschalten |
| + / − | Vergrößern / Verkleinern |
| 0 | Zoom auf 100 % zurücksetzen |
| Mausrad | Zoom am Mauszeiger |
| Zwei-Finger-Geste | Zoom auf Touchscreens |
| Vollbild | Vollbildmodus aktivieren oder beenden |
| Debug | Logikpegel und binäre Zustände ein- oder ausblenden |
| Projekt | Schaltung im Browser speichern/laden oder als JSON-Datei exportieren/importieren |

**Hinweis:** Patchkabel lassen sich nur bei ausgeschaltetem DigiTrainer und außerhalb des Vermessungsmodus bearbeiten. Die neue Kabelbedienung funktioniert auch auf Touch-Geräten.

## 🛠 Technische Umsetzung

Der DigiTrainer wird vollständig mit **HTML, CSS und JavaScript** umgesetzt und benötigt keine Installation.

Die wichtigsten Projektdateien sind:

```text
DigiTrainer/
├── index.html
├── help.html
├── css/
│   └── digitrainer.css
├── js/
│   ├── simulator.js
│   ├── projekt.js
│   └── kabel.js
├── boards/
│   └── itt-digitrainer2/
│       ├── board.jpg
│       └── board.json
├── projects/
│   ├── counter-1.json
│   ├── counter-1.txt
│   ├── counter-2.json
│   ├── counter-2.txt
│   ├── lauflicht-D0-D7.json
│   ├── lauflicht-D0-D7.txt
│   ├── lauflicht-D0-D7-Pendel.json
│   └── lauflicht-D0-D7-Pendel.txt
└── images/
    ├── digitrainer-v0.67.jpg
    ├── digitrainer-qr.jpg
    ├── power-on.jpg
    └── switch-off.jpg
```

Die Aufgaben der einzelnen Dateien:

- `index.html` – Benutzeroberfläche
- `css/digitrainer.css` – Darstellung und Layout
- `js/simulator.js` – Bedienung, Verdrahtung und elektrische Simulation
- `js/projekt.js` – Projektverwaltung, Browserspeicher, JSON-Import und -Export, optionale Beschreibung und Beispielschaltungen aus `projects/`
- `js/kabel.js` – Kabel markieren, entfernen, umstecken und Änderungen rückgängig machen
- `help.html` – Bedienungshinweise und Hilfe
- `boards/itt-digitrainer2/board.jpg` – Foto des Originalgeräts
- `boards/itt-digitrainer2/board.json` – Positionen und Definitionen der Steckbuchsen, Schalter und LEDs einschließlich der Hauptschalter-Konfiguration
- `images/power-on.jpg` – fotografisches Overlay des eingeschalteten Hauptschalters
- `projects/` – importierbare JSON-Beispielschaltungen

Die Simulation arbeitet mit einem Verbindungsmodell, das die über Patchkabel zusammengeschalteten Anschlüsse zu elektrischen Netzen zusammenfasst. Dazu gehören auch die passiven Verbindungsschienen L0–L4.

Auf dieser Grundlage werden die Eingangssignale, Logikfunktionen und Ausgangszustände berechnet. Bei Änderungen der Verdrahtung wird die Netzstruktur neu ausgewertet.

Der Schwerpunkt liegt derzeit auf dem logischen Verhalten der Schaltungen. Analoge Eigenschaften wie reale Signallaufzeiten, Stromaufnahme oder elektrische Belastbarkeit werden nicht vollständig nachgebildet.

Das Projekt wird über **GitHub Pages** bereitgestellt.

### Lokal und offline ausführen

Die Live-Demo benötigt keine Installation. Für die lokale Offline-Nutzung das Repository herunterladen und im Projektverzeichnis einen kleinen lokalen Webserver starten, beispielsweise mit Python 3:

```bash
python3 -m http.server 8000
```

Unter Windows funktioniert alternativ häufig `py -m http.server 8000`. Anschließend `http://localhost:8000/` im Browser öffnen. Der Server wird mit **Strg+C** beendet. Eine Internetverbindung ist für die eigentliche Simulation nicht nötig.

**Wichtig:** Der direkte Aufruf von `index.html` über `file://` kann wegen der Browser-Sicherheitsbeschränkungen beim Laden von `board.json` die Verdrahtung verhindern. Die Beispielschaltungen kommen immer aus Manfreds Repository und brauchen dafür eine Internetverbindung.

## 📋 Geplante Erweiterungen

- Untersuchung und Simulation des Widerstandsnetzwerks R0–R7
- Verfeinerung und Validierung des analogen Modells des NE5037N
- Farbliche Kennzeichnung der logischen Pegel (HIGH/LOW/undefiniert) an den Steckbuchsen
- Optionaler virtueller Signalprüfer oder digitales Oszilloskop
- Experimente aus dem originalen ITT-Lehrmaterial nachbilden
- Weitere Verbesserungen der elektrischen Simulation
- Ergänzung von Beispielschaltungen und Bedienungshinweisen
- Vereinfachter Offline-Start ohne manuell gestarteten lokalen Webserver

## 📌 Projektstatus

**Work in Progress – Version 0.67, Oktober 2026**

Die grundlegende Bedienung, Verdrahtung und Simulation der sechs Logik-ICs sind implementiert. Darüber hinaus wurden folgende Funktionen bereits in grundlegenden Funktionstests erprobt:

- Taktgenerator
- 4-Bit-Binärzähler SN74LS293N
- 7-Segment-Anzeige mit MC14495P
- 4-Bit-ALU SN74LS382N (unter anderem Test `3 + 2 = 5`)
- Experimenteller 6-Bit-A/D-Wandler NE5037N (Grenzwerte 0 V und +5 V)
- Passive Verbindungsschienen L0–L4
- Gezieltes Entfernen einzelner Patchkabel durch erneutes Ziehen der Verbindung
- Kabelmarkierung, Entfernen durch Tipp/Rechtsklick/Tastatur und Umstecken einzelner Stecker
- Rückgängig-Funktion für bis zu 50 Kabeländerungen
- Bunte Patchkabel mit einheitlichen Netzfarben und Kabelschatten
- Logische HIGH-Auswertung offener 74LS-TTL-Eingänge
- Debug-Anzeige mit Logikpegeln und binären Zustandsanzeigen
- Speichern und Laden mehrerer Projekte im Browser
- Export und Import von Schaltungen als JSON-Dateien
- Fotografisches ON-Overlay des Hauptschalters, dessen Position und Größe über `board.json` festgelegt sind
- Vier Beispielprojekte: zwei Zählerschaltungen und zwei Lauflichtvarianten

Die wesentlichen digitalen Funktionsgruppen des Originalgeräts sind damit im Simulator abgebildet. Einige Details – insbesondere die analoge Beschaltung, das Widerstandsnetzwerk und das Verhalten bei Grenzfällen – müssen noch weiter untersucht werden.

Der DigiTrainer ist ein privates Hobby- und Lernprojekt. Die Simulation wird schrittweise erweitert und erhebt noch keinen Anspruch auf vollständige elektrische Genauigkeit.

**Fehlermeldungen, Anregungen und Verbesserungsvorschläge sind herzlich willkommen!**

## 🙏 Danksagung

Ein besonderer Dank gilt **jobi23 aus dem Classic-Computing-Forum**, der Fotografien seines originalen ITT Digi-Trainer 2 für dieses Projekt zur Verfügung gestellt hat.

Ohne diese Bilder wäre die originalgetreue Darstellung des Geräts in dieser Form nicht möglich gewesen.

Vielen Dank auch an die Mitglieder des Classic-Computing-Forums für die Anregungen und Diskussionen rund um dieses Projekt.

Ein herzliches Dankeschön an **[Lutz (lschulze)](https://github.com/lschulze)** für die Entwicklung der Projektverwaltung mit Browserspeicher und JSON-Import/-Export ([Pull Request #1](https://github.com/ManiBecker/DigiTrainer/pull/1)) sowie für die Erweiterung der Kabelbedienung mit Markieren, Entfernen, Umstecken und Rückgängig ([Pull Request #2](https://github.com/ManiBecker/DigiTrainer/pull/2)). Lutz hat bei seiner Entwicklung auch KI-Unterstützung eingesetzt und die Ergebnisse selbst getestet.

## 🔗 Links

- **Live-Demo:** https://manibecker.github.io/DigiTrainer/
- **GitHub-Repository:** https://github.com/ManiBecker/DigiTrainer
- **Classic-Computing-Forum:** https://forum.classic-computing.de/
