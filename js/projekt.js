// ------------------------------------------------------------
// DigiTrainer – Projekte speichern und laden (projekt.js)
//
// Ergaenzung zu simulator.js. Speichert die aktuelle Schaltung
// (alle Patchkabel, Stellungen der Schiebeschalter S0-S7, f, STOP
// und die Debug-Ansicht) als Projekt und laedt sie wieder:
// - Schnellspeicher im Browser (localStorage) mit Name, Liste,
//   Laden und Loeschen
// - Export als JSON-Datei (Download) und Import (Dateiauswahl)
// Knopf "Projekt", Dialog und CSS erzeugt diese Datei selbst.
// Einbindung in index.html NACH simulator.js:
//     <script src="js/projekt.js"></script>
//
// Verwendete Bindungen aus simulator.js (gemeinsamer globaler
// Gueltigkeitsbereich klassischer Skripte, nur lesend bzw. ueber
// die vorhandenen Funktionen):
//   hotspots, switches, switchStates, wireConnections, powerOn,
//   boardLoaded, currentWire, zoom, powerSwitch, debugToggle,
//   statusMessage, getHotspotCenter(), drawWire(), updateWirePath(),
//   createWirePlug(), checkWiringConflict(), updateWireColors(),
//   updateOutputLeds(), updateSwitchLeds(), refreshClockGenerator(),
//   cancelCurrentCable()
// Optional: control.updateDisplay() je Schiebeschalter (eine Zeile
// in createSwitchControl), damit die Schalterstellung nach dem Laden
// auch sichtbar umspringt.
//
// Dateiformat (JSON):
// {
//   "format": "digitrainer-projekt",
//   "version": 1,
//   "app": "DigiTrainer v0.63",
//   "board": "itt-digitrainer2",
//   "saved": "2026-10-28T12:00:00.000Z",
//   "wires": [ { "from": "clk-out", "to": "ctr-CKA" }, ... ],
//   "switches": { "switch0": 0, ..., "switch_clk_f": 0, "switch_clk_stop": 1 },
//   "debug": false,
//   "description": "optionaler Hinweistext"
// }
// "description" darf fehlen. Aeltere Projekte ohne dieses Feld bleiben gueltig.
//
// Beispielbibliothek: nur lesend aus Manfreds Repository, Branch main.
// Gelistet werden alle *.json in projects/. Die Beschreibung kommt aus
// dem Feld description oder, falls das fehlt, aus der gleichnamigen
// Textdatei. Beides wird nie dorthin zurueckgeschrieben. Eine eigene
// Beschreibung bleibt beim Speichern im Browser und beim JSON-Export erhalten.
// "from"/"to" sind die Buchsen-IDs aus boards/itt-digitrainer2/board.json.
//
// Lizenz: MIT, wie das DigiTrainer-Projekt (siehe LICENSE).
// ------------------------------------------------------------

(function () {
    "use strict";

    const PROJECT_FORMAT = "digitrainer-projekt";
    const PROJECT_VERSION = 1;
    const PROJECT_BOARD = "itt-digitrainer2";
    const PROJECT_STORAGE_KEY = "digitrainer.projekte";
    const PROJECT_MAX_FILE_SIZE = 1024 * 1024;

    // Ohne simulator.js ist nichts zu tun.
    if (typeof wireConnections === "undefined" || typeof drawWire !== "function") {
        console.warn("projekt.js: simulator.js nicht gefunden – Projektfunktion deaktiviert.");
        return;
    }

    function setStatus(text) {
        if (typeof statusMessage !== "undefined" && statusMessage) statusMessage.textContent = text;
    }

    // --------------------------------------------------------
    // Verdrahtung lesen und setzen (ueber simulator.js-Funktionen)
    // --------------------------------------------------------

    // Ein Kabel genauso anlegen wie beim Ziehen mit der Maus.
    function createWire(fromId, toId) {
        const a = hotspots.find(h => h.id === fromId);
        const b = hotspots.find(h => h.id === toId);
        if (!a || !b) return null;
        const start = getHotspotCenter(a);
        const end = getHotspotCenter(b);
        const path = drawWire(start.x, start.y, end.x, end.y);
        // Auch im Vermessungsmodus als normales Kabel zeichnen.
        path.setAttribute("data-measure", "false");
        path.setAttribute("stroke-width", String(3 * zoom));
        path.removeAttribute("vector-effect");
        updateWirePath(path, end.x, end.y);
        const wire = { from: fromId, to: toId, path: path };
        wireConnections.push(wire);
        wire.plugs = [createWirePlug(path, "x1", "y1"), createWirePlug(path, "x2", "y2")];
        return wire;
    }

    function removeAllWires() {
        wireConnections.splice(0).forEach(wire => {
            if (wire.path) wire.path.remove();
            if (wire.plugs) wire.plugs.forEach(plug => plug.remove());
        });
    }

    function getWiringList() {
        return wireConnections.map(wire => ({ from: wire.from, to: wire.to }));
    }

    function setWiringList(list) {
        removeAllWires();
        list.forEach(item => createWire(item.from, item.to));
    }

    function createProject() {
        const switchesState = {};
        switches.forEach(control => {
            if (control.type === "switch") {
                switchesState[control.id] = switchStates[control.id] === 1 ? 1 : 0;
            }
        });
        const project = {
            format: PROJECT_FORMAT,
            version: PROJECT_VERSION,
            app: document.title,
            board: PROJECT_BOARD,
            saved: new Date().toISOString(),
            wires: getWiringList(),
            switches: switchesState,
            debug: !!(typeof debugToggle !== "undefined" && debugToggle && debugToggle.checked)
        };
        const description = projectDescription();
        if (description) project.description = description;
        return project;
    }

    function projectDescription() {
        const field = document.getElementById("project-description");
        return field ? field.value.replace(/\r\n/g, "\n").trim() : "";
    }

    function showProjectDescription(project) {
        const field = document.getElementById("project-description");
        if (!field) return;
        field.value = project && typeof project.description === "string" ? project.description : "";
    }

    // Projektdaten pruefen. Liefert eine Fehlermeldung oder null.
    function validateProject(project) {
        if (!project || typeof project !== "object" || Array.isArray(project)) return "keine Projektdatei";
        if (project.format !== PROJECT_FORMAT) return "unbekanntes Dateiformat";
        if (typeof project.version !== "number" || !(project.version >= 1)) return "ungültige Version";
        if (project.version > PROJECT_VERSION) return "Projekt stammt aus einer neueren Version (" + project.version + ")";
        if (project.board !== undefined && project.board !== PROJECT_BOARD) return "Projekt gehört zu einem anderen Board";
        if (!Array.isArray(project.wires)) return "Kabelliste fehlt";
        const ids = new Set(hotspots.map(h => h.id));
        for (const wire of project.wires) {
            if (!wire || typeof wire.from !== "string" || typeof wire.to !== "string") return "ungültiger Kabeleintrag";
            if (!ids.has(wire.from)) return "unbekannte Buchse: " + wire.from;
            if (!ids.has(wire.to)) return "unbekannte Buchse: " + wire.to;
            if (wire.from === wire.to) return "Kabel mit gleicher Start- und Zielbuchse";
        }
        if (project.switches !== undefined &&
            (typeof project.switches !== "object" || project.switches === null || Array.isArray(project.switches))) {
            return "ungültige Schalterliste";
        }
        return null;
    }

    // Projekt uebernehmen. Das Geraet wird vorher ausgeschaltet.
    // Bei einem Verdrahtungsfehler bleibt die bisherige Schaltung erhalten.
    function applyProject(project) {
        if (!boardLoaded) return "Board noch nicht geladen";
        const error = validateProject(project);
        if (error) return error;

        if (powerOn) powerSwitch.click();
        if (currentWire !== null) cancelCurrentCable();

        // Doppelte Kabel (auch in umgekehrter Richtung) nur einmal stecken.
        const seen = new Set();
        const list = project.wires.filter(wire => {
            const key = [wire.from, wire.to].sort().join("|");
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        const previous = getWiringList();
        setWiringList(list);
        const wiringError = checkWiringConflict();
        if (wiringError) {
            setWiringList(previous);
            updateWireColors();
            updateOutputLeds();
            return wiringError;
        }

        switches.forEach(control => {
            if (control.type !== "switch") return;
            const state = project.switches ? project.switches[control.id] : undefined;
            switchStates[control.id] = state === 1 ? 1 : 0;
            if (typeof control.updateDisplay === "function") control.updateDisplay();
        });
        updateSwitchLeds();
        refreshClockGenerator();

        // Debug-Ansicht ueber die vorhandene Checkbox umschalten.
        if (typeof debugToggle !== "undefined" && debugToggle &&
            debugToggle.checked !== (project.debug === true)) {
            debugToggle.checked = project.debug === true;
            debugToggle.dispatchEvent(new Event("change"));
        }
        updateWireColors();
        updateOutputLeds();
        return null;
    }

    // --------------------------------------------------------
    // Schnellspeicher im localStorage: { name: projekt }
    // --------------------------------------------------------

    function readStoredProjects() {
        try {
            const data = JSON.parse(localStorage.getItem(PROJECT_STORAGE_KEY) || "{}");
            return data && typeof data === "object" && !Array.isArray(data) ? data : {};
        } catch (error) {
            return {};
        }
    }

    function writeStoredProjects(data) {
        try {
            localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (error) {
            projectMessage("Speichern im Browser nicht möglich: " + error.message);
            return false;
        }
    }

    // --------------------------------------------------------
    // Oberflaeche: Knopf, Dialog, CSS
    // --------------------------------------------------------

    const style = document.createElement("style");
    style.textContent = `
#project-dialog { box-sizing:border-box; width:min(560px,calc(100vw - 24px)); max-height:calc(100dvh - 24px); padding:0; border:1px solid #777; border-radius:8px; background:#242424; color:#fff; box-shadow:0 12px 50px #000b; font-family:Arial,Helvetica,sans-serif; overflow:hidden; }
#project-dialog::backdrop { background:rgba(0,0,0,.70); }
#project-dialog .project-header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 14px; background:#303030; border-bottom:1px solid #555; font-size:1rem; }
#project-dialog .project-body { padding:12px 14px; font-size:14px; max-height:calc(100dvh - 90px); overflow:auto; }
#project-dialog .project-row { display:flex; flex-wrap:wrap; gap:6px; margin:6px 0; }
#project-dialog button { background:#333; color:white; border:1px solid #777; border-radius:5px; padding:6px 11px; cursor:pointer; }
#project-dialog button:active { background:#555; }
#project-name { flex:1; min-width:150px; background:#111; color:#fff; border:1px solid #777; border-radius:5px; padding:6px 8px; }
#project-description { display:block; width:100%; box-sizing:border-box; min-height:5.6em; max-height:9em; margin:6px 0; resize:vertical; overflow:auto; background:#111; color:#fff; border:1px solid #777; border-radius:5px; padding:6px 8px; font:inherit; }
#project-list, #library-list { list-style:none; margin:8px 0; padding:0; max-height:180px; overflow:auto; border:1px solid #444; border-radius:5px; }
#project-list li, #library-list li { display:flex; align-items:center; gap:6px; padding:5px 8px; border-bottom:1px solid #333; }
#project-list li span, #library-list li span { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer; }
#project-list li.project-empty, #library-list li.project-empty { color:#aaa; cursor:default; }
#project-dialog .project-hint { color:#aaa; font-size:12px; margin:8px 0 2px; }
#project-info { min-height:1.2em; margin:4px 0 0; color:#9bd0ff; }
`;
    document.head.appendChild(style);

    const dialog = document.createElement("dialog");
    dialog.id = "project-dialog";
    dialog.setAttribute("aria-labelledby", "project-title");
    dialog.innerHTML = `
  <div class="project-header">
    <strong id="project-title">Projekt speichern / laden</strong>
    <button type="button" id="project-close" aria-label="Projektfenster schließen">✕</button>
  </div>
  <div class="project-body">
    <div class="project-row">
      <input type="text" id="project-name" placeholder="Projektname" maxlength="60">
      <button type="button" id="project-store">Im Browser speichern</button>
    </div>
    <textarea id="project-description" rows="4" maxlength="4000" placeholder="Optionale Beschreibung, auch mehrzeilig"></textarea>
    <p class="project-hint">Meine Projekte</p>
    <ul id="project-list"></ul>
    <p class="project-hint">Beispielprojekte</p>
    <ul id="library-list"></ul>
    <div class="project-row">
      <button type="button" id="project-export">Als Datei exportieren</button>
      <button type="button" id="project-import">Datei importieren …</button>
      <input type="file" id="project-file" accept=".json,application/json" hidden>
    </div>
    <p class="project-hint">Gespeichert werden alle Kabel, die Schalterstellungen (S0–S7, f, STOP) und, falls vorhanden, die Beschreibung.
    Beim Laden wird das Gerät ausgeschaltet. Browser-Projekte liegen nur in diesem Browser.</p>
    <p id="project-info" role="status"></p>
  </div>`;
    document.body.appendChild(dialog);

    const nameInput = dialog.querySelector("#project-name");
    const listElement = dialog.querySelector("#project-list");
    const fileInput = dialog.querySelector("#project-file");
    const info = dialog.querySelector("#project-info");

    function projectMessage(text) {
        info.textContent = text;
        setStatus(text);
    }

    // Knopf "Projekt" in der Werkzeugleiste, vor "Hilfe ?" falls vorhanden.
    const toolbar = document.querySelector(".toolbar");
    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "project-toggle";
    openButton.textContent = "Projekt";
    openButton.title = "Projekt speichern oder laden";
    openButton.setAttribute("aria-haspopup", "dialog");
    openButton.setAttribute("aria-controls", "project-dialog");
    if (toolbar) {
        const helpButton = toolbar.querySelector(".help-toggle");
        toolbar.insertBefore(openButton, helpButton || null);
    } else {
        console.warn("projekt.js: .toolbar nicht gefunden – Projekt-Knopf nicht eingefügt.");
    }

    function renderProjectList() {
        const data = readStoredProjects();
        const names = Object.keys(data).sort((a, b) => a.localeCompare(b, "de"));
        listElement.textContent = "";
        if (!names.length) {
            const empty = document.createElement("li");
            empty.className = "project-empty";
            empty.textContent = "Noch keine Projekte im Browser gespeichert.";
            listElement.appendChild(empty);
            return;
        }
        names.forEach(name => {
            const project = data[name];
            const item = document.createElement("li");
            const label = document.createElement("span");
            const count = project && Array.isArray(project.wires) ? project.wires.length : 0;
            label.textContent = name + " (" + count + " Kabel)";
            if (project && project.saved) {
                label.title = "Gespeichert: " + new Date(project.saved).toLocaleString("de-DE");
            }
            label.addEventListener("click", () => {
                nameInput.value = name;
                showProjectDescription(project);
            });

            const load = document.createElement("button");
            load.type = "button";
            load.textContent = "Laden";
            load.addEventListener("click", () => {
                const stored = readStoredProjects()[name];
                const error = applyProject(stored);
                if (error) {
                    projectMessage("Laden fehlgeschlagen: " + error);
                } else {
                    nameInput.value = name;
                    showProjectDescription(stored);
                    dialog.close();
                    setStatus("Projekt geladen: " + name);
                }
            });

            const remove = document.createElement("button");
            remove.type = "button";
            remove.textContent = "Löschen";
            remove.addEventListener("click", () => {
                if (!confirm("Projekt \"" + name + "\" im Browser löschen?")) return;
                const current = readStoredProjects();
                delete current[name];
                if (writeStoredProjects(current)) projectMessage("Projekt gelöscht: " + name);
                renderProjectList();
            });

            item.append(label, load, remove);
            listElement.appendChild(item);
        });
    }

    const libraryElement = dialog.querySelector("#library-list");

    const LIBRARY_API = "https://api.github.com/repos/ManiBecker/DigiTrainer/contents/projects?ref=main";
    const LIBRARY_BASE = "https://raw.githubusercontent.com/ManiBecker/DigiTrainer/main/projects/";

    function libraryFileName(file) {
        const base = decodeURIComponent(String(file).split("?")[0].split("/").pop());
        return /^[A-Za-z0-9._-]+\.json$/i.test(base) ? base : "";
    }

    function libraryTextName(file) {
        const jsonName = libraryFileName(file);
        if (!jsonName) return "";
        const textName = jsonName.replace(/\.json$/i, ".txt");
        return /^[A-Za-z0-9._-]+\.txt$/i.test(textName) ? textName : "";
    }

    function libraryTitle(file) {
        return file.replace(/\.json$/i, "");
    }

    async function listProjectFiles() {
        try {
            const response = await fetch(LIBRARY_API, {
                headers: { Accept: "application/vnd.github+json" },
                cache: "no-cache"
            });
            if (!response.ok) return null;
            const data = await response.json();
            if (!Array.isArray(data)) return null;
            return data
                .map(item => item && item.type === "file" ? libraryFileName(item.name) : "")
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b, "de"));
        } catch (error) {
            return null;
        }
    }

    async function readOptionalText(url) {
        try {
            const response = await fetch(url, { cache: "no-cache" });
            if (!response.ok) return "";
            return (await response.text()).trim();
        } catch (error) {
            return "";
        }
    }

    async function resolveLibraryDescription(file, project) {
        if (project && typeof project.description === "string" && project.description.trim()) {
            return project.description.trim();
        }
        const textName = libraryTextName(file);
        if (!textName) return "";
        return readOptionalText(LIBRARY_BASE + textName);
    }

    async function readLibraryProject(file) {
        const name = libraryFileName(file);
        if (!name) throw new Error("ungültiger Dateiname");
        const response = await fetch(LIBRARY_BASE + name, { cache: "no-cache" });
        if (!response.ok) throw new Error("Datei nicht gefunden");
        return response.json();
    }

    async function showLibraryEntry(file) {
        nameInput.value = libraryTitle(file);
        let project = null;
        try {
            project = await readLibraryProject(file);
        } catch (error) {
            project = null;
        }
        const description = await resolveLibraryDescription(file, project);
        const field = document.getElementById("project-description");
        if (field) field.value = description;
    }

    function renderLibraryMessage(text) {
        libraryElement.textContent = "";
        const empty = document.createElement("li");
        empty.className = "project-empty";
        empty.textContent = text;
        libraryElement.appendChild(empty);
    }

    async function renderLibrary() {
        const files = await listProjectFiles();
        if (!files) {
            renderLibraryMessage("Beispielschaltungen sind gerade nicht erreichbar.");
            return;
        }
        libraryElement.textContent = "";
        if (!files.length) {
            renderLibraryMessage("Keine Beispielschaltungen hinterlegt.");
            return;
        }
        files.forEach(file => {
            const title = libraryTitle(file);
            const item = document.createElement("li");
            const label = document.createElement("span");
            label.textContent = title;
            label.title = file;
            label.addEventListener("click", () => {
                showLibraryEntry(file);
            });
            const load = document.createElement("button");
            load.type = "button";
            load.textContent = "Laden";
            load.addEventListener("click", async () => {
                let project;
                try {
                    project = await readLibraryProject(file);
                } catch (error) {
                    projectMessage("Beispiel nicht geladen: " + title);
                    return;
                }
                const description = await resolveLibraryDescription(file, project);
                const error = applyProject(project);
                if (error) {
                    projectMessage("Laden fehlgeschlagen: " + error);
                    return;
                }
                nameInput.value = title;
                const field = document.getElementById("project-description");
                if (field) field.value = description;
                dialog.close();
                setStatus("Beispiel geladen: " + title);
            });
            item.append(label, load);
            libraryElement.appendChild(item);
        });
    }

    openButton.addEventListener("click", () => {
        info.textContent = "";
        renderProjectList();
        renderLibrary();
        dialog.showModal();
    });
    dialog.querySelector("#project-close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    // Tasten im Dialog nicht an die Board-Tastenkuerzel (M, +, -, 0) weitergeben.
    // Esc schliesst den Dialog trotzdem (Standardverhalten von <dialog>).
    dialog.addEventListener("keydown", event => event.stopPropagation());
    nameInput.addEventListener("keydown", event => {
        if (event.key === "Enter") dialog.querySelector("#project-store").click();
    });

    dialog.querySelector("#project-store").addEventListener("click", () => {
        const name = nameInput.value.trim();
        if (!name) {
            projectMessage("Bitte einen Projektnamen eingeben.");
            nameInput.focus();
            return;
        }
        if (!boardLoaded) {
            projectMessage("Board noch nicht geladen.");
            return;
        }
        const data = readStoredProjects();
        if (Object.prototype.hasOwnProperty.call(data, name) &&
            !confirm("Projekt \"" + name + "\" überschreiben?")) return;
        data[name] = createProject();
        if (writeStoredProjects(data)) projectMessage("Projekt im Browser gespeichert: " + name);
        renderProjectList();
    });

    // Export als JSON-Datei (Download).
    dialog.querySelector("#project-export").addEventListener("click", () => {
        const name = nameInput.value.trim() || "digitrainer-projekt";
        const blob = new Blob([JSON.stringify(createProject(), null, 2)], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = name.replace(/[\\/:*?"<>|\s]+/g, "_") + ".json";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        projectMessage("Projekt exportiert: " + link.download);
    });

    // Import aus JSON-Datei (Dateiauswahl).
    dialog.querySelector("#project-import").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
        const file = fileInput.files[0];
        fileInput.value = "";
        if (!file) return;
        if (file.size > PROJECT_MAX_FILE_SIZE) {
            projectMessage("Datei zu groß für ein DigiTrainer-Projekt.");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            let project;
            try {
                project = JSON.parse(reader.result);
            } catch (error) {
                projectMessage("Ungültige Datei (kein JSON): " + file.name);
                return;
            }
            const error = applyProject(project);
            if (error) {
                projectMessage("Import fehlgeschlagen: " + error);
            } else {
                nameInput.value = file.name.replace(/\.json$/i, "");
                showProjectDescription(project);
                dialog.close();
                setStatus("Projekt importiert: " + file.name);
            }
        };
        reader.onerror = () => projectMessage("Datei konnte nicht gelesen werden.");
        reader.readAsText(file);
    });
})();
