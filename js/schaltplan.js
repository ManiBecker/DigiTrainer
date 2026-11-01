// ------------------------------------------------------------
// DigiTrainer – Schaltplan aus der Verdrahtung (schaltplan.js)
//
// Eigene Ansicht. simulator.js bleibt unverändert.
// Der Signalfluss läuft von links nach rechts: jede Stufe
// steht eine Spalte weiter rechts. Versorgung bleibt unsichtbar.
// Ein Punkt markiert eine elektrische Verbindung. Eine Kreuzung
// ohne Punkt verbindet nicht. Echte Kreise bleiben kurze
// Rückführungen. Gatter sind standardmäßig Rechtecke nach
// IEC 60617; die Formdarstellung bleibt zuschaltbar.
// Parallele Leitungen verschiedener Signale werden auf
// mindestens 14 Pixel Abstand auseinandergezogen.
// Danach fallen Umwege weg, die nur zusätzliche Knicke wären.
// Drucken zeichnet denselben Plan hell auf weiß.
// ------------------------------------------------------------

(function () {
    "use strict";

    const SVGNS = "http://www.w3.org/2000/svg";
    const GAP = 20;
    const GUTTER = 64;
    const LANE = 16;

    // Gleiche Pin-Listen wie im Simulator, falls die Datei ohne Browser läuft.

    const FALLBACK_GATES = {
        nor: [
            { a: "ic0-pin2", b: "ic0-pin3", y: "ic0-pin1" },
            { a: "ic0-pin5", b: "ic0-pin6", y: "ic0-pin4" },
            { a: "ic0-pin11", b: "ic0-pin10", y: "ic0-pin12" },
            { a: "ic0-pin14", b: "ic0-pin13", y: "ic0-pin15" }
        ],
        not1: [
            { a: "ic1-pin1", y: "ic1-pin2" },
            { a: "ic1-pin3", y: "ic1-pin4" },
            { a: "ic1-pin5", y: "ic1-pin6" },
            { a: "ic1-pin11", y: "ic1-pin10" },
            { a: "ic1-pin13", y: "ic1-pin12" },
            { a: "ic1-pin15", y: "ic1-pin14" }
        ],
        and: [
            { a: "ic2-pin1", b: "ic2-pin2", y: "ic2-pin3" },
            { a: "ic2-pin4", b: "ic2-pin5", y: "ic2-pin6" },
            { a: "ic2-pin11", b: "ic2-pin12", y: "ic2-pin10" },
            { a: "ic2-pin14", b: "ic2-pin15", y: "ic2-pin13" }
        ],
        xor: [
            { a: "ic3-pin1", b: "ic3-pin2", y: "ic3-pin3" },
            { a: "ic3-pin4", b: "ic3-pin5", y: "ic3-pin6" },
            { a: "ic3-pin11", b: "ic3-pin12", y: "ic3-pin10" },
            { a: "ic3-pin14", b: "ic3-pin15", y: "ic3-pin13" }
        ],
        nand: [
            { a: "ic4-pin1", b: "ic4-pin2", y: "ic4-pin3" },
            { a: "ic4-pin4", b: "ic4-pin5", y: "ic4-pin6" },
            { a: "ic4-pin11", b: "ic4-pin12", y: "ic4-pin10" },
            { a: "ic4-pin14", b: "ic4-pin15", y: "ic4-pin13" }
        ],
        not5: [
            { a: "ic5-pin1", y: "ic5-pin2" },
            { a: "ic5-pin3", y: "ic5-pin4" },
            { a: "ic5-pin5", y: "ic5-pin6" },
            { a: "ic5-pin15", y: "ic5-pin14" },
            { a: "ic5-pin17", y: "ic5-pin16" },
            { a: "ic5-pin19", y: "ic5-pin18" }
        ]
    };

    function lexical(value, fallback) {
        return typeof value !== "undefined" ? value : fallback;
    }

    function hotspotOf(id) {
        const list = lexical(typeof hotspots !== "undefined" ? hotspots : undefined, null);
        if (!list) return null;
        return list.find(item => item.id === id) || null;
    }

    function shortPin(id) {
        const spot = hotspotOf(id);
        if (spot && spot.label) return spot.label.replace(/^.*\s/, "");
        const parts = id.split("-");
        return parts[parts.length - 1];
    }

    // CLK und CLK̄ haben feste Kurznamen, sonst das Buchsen-Etikett.
    function termTitle(id, fallback) {
        if (id === "clk-out") return "CLK";
        if (id === "clk-out-not") return "CLK̄";
        const spot = hotspotOf(id);
        if (spot && spot.label) return spot.label;
        return fallback;
    }

    function makePin(id, role, name) {
        return { id: id, role: role, name: name };
    }

    // Gattertabellen des Simulators, sonst die Ersatzliste.
    function liveBinding(name) {
        if (name === "nor") return typeof norGatesIC0 !== "undefined" ? norGatesIC0 : undefined;
        if (name === "not1") return typeof notGatesIC1 !== "undefined" ? notGatesIC1 : undefined;
        if (name === "and") return typeof andGatesIC2 !== "undefined" ? andGatesIC2 : undefined;
        if (name === "xor") return typeof xorGatesIC3 !== "undefined" ? xorGatesIC3 : undefined;
        if (name === "nand") return typeof nandGatesIC4 !== "undefined" ? nandGatesIC4 : undefined;
        if (name === "not5") return typeof notGatesIC5 !== "undefined" ? notGatesIC5 : undefined;
        return undefined;
    }

    function catalog() {
        const symbols = [];
        const titles = { nor: "NOR", not: "NOT", and: "UND", xor: "XOR", nand: "NAND" };
        function addGates(gates, kind, ic) {
            (gates || []).forEach((gate, index) => {
                const pins = [makePin(gate.a, "in", "A")];
                if (gate.b) pins.push(makePin(gate.b, "in", "B"));
                pins.push(makePin(gate.y, "out", "Y"));
                symbols.push({
                    id: ic + "-" + kind + index,
                    kind: kind,
                    title: titles[kind],
                    prefer: index,
                    pins: pins
                });
            });
        }
        addGates(liveBinding("nor") || FALLBACK_GATES.nor, "nor", "ic0");
        addGates(liveBinding("not1") || FALLBACK_GATES.not1, "not", "ic1");
        addGates(liveBinding("and") || FALLBACK_GATES.and, "and", "ic2");
        addGates(liveBinding("xor") || FALLBACK_GATES.xor, "xor", "ic3");
        addGates(liveBinding("nand") || FALLBACK_GATES.nand, "nand", "ic4");
        addGates(liveBinding("not5") || FALLBACK_GATES.not5, "not", "ic5");

        symbols.push(block("ctr", "Zähler", [
            ["ctr-CKA", "in"], ["ctr-CKB", "in"], ["ctr-RO0", "in"], ["ctr-RO1", "in"],
            ["ctr-QA", "out"], ["ctr-QB", "out"], ["ctr-QC", "out"], ["ctr-QD", "out"]
        ], 10));
        symbols.push(block("alu", "ALU", [
            ["alu-S0", "in"], ["alu-S1", "in"], ["alu-S2", "in"], ["alu-Cn", "in"],
            ["alu-A0", "in"], ["alu-A1", "in"], ["alu-A2", "in"], ["alu-A3", "in"],
            ["alu-B0", "in"], ["alu-B1", "in"], ["alu-B2", "in"], ["alu-B3", "in"],
            ["alu-F0", "out"], ["alu-F1", "out"], ["alu-F2", "out"], ["alu-F3", "out"],
            ["alu-OVR", "out"], ["alu-Cn4", "out"]
        ], 20));
        symbols.push(block("adc", "ADC", [
            ["adc-I'", "in"], ["adc-I", "in"], ["adc-clk", "in"], ["adc-st", "in"], ["adc-oe", "in"],
            ["adc-EOC", "out"],
            ["adc-Q0", "out"], ["adc-Q1", "out"], ["adc-Q2", "out"], ["adc-Q3", "out"], ["adc-Q4", "out"], ["adc-Q5", "out"]
        ], 30));
        symbols.push(block("b7s", "Anzeige", [
            ["b7s-1", "in"], ["b7s-2", "in"], ["b7s-4", "in"], ["b7s-8", "in"], ["b7s-E", "in"]
        ], 40));

        const controls = typeof switches !== "undefined" && switches.length
            ? switches
            : [0, 1, 2, 3, 4, 5, 6, 7].map(index => ({ type: "switch", output: "S" + index }));
        controls.forEach(control => {
            if (control.type !== "switch" || !control.output) return;
            const number = Number(String(control.output).replace(/\D/g, ""));
            symbols.push({
                id: "sw-" + control.output,
                kind: "term",
                title: termTitle(control.output, "S " + (Number.isFinite(number) ? number : control.output)),
                prefer: Number.isFinite(number) ? number : 0,
                pins: [
                    makePin(control.output, "out", "Q"),
                    makePin(control.output + "_NOT", "out", "Q̄")
                ]
            });
        });
        [
            ["clk-out", "CLK", -2],
            ["clk-out-not", "CLK̄", -1]
        ].forEach(entry => {
            symbols.push({
                id: "clk-" + entry[0],
                kind: "term",
                title: entry[1],
                prefer: entry[2],
                pins: [makePin(entry[0], "out", "Q")]
            });
        });
        for (let index = 0; index < 8; index++) {
            const id = "D" + index;
            symbols.push({
                id: "led-" + id,
                kind: "term",
                title: termTitle(id, "D " + index),
                prefer: index,
                pins: [makePin(id, "in", "")]
            });
        }
        return symbols;
    }

    function block(id, title, pins, prefer) {
        return {
            id: id,
            kind: "block",
            title: title,
            prefer: prefer,
            pins: pins.map(pair => makePin(pair[0], pair[1], shortPin(pair[0])))
        };
    }

    function isSupply(id) {
        return /^vcc\d+$/.test(id) || /^gnd\d+$/.test(id);
    }

    // Versorgung entfällt. Die vier Buchsen einer Leiste l0…l4 sind ein Netz.
    function netsFromWires(wires) {
        const parent = new Map();
        function root(id) {
            if (!parent.has(id)) parent.set(id, id);
            let cursor = id;
            while (parent.get(cursor) !== cursor) cursor = parent.get(cursor);
            let again = id;
            while (parent.get(again) !== cursor) {
                const next = parent.get(again);
                parent.set(again, cursor);
                again = next;
            }
            return cursor;
        }
        function join(a, b) {
            const ra = root(a);
            const rb = root(b);
            if (ra !== rb) parent.set(ra, rb);
        }
        (wires || []).forEach(wire => join(wire.from, wire.to));
        for (let rail = 0; rail <= 4; rail++) {
            for (let socket = 2; socket <= 4; socket++) join("l" + rail + "_1", "l" + rail + "_" + socket);
        }
        const groups = new Map();
        parent.forEach((value, id) => {
            const key = root(id);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(id);
        });
        const nets = [];
        groups.forEach(ids => {
            if (ids.some(isSupply)) return;
            if (ids.length < 2) return;
            nets.push(ids);
        });
        return nets;
    }

    function usedSymbols(nets) {
        const active = new Set();
        nets.forEach(ids => ids.forEach(id => active.add(id)));
        return catalog().map(symbol => {
            const pins = symbol.pins.filter(pin => active.has(pin.id));
            return Object.assign({}, symbol, { pins: pins });
        }).filter(symbol => symbol.pins.length);
    }

    function sizeOf(symbol) {
        const inputs = symbol.pins.filter(pin => pin.role === "in").length;
        const outputs = symbol.pins.filter(pin => pin.role === "out").length;
        const rows = Math.max(inputs, outputs, 1);
        if (symbol.kind === "block") {
            return { w: Math.max(86, symbol.title.length * 8 + 28), h: Math.max(40, 16 * rows + 22) };
        }
        if (symbol.kind === "term") {
            return { w: Math.max(52, symbol.title.length * 8 + 20), h: rows > 1 ? 40 : 28 };
        }
        return { w: 74, h: Math.max(42, 16 * rows + 14) };
    }

    // Je Eingang eine Kante, immer vom ersten Ausgang des Netzes. local: Ausgang und Eingang am selben Symbol.
    function buildEdges(symbols, nets) {
        const owner = new Map();
        symbols.forEach(symbol => symbol.pins.forEach(pin => owner.set(pin.id, { symbol: symbol, pin: pin })));
        const edges = [];
        nets.forEach((ids, netIndex) => {
            const items = ids.map(id => owner.get(id)).filter(Boolean);
            const outs = items.filter(item => item.pin.role === "out");
            const ins = items.filter(item => item.pin.role === "in");
            if (!outs.length || !ins.length) return;
            ins.forEach(target => {
                edges.push({
                    net: netIndex,
                    from: outs[0].symbol.id,
                    to: target.symbol.id,
                    source: outs[0],
                    target: target,
                    local: outs[0].symbol === target.symbol
                });
            });
        });
        return edges;
    }

    // Rückkanten per Tiefensuche. Die Spalte ist der längste Weg im übrigen Graphen.
    function assignLayers(symbols, edges) {
        const adj = new Map();
        symbols.forEach(symbol => adj.set(symbol.id, []));
        edges.forEach(edge => {
            if (!edge.local) adj.get(edge.from).push(edge);
        });
        const state = new Map();
        function visit(id) {
            state.set(id, 1);
            (adj.get(id) || []).forEach(edge => {
                const next = state.get(edge.to) || 0;
                if (next === 1) edge.back = true;
                else if (next === 0) visit(edge.to);
            });
            state.set(id, 2);
        }
        symbols.forEach(symbol => {
            if (!state.get(symbol.id)) visit(symbol.id);
        });
        const forward = edges.filter(edge => !edge.local && !edge.back);
        const indegree = new Map(symbols.map(symbol => [symbol.id, 0]));
        forward.forEach(edge => indegree.set(edge.to, indegree.get(edge.to) + 1));
        const layer = new Map(symbols.map(symbol => [symbol.id, 0]));
        const queue = symbols.filter(symbol => indegree.get(symbol.id) === 0);
        while (queue.length) {
            const current = queue.shift();
            forward.forEach(edge => {
                if (edge.from !== current.id) return;
                layer.set(edge.to, Math.max(layer.get(edge.to), layer.get(current.id) + 1));
                indegree.set(edge.to, indegree.get(edge.to) - 1);
                if (indegree.get(edge.to) === 0) {
                    const next = symbols.find(symbol => symbol.id === edge.to);
                    if (next) queue.push(next);
                }
            });
        }
        symbols.forEach(symbol => { symbol.layer = layer.get(symbol.id) || 0; });
        edges.forEach(edge => {
            if (edge.local) return;
            const from = layer.get(edge.from) || 0;
            const to = layer.get(edge.to) || 0;
            if (to <= from) edge.back = true;
        });
    }

    // Senkrechte Ordnung nach dem Schwerpunkt der Nachbarn, damit weniger Kanten kreuzen.
    function orderLayers(symbols, edges) {
        const layers = new Map();
        symbols.forEach(symbol => {
            if (!layers.has(symbol.layer)) layers.set(symbol.layer, []);
            layers.get(symbol.layer).push(symbol);
        });
        const keys = [...layers.keys()].sort((a, b) => a - b);
        const index = new Map();
        function reindex() {
            keys.forEach(key => {
                layers.get(key).forEach((symbol, position) => index.set(symbol.id, position));
            });
        }
        keys.forEach(key => {
            layers.get(key).sort((a, b) => a.prefer - b.prefer || a.title.localeCompare(b.title, "de"));
        });
        reindex();
        const preds = new Map(symbols.map(symbol => [symbol.id, []]));
        const succs = new Map(symbols.map(symbol => [symbol.id, []]));
        edges.forEach(edge => {
            if (edge.local || edge.back) return;
            preds.get(edge.to).push(edge.from);
            succs.get(edge.from).push(edge.to);
        });
        function bary(ids, fallback) {
            if (!ids.length) return fallback;
            const values = ids.map(id => index.get(id)).filter(value => value !== undefined).sort((a, b) => a - b);
            if (!values.length) return fallback;
            return values[Math.floor((values.length - 1) / 2)];
        }
        for (let sweep = 0; sweep < 5; sweep++) {
            keys.forEach(key => {
                if (key === keys[0]) return;
                const members = layers.get(key);
                members.forEach(symbol => { symbol.key = bary(preds.get(symbol.id), index.get(symbol.id)); });
                members.sort((a, b) => a.key - b.key || a.prefer - b.prefer);
                reindex();
            });
            for (let cursor = keys.length - 2; cursor >= 0; cursor--) {
                const members = layers.get(keys[cursor]);
                members.forEach(symbol => { symbol.key = bary(succs.get(symbol.id), index.get(symbol.id)); });
                members.sort((a, b) => a.key - b.key || a.prefer - b.prefer);
                reindex();
            }
        }
        return keys.map(key => layers.get(key));
    }

    // Weite Sprünge und Rückführungen laufen neben der Spalte, nicht durch den Kanal.
    function outerTravel(edge) {
        return !edge.local && (edge.back || isFar(edge));
    }

    function countOuter(edges) {
        const rise = new Map();
        const fall = new Map();
        const symbols = new Set();
        edges.forEach(edge => {
            symbols.add(edge.source.symbol);
            symbols.add(edge.target.symbol);
            if (!outerTravel(edge)) return;
            const sourceLayer = edge.source.symbol.layer;
            const targetLayer = edge.target.symbol.layer;
            if (!rise.has(sourceLayer)) rise.set(sourceLayer, []);
            if (!fall.has(targetLayer)) fall.set(targetLayer, []);
            rise.get(sourceLayer).push(edge);
            fall.get(targetLayer).push(edge);
        });
        symbols.forEach(symbol => {
            symbol.riseCount = (rise.get(symbol.layer) || []).length;
            symbol.fallCount = (fall.get(symbol.layer) || []).length;
        });
    }

    function orderOuter(edges) {
        const rise = new Map();
        const fall = new Map();
        edges.forEach(edge => {
            if (!outerTravel(edge)) return;
            const sourceLayer = edge.source.symbol.layer;
            const targetLayer = edge.target.symbol.layer;
            if (!rise.has(sourceLayer)) rise.set(sourceLayer, []);
            if (!fall.has(targetLayer)) fall.set(targetLayer, []);
            rise.get(sourceLayer).push(edge);
            fall.get(targetLayer).push(edge);
        });
        rise.forEach(list => {
            list.sort((a, b) => a.source.pin.ay - b.source.pin.ay || a.target.pin.ay - b.target.pin.ay);
            list.forEach((edge, index) => { edge.rise = index; });
        });
        fall.forEach(list => {
            list.sort((a, b) => a.target.pin.ay - b.target.pin.ay || a.source.pin.ay - b.source.pin.ay);
            list.forEach((edge, index) => { edge.fall = index; });
        });
    }

    // Ohne Bus wird der Kanal so breit, dass jede Außenleitung eine eigene Spur hat.
    function channelAfter(layer, edges, bus) {
        if (bus) return GUTTER;
        const adjacent = edges.filter(edge => !edge.local && !edge.back && !isFar(edge) &&
            edge.source.symbol.layer === layer && edge.target.symbol.layer === layer + 1).length;
        const rise = edges.reduce((count, edge) => count + (outerTravel(edge) && edge.source.symbol.layer === layer ? 1 : 0), 0);
        const fall = edges.reduce((count, edge) => count + (outerTravel(edge) && edge.target.symbol.layer === layer + 1 ? 1 : 0), 0);
        const riseBand = rise > 0 ? 20 + rise * LANE : 14;
        const fallBand = fall > 0 ? 20 + fall * LANE : 14;
        const midBand = adjacent > 0 ? 28 + adjacent * 18 : 0;
        return Math.max(96, riseBand + fallBand + midBand);
    }

    function place(columns, edges, bus) {
        // Symbole mit lokalem Kreis brauchen oben Luft für die kurze Schleife.
        const loopers = new Set(edges.filter(edge => edge.local).map(edge => edge.from));
        const top = 18;
        let cursor = 16;
        columns.forEach((members, index) => {
            const width = Math.max(...members.map(symbol => sizeOf(symbol).w));
            let y = top;
            members.forEach(symbol => {
                const size = sizeOf(symbol);
                if (loopers.has(symbol.id)) y += 18;
                symbol.x = cursor + width / 2;
                symbol.y = y + size.h / 2;
                symbol.colLeft = cursor;
                symbol.colRight = cursor + width;
                y += size.h + GAP;
            });
            const gap = index < columns.length - 1 ? channelAfter(members[0].layer, edges, bus) : 0;
            cursor += width + gap;
        });
        const neighbors = new Map(columns.flat().map(symbol => [symbol.id, []]));
        edges.forEach(edge => {
            if (edge.local || edge.back) return;
            neighbors.get(edge.from).push(edge.target);
            neighbors.get(edge.to).push(edge.source);
        });
        for (let pass = 0; pass < 6; pass++) {
            const desired = new Map();
            columns.flat().forEach(symbol => {
                const mates = neighbors.get(symbol.id);
                if (!mates.length) {
                    desired.set(symbol.id, symbol.y);
                    return;
                }
                const values = mates.map(mate => pinAnchor(mate.symbol, mate.pin)).sort((a, b) => a - b);
                const mid = values[Math.floor((values.length - 1) / 2)];
                desired.set(symbol.id, symbol.y * 0.35 + mid * 0.65);
            });
            columns.forEach(members => {
                members.sort((a, b) => desired.get(a.id) - desired.get(b.id) || a.prefer - b.prefer);
                const sizes = members.map(sizeOf);
                const extras = members.map(symbol => loopers.has(symbol.id) ? 18 : 0);
                const total = sizes.reduce((sum, size) => sum + size.h, 0) +
                    GAP * Math.max(0, members.length - 1) +
                    extras.reduce((sum, extra) => sum + extra, 0);
                const center = members.reduce((sum, symbol) => sum + desired.get(symbol.id), 0) / members.length;
                let y = Math.max(top, center - total / 2);
                members.forEach((symbol, index) => {
                    y += extras[index];
                    symbol.y = y + sizes[index].h / 2;
                    y += sizes[index].h + GAP;
                });
            });
        }
        clusterFanouts(columns, edges);
        const bottom = Math.max(...columns.flat().map(symbol => symbol.y + sizeOf(symbol).h / 2), top + 20);
        return {
            width: Math.max(160, cursor + 16),
            height: Math.ceil(bottom + 16)
        };
    }

    // Ziele desselben Potentials stehen beieinander, damit der Abzweig kurz bleibt.
    // Gewählt wird das speziellste Eingangsnetz, nicht die Sammelleitung an alle Gatter.
    function clusterFanouts(columns, edges) {
        const loopers = new Set(edges.filter(edge => edge.local).map(edge => edge.from));
        const forward = edges.filter(edge => !edge.local && !edge.back);
        function repack(members) {
            let y = Math.min.apply(null, members.map(symbol => symbol.y - sizeOf(symbol).h / 2));
            members.forEach(symbol => {
                const size = sizeOf(symbol);
                if (loopers.has(symbol.id)) y += 18;
                symbol.y = y + size.h / 2;
                y += size.h + GAP;
            });
        }
        for (let layer = 1; layer < columns.length; layer++) {
            const members = columns[layer];
            const byNet = new Map();
            forward.forEach(edge => {
                if (edge.target.symbol.layer !== layer) return;
                if (!byNet.has(edge.net)) byNet.set(edge.net, []);
                const list = byNet.get(edge.net);
                if (list.indexOf(edge.target.symbol) < 0) list.push(edge.target.symbol);
            });
            const choice = new Map();
            members.forEach(symbol => {
                let best = null;
                let bestSize = Infinity;
                byNet.forEach((list, net) => {
                    if (list.indexOf(symbol) < 0) return;
                    if (list.length < bestSize) {
                        best = net;
                        bestSize = list.length;
                    }
                });
                choice.set(symbol, best);
            });
            const clusters = new Map();
            members.forEach(symbol => {
                const net = choice.get(symbol);
                const key = net === null ? "solo:" + symbol.id : net;
                if (!clusters.has(key)) clusters.set(key, []);
                clusters.get(key).push(symbol);
            });
            function outgoing(symbol) {
                const ys = forward.filter(edge => edge.source.symbol === symbol).map(edge => edge.target.symbol.y);
                if (!ys.length) return symbol.y;
                ys.sort((a, b) => a - b);
                return ys[Math.floor((ys.length - 1) / 2)];
            }
            clusters.forEach(list => list.sort((a, b) => outgoing(a) - outgoing(b) || a.y - b.y));
            const blocks = [];
            clusters.forEach((list, key) => {
                const net = String(key).indexOf("solo:") === 0 ? null : key;
                const sources = net === null ? [] : forward.filter(edge => edge.net === net && edge.target.symbol.layer === layer);
                const ys = sources.map(edge => edge.source.symbol.y).sort((a, b) => a - b);
                const anchor = ys.length ? ys[Math.floor((ys.length - 1) / 2)] : list[0].y;
                blocks.push({ anchor: anchor, list: list });
            });
            blocks.sort((a, b) => a.anchor - b.anchor || a.list[0].y - b.list[0].y);
            const ordered = [];
            blocks.forEach(block => block.list.forEach(symbol => ordered.push(symbol)));
            if (ordered.length !== members.length) continue;
            ordered.forEach((symbol, index) => { members[index] = symbol; });
            repack(members);
        }
    }

    // Die Form-XOR-Leitung trifft die äußere Kurve, nicht das Rechteck dahinter.
    function xorFront(y, h) {
        const y0 = h * 0.16;
        const y1 = h * 0.84;
        const cy = h / 2;
        let bestT = 0.5;
        let best = Infinity;
        for (let step = 0; step <= 40; step++) {
            const t = step / 40;
            const yy = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
            const error = Math.abs(yy - y);
            if (error < best) {
                best = error;
                bestT = t;
            }
        }
        return 2 * (1 - bestT) * bestT * 7;
    }

    function pinAnchor(symbol, pin) {
        const size = sizeOf(symbol);
        const same = symbol.pins.filter(item => item.role === pin.role);
        const index = Math.max(0, same.indexOf(pin));
        return symbol.y - size.h / 2 + size.h * (index + 1) / (same.length + 1);
    }

    function layoutPins(symbol, iec) {
        const size = sizeOf(symbol);
        const box = { x: symbol.x - size.w / 2, y: symbol.y - size.h / 2, w: size.w, h: size.h };
        symbol.box = box;
        const inputs = symbol.pins.filter(pin => pin.role === "in");
        const outputs = symbol.pins.filter(pin => pin.role === "out");
        if (symbol.kind !== "block" && symbol.kind !== "term") {
            const outline = gateOutline(symbol.kind, box.w, box.h, iec);
            inputs.forEach((pin, index) => {
                const localY = outline.y0 + (outline.y1 - outline.y0) * (index + 1) / (inputs.length + 1);
                pin.ay = box.y + localY;
                pin.ax = box.x + (outline.iec || symbol.kind !== "xor" ? outline.inX : xorFront(localY, box.h));
            });
            outputs.forEach(pin => {
                pin.ax = box.x + outline.outX;
                pin.ay = box.y + outline.outY;
            });
            return;
        }
        inputs.forEach((pin, index) => {
            pin.ax = box.x;
            pin.ay = box.y + box.h * (index + 1) / (inputs.length + 1);
        });
        outputs.forEach((pin, index) => {
            pin.ax = box.x + box.w;
            pin.ay = box.y + box.h * (index + 1) / (outputs.length + 1);
        });
    }

    // IEC 60617: & UND, ≥1 ODER, =1 Antivalenz, 1 Nicht. Kreis am Ausgang negiert.
    function iecMark(kind) {
        if (kind === "and" || kind === "nand") return "&";
        if (kind === "xor") return "=1";
        if (kind === "nor") return "≥1";
        return "1";
    }

    function gateOutline(kind, w, h, iec) {
        const bubble = kind === "not" || kind === "nor" || kind === "nand";
        const radius = 4.5;
        const cy = h / 2;
        if (iec) {
            const bodyRight = bubble ? w - 2 * radius : w;
            return {
                body: "M 0 0 H " + num(bodyRight) + " V " + num(h) + " H 0 Z",
                bubble: bubble ? { cx: w - radius, cy: cy, r: radius } : null,
                xor: null,
                inX: 0,
                outX: w,
                outY: cy,
                y0: 0,
                y1: h,
                iec: true,
                mark: iecMark(kind)
            };
        }
        const y0 = h * 0.16;
        const y1 = h * 0.84;
        const tip = bubble ? w - 2 * radius : w;
        const back = kind === "xor" ? 7 : 0;
        let body;
        if (kind === "not") {
            body = "M 0 " + num(y0) + " L " + num(tip) + " " + num(cy) + " L 0 " + num(y1) + " Z";
        } else if (kind === "and" || kind === "nand") {
            const arc = (y1 - y0) / 2;
            const center = tip - arc;
            body = "M 0 " + num(y0) + " H " + num(center) + " A " + num(arc) + " " + num(arc) +
                " 0 0 1 " + num(center) + " " + num(y1) + " H 0 Z";
        } else {
            const belly = back + (tip - back) * 0.42;
            body = "M " + num(back) + " " + num(y0) +
                " Q " + num(tip) + " " + num(y0) + " " + num(tip) + " " + num(cy) +
                " Q " + num(tip) + " " + num(y1) + " " + num(back) + " " + num(y1) +
                " Q " + num(belly) + " " + num(cy) + " " + num(back) + " " + num(y0);
        }
        return {
            body: body,
            bubble: bubble ? { cx: w - radius, cy: cy, r: radius } : null,
            xor: kind === "xor" ? "M 0 " + num(y0) + " Q " + num(back) + " " + num(cy) + " 0 " + num(y1) : null,
            inX: back,
            outX: w,
            outY: cy,
            y0: y0,
            y1: y1
        };
    }

    // Mehr als eine Spalte weit: oben oder unten entlang, nicht quer durch die Symbole.
    function isFar(edge) {
        return edge.target.symbol.layer > edge.source.symbol.layer + 1;
    }

    function groupForward(edges) {
        const groups = new Map();
        edges.filter(edge => !edge.local && !edge.back).forEach(edge => {
            const key = edge.source.symbol.layer + ">" + edge.target.symbol.layer;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(edge);
        });
        return [...groups.values()];
    }

    function bundlesOf(group) {
        const nets = new Map();
        group.forEach(edge => {
            if (!nets.has(edge.net)) nets.set(edge.net, []);
            nets.get(edge.net).push(edge);
        });
        return [...nets.values()];
    }

    function bandPlan(edges, symbols, bus) {
        const mid = columnMid(symbols);
        let top = 0;
        let bottom = 0;
        function add(items, lanes) {
            if (goesBottom(items, mid)) bottom += lanes;
            else top += lanes;
        }
        edges.filter(edge => edge.back && !edge.local).forEach(edge => add([edge], 1));
        groupForward(edges).forEach(group => {
            if (!isFar(group[0])) return;
            const bundles = bundlesOf(group);
            const lanes = bus && bundles.length >= 3 && sameOrder(bundles) ? 1 : bundles.length;
            add(group, lanes);
        });
        return { top: top, bottom: bottom };
    }

    function columnMid(symbols) {
        const values = symbols.map(symbol => symbol.y).sort((a, b) => a - b);
        return values[Math.floor((values.length - 1) / 2)];
    }

    function goesBottom(edges, mid) {
        let sum = 0;
        let count = 0;
        edges.forEach(edge => {
            sum += edge.source.pin.ay + edge.target.pin.ay;
            count += 2;
        });
        return count > 0 && sum / count > mid;
    }

    function routeForward(edges, lanes, mid, bus) {
        const lines = [];
        const labels = [];
        groupForward(edges).forEach(group => {
            const bundles = bundlesOf(group);
            const far = isFar(group[0]);
            const take = () => goesBottom(group, mid) ? lanes.takeBottom() : lanes.takeTop();
            if (bus && bundles.length >= 3 && sameOrder(bundles) && (far || spanOf(group) >= 28)) {
                drawBus(bundles, lines, labels, far ? take() : null);
            } else {
                const ordered = far
                    ? bundles.slice().sort((a, b) => a[0].source.pin.ay - b[0].source.pin.ay)
                    : arrangeBundles(bundles);
                ordered.forEach((bundle, index) => {
                    if (far && bundle.length > 1) drawFarTree(bundle, take(), lines);
                    else if (far) drawOrtho(bundle[0], 0, 1, lines, take());
                    else if (bundle.length > 1) drawTree(bundle, index, ordered.length, lines);
                    else bundle.forEach(edge => drawOrtho(edge, index, ordered.length, lines, null));
                });
            }
        });
        return { lines: lines, labels: labels };
    }

    // Spurreihenfolge im Kanal so wählen, dass sich die Abzweige möglichst wenig kreuzen.
    function arrangeBundles(bundles) {
        if (bundles.length < 2) return bundles.slice();
        const bySource = bundles.slice().sort((a, b) => a[0].source.pin.ay - b[0].source.pin.ay);
        let best = bySource;
        let bestScore = bundleCrossings(bySource);
        const items = bySource.slice();
        function consider() {
            const score = bundleCrossings(items);
            if (score < bestScore) {
                bestScore = score;
                best = items.slice();
            }
        }
        if (items.length <= 6) {
            function walk(start) {
                if (start === items.length) {
                    consider();
                    return;
                }
                for (let index = start; index < items.length; index++) {
                    const held = items[start];
                    items[start] = items[index];
                    items[index] = held;
                    walk(start + 1);
                    items[index] = items[start];
                    items[start] = held;
                }
            }
            walk(0);
            return best;
        }
        let guard = 0;
        let improved = true;
        while (improved && guard < 12) {
            improved = false;
            guard += 1;
            for (let index = 0; index < items.length - 1; index++) {
                const held = items[index];
                items[index] = items[index + 1];
                items[index + 1] = held;
                const score = bundleCrossings(items);
                if (score < bestScore) {
                    bestScore = score;
                    best = items.slice();
                    improved = true;
                } else {
                    items[index + 1] = items[index];
                    items[index] = held;
                }
            }
        }
        return best;
    }

    function bundleCrossings(bundles) {
        const segments = [];
        bundles.forEach((bundle, index) => {
            const slot = channelSlot(bundle[0], index, bundles.length);
            const source = bundle[0].source.pin;
            const net = bundle[0].net;
            const ys = [source.ay].concat(bundle.map(edge => edge.target.pin.ay));
            segments.push({
                net: net,
                horizontal: true,
                y: source.ay,
                x0: Math.min(source.ax, slot),
                x1: Math.max(source.ax, slot)
            });
            const low = Math.min.apply(null, ys);
            const high = Math.max.apply(null, ys);
            if (high - low > 0.8) {
                segments.push({ net: net, horizontal: false, x: slot, y0: low, y1: high });
            }
            bundle.forEach(edge => {
                const target = edge.target.pin;
                segments.push({
                    net: net,
                    horizontal: true,
                    y: target.ay,
                    x0: Math.min(slot, target.ax),
                    x1: Math.max(slot, target.ax)
                });
            });
        });
        let count = 0;
        for (let i = 0; i < segments.length; i++) {
            for (let j = i + 1; j < segments.length; j++) {
                const left = segments[i];
                const right = segments[j];
                if (left.net === right.net) continue;
                const horizontal = left.horizontal ? left : right.horizontal ? right : null;
                const vertical = horizontal === left ? right : horizontal === right ? left : null;
                if (!horizontal || !vertical || vertical.horizontal) continue;
                if (vertical.x > horizontal.x0 + 1 && vertical.x < horizontal.x1 - 1 &&
                    horizontal.y > vertical.y0 + 1 && horizontal.y < vertical.y1 - 1) count += 1;
            }
        }
        return count;
    }

    function sameOrder(bundles) {
        const left = bundles.slice().sort((a, b) => a[0].source.pin.ay - b[0].source.pin.ay);
        const right = bundles.slice().sort((a, b) => medianY(a) - medianY(b));
        return left.every((bundle, index) => bundle === right[index]);
    }

    function medianY(bundle) {
        const values = bundle.map(edge => edge.target.pin.ay).sort((a, b) => a - b);
        return values[Math.floor((values.length - 1) / 2)];
    }

    function spanOf(group) {
        const left = Math.max(...group.map(edge => edge.source.symbol.colRight));
        const right = Math.min(...group.map(edge => edge.target.symbol.colLeft));
        return right - left;
    }

    function addLine(lines, points, net, join) {
        lines.push({ points: points, net: net, join: join !== false });
    }

    function drawBus(bundles, lines, labels, laneY) {
        const ordered = bundles.slice().sort((a, b) => a[0].source.pin.ay - b[0].source.pin.ay);
        const left = Math.max(...ordered.map(bundle => bundle[0].source.symbol.colRight)) + 12;
        const right = Math.min(...ordered.flat().map(edge => edge.target.symbol.colLeft)) - 12;
        const spine = ordered.reduce((sum, bundle) => sum + bundle[0].source.pin.ay, 0) / ordered.length;
        const spineY = laneY === null || laneY === undefined ? spine : laneY;
        ordered.forEach(bundle => {
            const source = bundle[0].source.pin;
            addLine(lines, [
                { x: source.ax, y: source.ay },
                { x: left, y: source.ay },
                { x: left, y: spineY }
            ], bundle[0].net, false);
            bundle.forEach(edge => {
                addLine(lines, [
                    { x: right, y: spineY },
                    { x: right, y: edge.target.pin.ay },
                    { x: edge.target.pin.ax, y: edge.target.pin.ay }
                ], edge.net, false);
            });
        });
        addLine(lines, [
            { x: left, y: spineY },
            { x: (left + right) / 2 - 10, y: spineY }
        ], "bus", false);
        addLine(lines, [
            { x: (left + right) / 2 + 10, y: spineY },
            { x: right, y: spineY }
        ], "bus", false);
        labels.push({ x: (left + right) / 2, y: spineY - 4, text: String(ordered.length) });
    }

    function channelSlot(edge, index, lanes) {
        const riseCount = edge.source.symbol.riseCount || 0;
        const fallCount = edge.target.symbol.fallCount || 0;
        const left = edge.source.symbol.colRight + (riseCount > 0 ? 20 + riseCount * LANE : 14);
        const right = edge.target.symbol.colLeft - (fallCount > 0 ? 20 + fallCount * LANE : 14);
        const span = right - left;
        if (span < 16) {
            const gutterLeft = edge.source.symbol.colRight + 14;
            const gutterRight = edge.target.symbol.colLeft - 14;
            if (lanes <= 1) return (gutterLeft + gutterRight) / 2;
            return gutterLeft + (gutterRight - gutterLeft) * (index + 1) / (lanes + 1);
        }
        if (lanes <= 1) return (left + right) / 2;
        return left + span * (index + 1) / (lanes + 1);
    }

    // Ein Potential, mehrere ferne Ziele: eine Stammleitung, Abzweig erst an der Zielspalte.
    function drawFarTree(bundle, laneY, lines) {
        const source = bundle[0].source.pin;
        const rise = Math.min.apply(null, bundle.map(edge => edge.rise || 0));
        const left = bundle[0].source.symbol.colRight + 16 + rise * LANE;
        const closest = Math.max.apply(null, bundle.map(edge => edge.target.symbol.colLeft - 16 - (edge.fall || 0) * LANE));
        const trunk = Math.max(left, closest);
        const net = bundle[0].net;
        let farY = laneY;
        bundle.forEach(edge => {
            if (Math.abs(edge.target.pin.ay - laneY) > Math.abs(farY - laneY)) farY = edge.target.pin.ay;
        });
        const spine = [
            { x: source.ax, y: source.ay },
            { x: left, y: source.ay },
            { x: left, y: laneY },
            { x: trunk, y: laneY }
        ];
        if (Math.abs(farY - laneY) > 0.8) spine.push({ x: trunk, y: farY });
        addLine(lines, spine, net);
        bundle.forEach(edge => {
            const target = edge.target.pin;
            if (Math.abs(target.ax - trunk) < 0.8) return;
            addLine(lines, [
                { x: trunk, y: target.ay },
                { x: target.ax, y: target.ay }
            ], net);
        });
    }

    // Benachbarte Ziele desselben Netzes teilen sich eine senkrechte Stammleitung.
    function drawTree(bundle, index, lanes, lines) {
        const source = bundle[0].source.pin;
        const slot = channelSlot(bundle[0], index, lanes);
        addLine(lines, [
            { x: source.ax, y: source.ay },
            { x: slot, y: source.ay }
        ], bundle[0].net);
        bundle.forEach(edge => {
            const target = edge.target.pin;
            const points = [{ x: slot, y: source.ay }];
            if (Math.abs(target.ay - source.ay) > 0.8) points.push({ x: slot, y: target.ay });
            points.push({ x: target.ax, y: target.ay });
            addLine(lines, points, edge.net);
        });
    }

    function drawOrtho(edge, index, lanes, lines, laneY) {
        const source = edge.source.pin;
        const target = edge.target.pin;
        const left = edge.source.symbol.colRight + 16 + (edge.rise || 0) * LANE;
        const right = edge.target.symbol.colLeft - 16 - (edge.fall || 0) * LANE;
        if (laneY !== null && laneY !== undefined) {
            addLine(lines, [
                { x: source.ax, y: source.ay },
                { x: left, y: source.ay },
                { x: left, y: laneY },
                { x: right, y: laneY },
                { x: right, y: target.ay },
                { x: target.ax, y: target.ay }
            ], edge.net);
            return;
        }
        const slot = channelSlot(edge, index, lanes);
        addLine(lines, [
            { x: source.ax, y: source.ay },
            { x: slot, y: source.ay },
            { x: slot, y: target.ay },
            { x: target.ax, y: target.ay }
        ], edge.net);
    }

    // Lokale Kreise bleiben 14 Pixel neben dem eigenen Symbol. Lange Rückführungen nutzen das Band.
    function routeFeedback(edges, lanes, mid) {
        const lines = [];
        edges.filter(edge => edge.local).forEach(edge => {
            const source = edge.source.pin;
            const target = edge.target.pin;
            const top = edge.source.symbol.box.y - 14;
            addLine(lines, [
                { x: source.ax, y: source.ay },
                { x: source.ax + 16, y: source.ay },
                { x: source.ax + 16, y: top },
                { x: target.ax - 16, y: top },
                { x: target.ax - 16, y: target.ay },
                { x: target.ax, y: target.ay }
            ], edge.net);
        });
        edges.filter(edge => edge.back && !edge.local).forEach(edge => {
            const source = edge.source.pin;
            const target = edge.target.pin;
            const band = goesBottom([edge], mid) ? lanes.takeBottom() : lanes.takeTop();
            const exit = edge.source.symbol.colRight + 16 + (edge.rise || 0) * LANE;
            const entry = edge.target.symbol.colLeft - 16 - (edge.fall || 0) * LANE;
            addLine(lines, [
                { x: source.ax, y: source.ay },
                { x: exit, y: source.ay },
                { x: exit, y: band },
                { x: entry, y: band },
                { x: entry, y: target.ay },
                { x: target.ax, y: target.ay }
            ], edge.net);
        });
        return lines;
    }

    // Parallele Strecken verschiedener Netze auf CLEAR Pixel bringen.
    // Auch kurze Überdeckungen. Pin-Ansätze bleiben, die Bahn wird
    // so weit verschoben, bis der neue Pegel frei ist.
    function separateClose(lines, symbols) {
        const CLEAR = 14;
        const NECK = 12;
        const pins = [];
        symbols.forEach(symbol => symbol.pins.forEach(pin => pins.push({ x: pin.ax, y: pin.ay })));
        function pinned(point) {
            return pins.some(pin => Math.hypot(pin.x - point.x, pin.y - point.y) < 1.2);
        }
        function segments() {
            const list = [];
            lines.forEach(line => {
                for (let index = 1; index < line.points.length; index++) {
                    const a = line.points[index - 1];
                    const b = line.points[index];
                    if (Math.hypot(b.x - a.x, b.y - a.y) < 1) continue;
                    const horiz = Math.abs(a.y - b.y) < 0.6;
                    const vert = Math.abs(a.x - b.x) < 0.6;
                    if (!horiz && !vert) continue;
                    list.push({ line: line, index: index - 1, a: a, b: b, horiz: horiz });
                }
            });
            return list;
        }
        function overlap(p, q) {
            const start = p.horiz
                ? Math.max(Math.min(p.a.x, p.b.x), Math.min(q.a.x, q.b.x))
                : Math.max(Math.min(p.a.y, p.b.y), Math.min(q.a.y, q.b.y));
            const end = p.horiz
                ? Math.min(Math.max(p.a.x, p.b.x), Math.max(q.a.x, q.b.x))
                : Math.min(Math.max(p.a.y, p.b.y), Math.max(q.a.y, q.b.y));
            return end - start;
        }
        function coordOf(seg) {
            return seg.horiz ? seg.a.y : seg.a.x;
        }
        function blocked(seg, coord) {
            const inset = 4;
            if (seg.horiz) {
                const left = Math.min(seg.a.x, seg.b.x) + inset;
                const right = Math.max(seg.a.x, seg.b.x) - inset;
                if (right - left < 4) return false;
                return symbols.some(symbol => {
                    const box = symbol.box;
                    return coord > box.y + 2 && coord < box.y + box.h - 2 && right > box.x + 2 && left < box.x + box.w - 2;
                });
            }
            const top = Math.min(seg.a.y, seg.b.y) + inset;
            const bottom = Math.max(seg.a.y, seg.b.y) - inset;
            if (bottom - top < 4) return false;
            return symbols.some(symbol => {
                const box = symbol.box;
                return coord > box.x + 2 && coord < box.x + box.w - 2 && bottom > box.y + 2 && top < box.y + box.h - 2;
            });
        }
        function relocate(point, x, y, net) {
            const ox = point.x;
            const oy = point.y;
            lines.forEach(line => {
                if (line.net !== net) return;
                line.points.forEach(item => {
                    if (Math.abs(item.x - ox) < 0.6 && Math.abs(item.y - oy) < 0.6) {
                        item.x = x;
                        item.y = y;
                    }
                });
            });
        }
        function rewrite(seg, coord) {
            const aPin = pinned(seg.a);
            const bPin = pinned(seg.b);
            const len = seg.horiz ? Math.abs(seg.b.x - seg.a.x) : Math.abs(seg.b.y - seg.a.y);
            const neck = Math.min(NECK, len / 3);
            if ((aPin && bPin && len < NECK * 3) || (!aPin && !bPin && len < 8)) return false;
            if (!aPin) {
                relocate(seg.a, seg.horiz ? seg.a.x : coord, seg.horiz ? coord : seg.a.y, seg.line.net);
            }
            if (!bPin) {
                relocate(seg.b, seg.horiz ? seg.b.x : coord, seg.horiz ? coord : seg.b.y, seg.line.net);
            }
            const seq = [];
            if (seg.horiz) {
                const dir = seg.b.x >= seg.a.x ? 1 : -1;
                seq.push({ x: seg.a.x, y: aPin ? seg.a.y : coord });
                if (aPin) seq.push({ x: seg.a.x + dir * neck, y: seg.a.y }, { x: seg.a.x + dir * neck, y: coord });
                if (bPin) seq.push({ x: seg.b.x - dir * neck, y: coord }, { x: seg.b.x - dir * neck, y: seg.b.y });
                seq.push({ x: seg.b.x, y: bPin ? seg.b.y : coord });
            } else {
                const dir = seg.b.y >= seg.a.y ? 1 : -1;
                seq.push({ x: aPin ? seg.a.x : coord, y: seg.a.y });
                if (aPin) seq.push({ x: seg.a.x, y: seg.a.y + dir * neck }, { x: coord, y: seg.a.y + dir * neck });
                if (bPin) seq.push({ x: coord, y: seg.b.y - dir * neck }, { x: seg.b.x, y: seg.b.y - dir * neck });
                seq.push({ x: bPin ? seg.b.x : coord, y: seg.b.y });
            }
            seg.line.points.splice(seg.index, 2, ...seq);
            return true;
        }
        function lengthOf(seg) {
            return seg.horiz ? Math.abs(seg.b.x - seg.a.x) : Math.abs(seg.b.y - seg.a.y);
        }
        function canMove(seg) {
            const len = lengthOf(seg);
            const pinCount = (pinned(seg.a) ? 1 : 0) + (pinned(seg.b) ? 1 : 0);
            if (pinCount === 2 && len < NECK * 3) return false;
            if (pinCount === 1 && len < NECK * 2) return false;
            if (len < 8) return false;
            return true;
        }
        function obstacle(seg, coord) {
            let nearest = null;
            segments().forEach(other => {
                if (other.line === seg.line && other.index === seg.index) return;
                if (other.line.net === seg.line.net || other.horiz !== seg.horiz) return;
                const gap = Math.abs(coordOf(other) - coord);
                if (gap >= CLEAR - 0.1 || overlap(seg, other) < 2) return;
                if (!nearest || gap < nearest.gap) nearest = { coord: coordOf(other), gap: gap };
            });
            return nearest;
        }
        // Weiter schieben, bis die neue Lage keinen Nachbarn mehr schneidet.
        function settle(seg, dest) {
            const dir = dest >= coordOf(seg) ? 1 : -1;
            let coord = dest;
            for (let hop = 0; hop < 40; hop++) {
                const hit = obstacle(seg, coord);
                if (!hit) return coord;
                const next = hit.coord + dir * CLEAR;
                if ((dir > 0 && next <= coord) || (dir < 0 && next >= coord)) return null;
                coord = next;
            }
            return null;
        }
        function tidy() {
            lines.forEach(line => {
                const kept = [];
                line.points.forEach(point => {
                    const prev = kept[kept.length - 1];
                    if (prev && Math.hypot(prev.x - point.x, prev.y - point.y) < 0.8) return;
                    const early = kept[kept.length - 2];
                    if (prev && early) {
                        const sameX = Math.abs(early.x - prev.x) < 0.6 && Math.abs(prev.x - point.x) < 0.6;
                        const sameY = Math.abs(early.y - prev.y) < 0.6 && Math.abs(prev.y - point.y) < 0.6;
                        if (sameX || sameY) {
                            kept[kept.length - 1] = point;
                            return;
                        }
                    }
                    kept.push(point);
                });
                if (kept.length >= 2) line.points = kept;
            });
        }
        function shift(seg, coord) {
            if (!canMove(seg) || blocked(seg, coord) || crowdsPin(seg, coord)) return false;
            return rewrite(seg, coord);
        }
        function crowdsPin(seg, coord) {
            return pins.some(pin => {
                const nearA = Math.hypot(seg.a.x - pin.x, seg.a.y - pin.y) <= NECK + 1;
                const nearB = Math.hypot(seg.b.x - pin.x, seg.b.y - pin.y) <= NECK + 1;
                const end = nearA ? seg.a : nearB ? seg.b : null;
                if (!end) return false;
                const now = seg.horiz ? Math.abs(end.y - pin.y) : Math.abs(end.x - pin.x);
                const next = seg.horiz ? Math.abs(coord - pin.y) : Math.abs(coord - pin.x);
                return next < now - 0.5 && next < NECK;
            });
        }
        const failed = new Set();
        for (let pass = 0; pass < 80; pass++) {
            tidy();
            const list = segments();
            let worst = null;
            for (let i = 0; i < list.length; i++) {
                for (let j = i + 1; j < list.length; j++) {
                    const left = list[i];
                    const right = list[j];
                    if (left.line.net === right.line.net || left.horiz !== right.horiz) continue;
                    const gap = Math.abs(coordOf(left) - coordOf(right));
                    const along = overlap(left, right);
                    if (gap >= CLEAR - 0.1 || along < 2) continue;
                    const key = [left.line.net, right.line.net, Math.round(coordOf(left)), Math.round(coordOf(right))].join(":");
                    if (failed.has(key)) continue;
                    if (!worst || gap < worst.gap - 0.05 || (Math.abs(gap - worst.gap) <= 0.05 && along > worst.along)) {
                        worst = { left: left, right: right, gap: gap, along: along, key: key };
                    }
                }
            }
            if (!worst) break;
            const lower = coordOf(worst.left) <= coordOf(worst.right) ? worst.right : worst.left;
            const upper = lower === worst.left ? worst.right : worst.left;
            const need = CLEAR - worst.gap;
            const down = settle(lower, coordOf(lower) + need);
            const up = settle(upper, coordOf(upper) - need);
            const moved = (down !== null && shift(lower, down)) || (up !== null && shift(upper, up));
            if (!moved) failed.add(worst.key);
        }
        tidy();
    }

    // Umwege mit mehr Knicken als nötig durch eine kürzere orthogonale Bahn ersetzen.
    // Der Abstand zu anderen Leitungen und zu den Symbolen bleibt 14 Pixel.
    function straighten(lines, symbols) {
        const CLEAR = 14;
        function bends(points) {
            let count = 0;
            for (let index = 1; index < points.length - 1; index++) {
                const ahead = Math.abs(points[index].x - points[index - 1].x) < 0.6;
                const next = Math.abs(points[index + 1].x - points[index].x) < 0.6;
                if (ahead !== next) count += 1;
            }
            return count;
        }
        function normalize(points) {
            const kept = [points[0]];
            for (let index = 1; index < points.length - 1; index++) {
                const point = points[index];
                const prev = kept[kept.length - 1];
                if (Math.hypot(prev.x - point.x, prev.y - point.y) < 0.8) continue;
                const early = kept[kept.length - 2];
                if (early) {
                    const sameX = Math.abs(early.x - prev.x) < 0.6 && Math.abs(prev.x - point.x) < 0.6;
                    const sameY = Math.abs(early.y - prev.y) < 0.6 && Math.abs(prev.y - point.y) < 0.6;
                    if (sameX || sameY) {
                        kept[kept.length - 1] = point;
                        continue;
                    }
                }
                kept.push(point);
            }
            const end = points[points.length - 1];
            const prev = kept[kept.length - 1];
            if (Math.hypot(prev.x - end.x, prev.y - end.y) < 0.8) kept[kept.length - 1] = end;
            else {
                const early = kept[kept.length - 2];
                const sameX = early && Math.abs(early.x - prev.x) < 0.6 && Math.abs(prev.x - end.x) < 0.6;
                const sameY = early && Math.abs(early.y - prev.y) < 0.6 && Math.abs(prev.y - end.y) < 0.6;
                if (sameX || sameY) kept[kept.length - 1] = end;
                else kept.push(end);
            }
            return kept;
        }
        function segmentsOf(line, from, to) {
            const list = [];
            const last = to === undefined ? line.points.length - 1 : to;
            const start = from || 0;
            for (let index = start + 1; index <= last; index++) {
                const a = line.points[index - 1];
                const b = line.points[index];
                if (Math.hypot(b.x - a.x, b.y - a.y) < 0.8) continue;
                list.push({ a: a, b: b, horiz: Math.abs(a.y - b.y) < 0.6 });
            }
            return list;
        }
        function covers(point, path) {
            if (path.some(other => Math.hypot(other.x - point.x, other.y - point.y) < 0.8)) return true;
            for (let index = 1; index < path.length; index++) {
                const a = path[index - 1];
                const b = path[index];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const length = dx * dx + dy * dy;
                if (length < 1) continue;
                const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / length;
                if (t < -0.001 || t > 1.001) continue;
                const x = a.x + t * dx;
                const y = a.y + t * dy;
                if (Math.hypot(point.x - x, point.y - y) < 1.2) return true;
            }
            return false;
        }
        function hugsSymbol(a, b) {
            const steps = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
            for (let step = 0; step <= steps; step++) {
                const x = a.x + (b.x - a.x) * step / steps;
                const y = a.y + (b.y - a.y) * step / steps;
                const nearPin = symbols.some(symbol => symbol.pins.some(pin => Math.hypot(pin.ax - x, pin.ay - y) < 16));
                if (nearPin) continue;
                const close = symbols.some(symbol => {
                    const box = symbol.box;
                    const dx = x < box.x ? box.x - x : x > box.x + box.w ? x - (box.x + box.w) : 0;
                    const dy = y < box.y ? box.y - y : y > box.y + box.h ? y - (box.y + box.h) : 0;
                    return Math.hypot(dx, dy) < CLEAR - 0.1;
                });
                if (close) return true;
            }
            return false;
        }
        function hitsSymbol(a, b) {
            const steps = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
            for (let step = 0; step <= steps; step++) {
                const x = a.x + (b.x - a.x) * step / steps;
                const y = a.y + (b.y - a.y) * step / steps;
                const nearPin = symbols.some(symbol => symbol.pins.some(pin => Math.hypot(pin.ax - x, pin.ay - y) < 6));
                if (nearPin) continue;
                const inside = symbols.some(symbol => {
                    const box = symbol.box;
                    return x > box.x + 1 && x < box.x + box.w - 1 && y > box.y + 1 && y < box.y + box.h - 1;
                });
                if (inside) return true;
            }
            return false;
        }
        function overlap(seg, other) {
            const start = seg.horiz
                ? Math.max(Math.min(seg.a.x, seg.b.x), Math.min(other.a.x, other.b.x))
                : Math.max(Math.min(seg.a.y, seg.b.y), Math.min(other.a.y, other.b.y));
            const end = seg.horiz
                ? Math.min(Math.max(seg.a.x, seg.b.x), Math.max(other.a.x, other.b.x))
                : Math.min(Math.max(seg.a.y, seg.b.y), Math.max(other.a.y, other.b.y));
            return end - start;
        }
        function tooClose(seg, other) {
            if (seg.horiz !== other.horiz) return false;
            const gap = seg.horiz ? Math.abs(seg.a.y - other.a.y) : Math.abs(seg.a.x - other.a.x);
            return gap < CLEAR - 0.1 && overlap(seg, other) >= 2;
        }
        function crosses(seg, other) {
            if (seg.horiz === other.horiz) return false;
            const horizontal = seg.horiz ? seg : other;
            const vertical = seg.horiz ? other : seg;
            const x = vertical.a.x;
            const y = horizontal.a.y;
            const x0 = Math.min(horizontal.a.x, horizontal.b.x);
            const x1 = Math.max(horizontal.a.x, horizontal.b.x);
            const y0 = Math.min(vertical.a.y, vertical.b.y);
            const y1 = Math.max(vertical.a.y, vertical.b.y);
            return x > x0 + 0.8 && x < x1 - 0.8 && y > y0 + 0.8 && y < y1 - 0.8;
        }
        function obstacles(line, from, to) {
            const list = [];
            lines.forEach(other => {
                const skip = other === line;
                for (let index = 1; index < other.points.length; index++) {
                    if (skip && index - 1 >= from && index <= to) continue;
                    const a = other.points[index - 1];
                    const b = other.points[index];
                    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.8) continue;
                    const horiz = Math.abs(a.y - b.y) < 0.6;
                    const vert = Math.abs(a.x - b.x) < 0.6;
                    if (!horiz && !vert) continue;
                    list.push({ net: other.net, a: a, b: b, horiz: horiz, own: other === line });
                }
            });
            return list;
        }
        function pathCrossings(parts, foreign, net) {
            let count = 0;
            parts.forEach(part => {
                foreign.forEach(item => {
                    if (item.net !== net && crosses(part, item)) count += 1;
                });
            });
            return count;
        }
        function pathClear(path, foreign, net, budget) {
            const parts = [];
            for (let index = 1; index < path.length; index++) {
                const a = path[index - 1];
                const b = path[index];
                if (Math.hypot(b.x - a.x, b.y - a.y) < 0.8) continue;
                if (hitsSymbol(a, b) || hugsSymbol(a, b)) return false;
                const horiz = Math.abs(a.y - b.y) < 0.6;
                if (!horiz && Math.abs(a.x - b.x) >= 0.6) return false;
                parts.push({ a: a, b: b, horiz: horiz });
            }
            if (!parts.length) return false;
            for (let index = 0; index < parts.length; index++) {
                for (let other = 0; other < foreign.length; other++) {
                    const item = foreign[other];
                    if ((item.own || item.net !== net) && tooClose(parts[index], item)) return false;
                }
            }
            return pathCrossings(parts, foreign, net) <= budget;
        }
        function lengthOf(path) {
            let total = 0;
            for (let index = 1; index < path.length; index++) {
                total += Math.hypot(path[index].x - path[index - 1].x, path[index].y - path[index - 1].y);
            }
            return total;
        }
        let guard = 0;
        let changed = true;
        while (changed && guard < 80) {
            changed = false;
            guard += 1;
            for (let lineIndex = 0; lineIndex < lines.length && !changed; lineIndex++) {
                const line = lines[lineIndex];
                const points = line.points;
                for (let start = 0; start < points.length && !changed; start++) {
                    for (let end = points.length - 1; end >= start + 2 && !changed; end--) {
                        const sub = points.slice(start, end + 1);
                        const have = bends(sub);
                        const aligned = Math.abs(sub[0].x - sub[sub.length - 1].x) < 0.6 ||
                            Math.abs(sub[0].y - sub[sub.length - 1].y) < 0.6;
                        if (have <= (aligned ? 0 : 1)) continue;
                        const foreign = obstacles(line, start, end);
                        const oldParts = segmentsOf({ points: sub });
                        const budget = pathCrossings(oldParts, foreign, line.net);
                        const options = [];
                        if (aligned) options.push([sub[0], sub[sub.length - 1]]);
                        options.push([sub[0], { x: sub[sub.length - 1].x, y: sub[0].y }, sub[sub.length - 1]]);
                        options.push([sub[0], { x: sub[0].x, y: sub[sub.length - 1].y }, sub[sub.length - 1]]);
                        if (have > 2) {
                            const xs = [];
                            const ys = [];
                            function keep(list, value) {
                                if (!list.some(item => Math.abs(item - value) < 0.4)) list.push(value);
                            }
                            let minX = Infinity;
                            let maxX = -Infinity;
                            let minY = Infinity;
                            let maxY = -Infinity;
                            sub.forEach(point => {
                                minX = Math.min(minX, point.x);
                                maxX = Math.max(maxX, point.x);
                                minY = Math.min(minY, point.y);
                                maxY = Math.max(maxY, point.y);
                            });
                            lines.forEach(other => other.points.forEach(point => {
                                if (point.x >= minX - CLEAR && point.x <= maxX + CLEAR) keep(xs, point.x);
                                if (point.y >= minY - CLEAR && point.y <= maxY + CLEAR) keep(ys, point.y);
                            }));
                            xs.forEach(x => options.push([
                                sub[0], { x: x, y: sub[0].y }, { x: x, y: sub[sub.length - 1].y }, sub[sub.length - 1]
                            ]));
                            ys.forEach(y => options.push([
                                sub[0], { x: sub[0].x, y: y }, { x: sub[sub.length - 1].x, y: y }, sub[sub.length - 1]
                            ]));
                        }
                        let best = null;
                        options.forEach(option => {
                            const path = normalize(option);
                            const count = bends(path);
                            if (count >= have) return;
                            if (!pathClear(path, foreign, line.net, budget)) return;
                            const anchors = [];
                            lines.forEach(other => {
                                if (other === line || other.net !== line.net) return;
                                other.points.forEach(point => {
                                    if (covers(point, sub)) anchors.push(point);
                                });
                            });
                            if (anchors.some(point => !covers(point, path))) return;
                            const length = lengthOf(path);
                            if (!best || count < best.count || (count === best.count && length < best.length - 0.5)) {
                                best = { path: path, count: count, length: length };
                            }
                        });
                        if (!best) continue;
                        const replacement = best.path.slice();
                        replacement[0] = points[start];
                        replacement[replacement.length - 1] = points[end];
                        points.splice(start, end - start + 1, ...replacement);
                        changed = true;
                    }
                }
            }
        }
    }

    // Spalten legen, Leitungen ziehen, zu enge Parallelen auseinanderrücken.
    function layoutFromWires(wires, options) {
        const bus = !!(options && options.bus);
        const iec = !(options && options.iec === false);
        const nets = netsFromWires(wires);
        const symbols = usedSymbols(nets);
        if (symbols.length < 2) {
            return { symbols: symbols, lines: [], labels: [], dots: [], width: 320, height: 80, feedback: 0, buses: 0 };
        }
        const edges = buildEdges(symbols, nets);
        assignLayers(symbols, edges);
        countOuter(edges);
        const columns = orderLayers(symbols, edges);
        const sheet = place(columns, edges, bus);
        symbols.forEach(symbol => layoutPins(symbol, iec));
        const plan = bandPlan(edges, symbols, bus);
        const shift = plan.top * 14;
        if (shift) symbols.forEach(symbol => { symbol.y += shift; });
        sheet.height += shift + plan.bottom * 14;
        symbols.forEach(symbol => layoutPins(symbol, iec));
        orderOuter(edges);
        const lanes = {
            topIndex: 0,
            bottomIndex: 0,
            bottomBase: sheet.height,
            takeTop: function () {
                const y = 8 + this.topIndex * 14;
                this.topIndex += 1;
                return y;
            },
            takeBottom: function () {
                const y = this.bottomBase - 8 - this.bottomIndex * 14;
                this.bottomIndex += 1;
                return y;
            }
        };
        const mid = columnMid(symbols);
        const forward = routeForward(edges, lanes, mid, bus);
        const feedback = routeFeedback(edges, lanes, mid);
        const drawn = forward.lines.concat(feedback);
        separateClose(drawn, symbols);
        straighten(drawn, symbols);
        let maxX = 16;
        let maxY = 16;
        symbols.forEach(symbol => {
            maxX = Math.max(maxX, symbol.box.x + symbol.box.w + 16);
            maxY = Math.max(maxY, symbol.box.y + symbol.box.h + 16);
        });
        forward.labels.forEach(label => {
            maxX = Math.max(maxX, label.x + 16);
            maxY = Math.max(maxY, label.y + 16);
        });
        drawn.forEach(line => line.points.forEach(point => {
            if (point.x + 16 > maxX) maxX = point.x + 16;
            if (point.y + 16 > maxY) maxY = point.y + 16;
        }));
        sheet.width = maxX;
        sheet.height = maxY;
        return {
            symbols: symbols,
            lines: drawn,
            labels: forward.labels,
            dots: junctionDots(drawn, symbols),
            width: sheet.width,
            height: sheet.height,
            feedback: edges.filter(edge => edge.local || edge.back).length,
            buses: forward.labels.length,
            iec: iec
        };
    }

    // Punkt nur, wo mindestens drei Richtungen desselben Netzes zusammentreffen.
    function junctionDots(lines, symbols) {
        const nets = new Map();
        lines.forEach(line => {
            if (!line.join) return;
            if (!nets.has(line.net)) nets.set(line.net, []);
            const segments = nets.get(line.net);
            for (let index = 1; index < line.points.length; index++) {
                const from = line.points[index - 1];
                const to = line.points[index];
                if (Math.hypot(to.x - from.x, to.y - from.y) < 0.8) continue;
                segments.push([from, to]);
            }
        });
        const dots = [];
        nets.forEach(segments => {
            const points = [];
            segments.forEach(segment => points.push(segment[0], segment[1]));
            const unique = [];
            points.forEach(point => {
                if (!unique.some(other => Math.hypot(other.x - point.x, other.y - point.y) < 0.8)) unique.push(point);
            });
            unique.forEach(point => {
                if (covered(point, symbols)) return;
                const directions = new Set();
                segments.forEach(segment => {
                    const atStart = Math.hypot(segment[0].x - point.x, segment[0].y - point.y) < 0.8;
                    const atEnd = Math.hypot(segment[1].x - point.x, segment[1].y - point.y) < 0.8;
                    const through = !atStart && !atEnd && liesOn(point, segment[0], segment[1]);
                    if (atStart) directions.add(heading(point, segment[1]));
                    else if (atEnd) directions.add(heading(point, segment[0]));
                    else if (through) {
                        directions.add(heading(point, segment[0]));
                        directions.add(heading(point, segment[1]));
                    }
                });
                if (directions.size >= 3) dots.push({ x: point.x, y: point.y });
            });
        });
        return dots;
    }

    function heading(from, to) {
        if (Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)) return to.x >= from.x ? "E" : "W";
        return to.y >= from.y ? "S" : "N";
    }

    function liesOn(point, from, to) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const length = dx * dx + dy * dy;
        if (length < 1) return false;
        const t = ((point.x - from.x) * dx + (point.y - from.y) * dy) / length;
        if (t <= 0.04 || t >= 0.96) return false;
        const x = from.x + t * dx;
        const y = from.y + t * dy;
        return Math.hypot(point.x - x, point.y - y) < 0.8;
    }

    function covered(point, symbols) {
        return symbols.some(symbol => {
            const box = symbol.box;
            const onPin = symbol.pins.some(pin => Math.hypot(pin.ax - point.x, pin.ay - point.y) < 4);
            const inside = point.x > box.x + 1 && point.x < box.x + box.w - 1 &&
                point.y > box.y + 1 && point.y < box.y + box.h - 1;
            return onPin || inside;
        });
    }

    function palette(theme) {
        if (theme === "light") {
            return { bg: "#ffffff", fill: "#f4f4f5", stroke: "#1a1a1a", wire: "#1a1a1a", text: "#1a1a1a", pin: "#3f3f46" };
        }
        if (theme === "plain") {
            return {
                bg: "transparent",
                fill: "var(--card)",
                stroke: "var(--foreground)",
                wire: "var(--foreground)",
                text: "var(--foreground)",
                pin: "var(--muted-foreground)"
            };
        }
        return { bg: "#141414", fill: "#1a1a1a", stroke: "#eeeeee", wire: "#7eb6e0", text: "#ffffff", pin: "#9bd0ff" };
    }

    function esc(value) {
        return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function num(value) {
        return Math.round(value * 10) / 10;
    }

    function pointsAttr(points) {
        return points.map(point => num(point.x) + "," + num(point.y)).join(" ");
    }


    function svgOf(model, theme, label) {
        const printing = theme === "print";
        const color = printing
            ? { bg: "#ffffff", fill: "#ffffff", stroke: "#000000", wire: "#000000", text: "#000000", pin: "#000000" }
            : palette(theme || "dark");
        // Im Druck feste Strichstärke in der Zeichnung, sonst werden die Linien beim Skalieren grau.
        const pen = printing ? Math.round(Math.max(model.width * 0.0018, 1.3) * 10) / 10 : 1.5;
        const crisp = printing ? "" : ' vector-effect="non-scaling-stroke"';
        const parts = [];
        parts.push('<svg xmlns="' + SVGNS + '" viewBox="0 0 ' + model.width + " " + model.height +
            '" role="img" aria-label="' + esc(label || "Schaltplan") + '">');
        if (color.bg !== "transparent") {
            parts.push('<rect width="' + model.width + '" height="' + model.height + '" fill="' + color.bg + '"></rect>');
        }
        model.lines.forEach(line => {
            parts.push('<polyline points="' + pointsAttr(line.points) + '" fill="none" stroke="' + color.wire +
                '" stroke-width="' + pen + '" stroke-linejoin="round" stroke-linecap="square"' + crisp + "></polyline>");
        });
        (model.dots || []).forEach(dot => {
            parts.push('<circle cx="' + num(dot.x) + '" cy="' + num(dot.y) + '" r="' +
                (printing ? num(pen * 1.15) : "3.2") + '" fill="' + color.wire + '"></circle>');
        });
        model.symbols.forEach(symbol => {
            const box = symbol.box;
            parts.push('<g transform="translate(' + num(box.x) + " " + num(box.y) + ')">');
            if (symbol.kind === "block" || symbol.kind === "term") {
                parts.push('<rect x="0" y="0" width="' + num(box.w) + '" height="' + num(box.h) +
                    '" rx="6" fill="' + color.fill + '" stroke="' + color.stroke +
                    '" stroke-width="' + pen + '"' + crisp + "></rect>");
                parts.push('<text x="' + num(box.w / 2) + '" y="16" text-anchor="middle" fill="' + color.text +
                    '" font-size="12" font-family="Arial,sans-serif">' + esc(symbol.title) + "</text>");
            } else {
                const outline = gateOutline(symbol.kind, box.w, box.h, model.iec);
                parts.push('<path d="' + outline.body + '" fill="' + color.fill +
                    '" stroke="' + color.stroke + '" stroke-width="' + pen + '"' + crisp + "></path>");
                if (outline.xor) {
                    parts.push('<path d="' + outline.xor + '" fill="none" stroke="' + color.stroke +
                        '" stroke-width="' + pen + '"' + crisp + "></path>");
                }
                if (outline.bubble) {
                    parts.push('<circle cx="' + num(outline.bubble.cx) + '" cy="' + num(outline.bubble.cy) +
                        '" r="' + num(outline.bubble.r) + '" fill="' + color.fill + '" stroke="' + color.stroke +
                        '" stroke-width="' + pen + '"' + crisp + "></circle>");
                }
                if (outline.mark) {
                    const markRight = outline.bubble ? outline.bubble.cx - outline.bubble.r : box.w;
                    parts.push('<text x="' + num(markRight / 2) + '" y="' + num(box.h / 2 + 6) +
                        '" text-anchor="middle" fill="' + color.text + '" font-size="16" font-family="Arial,sans-serif">' +
                        esc(outline.mark) + "</text>");
                } else {
                    const titleX = outline.bubble ? (outline.bubble.cx - outline.bubble.r) * 0.42 : box.w * 0.38;
                    parts.push('<text x="' + num(titleX) + '" y="' + num(box.h / 2 + 4) +
                        '" text-anchor="middle" fill="' + color.text + '" font-size="11" font-family="Arial,sans-serif">' +
                        esc(symbol.title) + "</text>");
                }
            }
            symbol.pins.forEach(pin => {
                // Q am Schalter bleibt unsichtbar; Q̄ nur, wenn der invertierte Ausgang benutzt wird.
                if (!pin.name || pin.name === "Q") return;
                if (symbol.kind !== "block" && symbol.kind !== "term") return;
                const localX = pin.ax - box.x + (pin.role === "in" ? 5 : -5);
                const localY = pin.ay - box.y + 3;
                parts.push('<text x="' + num(localX) + '" y="' + num(localY) + '" text-anchor="' +
                    (pin.role === "in" ? "start" : "end") + '" fill="' + color.pin +
                    '" font-size="9" font-family="Arial,sans-serif">' + esc(pin.name) + "</text>");
            });
            parts.push("</g>");
        });
        model.labels.forEach(item => {
            parts.push('<text x="' + num(item.x) + '" y="' + num(item.y) + '" text-anchor="middle" fill="' + color.text +
                '" font-size="11" font-family="Arial,sans-serif">' + esc(item.text) + "</text>");
        });
        parts.push("</svg>");
        return parts.join("");
    }

    const api = { layoutFromWires: layoutFromWires, svgOf: svgOf };
    if (typeof module !== "undefined" && module.exports) module.exports = api;

    // Dialog nur im Browser. Ohne Simulator (Node) bleibt die Datei als Zeichenmodul nutzbar.
    function mount() {
        if (typeof buildWireNets !== "function" || typeof hotspots === "undefined" ||
                typeof wireConnections === "undefined") {
            return;
        }
        const style = document.createElement("style");
        style.textContent = [
            "#schematic-dialog { box-sizing:border-box; display:flex; flex-direction:column; overflow:hidden; width:min(1040px,calc(100vw - 16px)); height:min(760px,calc(100dvh - 16px)); min-width:420px; min-height:280px; max-width:calc(100vw - 16px); max-height:calc(100dvh - 16px); padding:0; border:1px solid #777; border-radius:8px; background:#242424; color:#fff; }",
            "#schematic-dialog::backdrop { background:rgba(0,0,0,.70); }",
            "#schematic-dialog .project-header { display:flex; align-items:center; gap:12px; padding:10px 14px; background:#303030; border-bottom:1px solid #555; }",
            "#schematic-title { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }",
            "#schematic-iec-label { margin-left:auto; display:flex; align-items:center; gap:6px; cursor:pointer; white-space:nowrap; }",
            "#schematic-dialog button { background:#333; color:white; border:1px solid #777; border-radius:5px; padding:6px 11px; cursor:pointer; }",
            "#schematic-body { position:relative; flex:1; min-height:0; padding:8px; box-sizing:border-box; }",
            "#schematic-view { width:100%; height:100%; }",
            "#schematic-view svg { width:100%; height:100%; }",
            "#schematic-wait { position:absolute; inset:0; z-index:2; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; background:rgba(20,20,20,.82); color:#eee; }",
            "#schematic-wait[hidden] { display:none; }",
            "#schematic-wait .wait-bar { width:min(280px,70%); height:8px; border-radius:4px; background:#111; overflow:hidden; border:1px solid #555; }",
            "#schematic-wait .wait-bar > span { display:block; height:100%; width:35%; background:#9bd0ff; animation:schematic-wait 1.1s ease-in-out infinite; }",
            "@keyframes schematic-wait { from { transform:translateX(-120%); } to { transform:translateX(320%); } }",
            ".schematic-corner { position:absolute; width:18px; height:18px; z-index:3; touch-action:none; }",
            ".schematic-corner[data-corner='nw'] { top:0; left:0; cursor:nwse-resize; }",
            ".schematic-corner[data-corner='ne'] { top:0; right:0; cursor:nesw-resize; }",
            ".schematic-corner[data-corner='sw'] { bottom:0; left:0; cursor:nesw-resize; }",
            ".schematic-corner[data-corner='se'] { bottom:0; right:0; cursor:nwse-resize; }",
            ".schematic-corner::after { content:''; position:absolute; width:9px; height:9px; border:2px solid #9bd0ff; }",
            ".schematic-corner[data-corner='nw']::after { top:4px; left:4px; border-right:0; border-bottom:0; }",
            ".schematic-corner[data-corner='ne']::after { top:4px; right:4px; border-left:0; border-bottom:0; }",
            ".schematic-corner[data-corner='sw']::after { bottom:4px; left:4px; border-right:0; border-top:0; }",
            ".schematic-corner[data-corner='se']::after { bottom:4px; right:4px; border-left:0; border-top:0; }"
        ].join("");
        document.head.appendChild(style);

        const dialog = document.createElement("dialog");
        dialog.id = "schematic-dialog";
        dialog.innerHTML = '<div class="project-header"><strong id="schematic-title">Schaltplan</strong><label id="schematic-iec-label" title="Gatter als Rechteck nach IEC 60617"><input type="checkbox" id="schematic-iec" checked> IEC 60617</label><button type="button" id="schematic-svg" title="Schaltplan als SVG-Datei sichern">SVG</button><button type="button" id="schematic-print">Drucken</button><button type="button" id="schematic-close" aria-label="Schaltplan schließen">✕</button></div><div id="schematic-body"><div id="schematic-view"></div><div id="schematic-wait" hidden role="status"><p></p><div class="wait-bar" aria-hidden="true"><span></span></div></div></div>';
        document.body.appendChild(dialog);
        const view = dialog.querySelector("#schematic-view");

        const button = document.createElement("button");
        button.type = "button";
        button.className = "schematic-toggle";
        button.textContent = "Schaltplan";
        button.title = "Logikplan der gesteckten Schaltung";
        const helpButton = document.querySelector(".help-toggle");
        if (helpButton) helpButton.parentNode.insertBefore(button, helpButton);
        else document.querySelector(".toolbar").appendChild(button);

        function planOptions() {
            return {
                iec: dialog.querySelector("#schematic-iec").checked
            };
        }
        function planName() {
            const loaded = typeof digitrainerProjectName === "string" ? digitrainerProjectName : "";
            dialog.querySelector("#schematic-title").textContent = loaded || "Schaltplan";
            return loaded || "Schaltplan";
        }
        // Erst die Meldung malen, dann rechnen. Dieselbe Verdrahtung wird
        // je Gatterformat einmal behalten, damit SVG, Druck und Zurückschalten
        // nicht noch einmal die ganze Führung berechnen.
        const waitBox = dialog.querySelector("#schematic-wait");
        const planCache = { stamp: "", models: new Map() };
        let planToken = 0;
        let jobs = Promise.resolve();
        function showWait(text) {
            waitBox.querySelector("p").textContent = text;
            waitBox.hidden = false;
        }
        function hideWait() {
            waitBox.hidden = true;
        }
        function afterPaint() {
            return new Promise(resolve => {
                requestAnimationFrame(() => requestAnimationFrame(resolve));
            });
        }
        function enqueue(task) {
            const run = jobs.then(task, task);
            jobs = run.then(() => {}, () => {});
            return run;
        }
        function wireStamp(wires) {
            let stamp = "";
            for (let index = 0; index < wires.length; index++) {
                stamp += wires[index].from + ">" + wires[index].to + ";";
            }
            return stamp;
        }
        function cachedModel(options) {
            const stamp = wireStamp(wireConnections);
            if (planCache.stamp !== stamp) {
                planCache.stamp = stamp;
                planCache.models.clear();
            }
            const key = options.iec ? "iec" : "form";
            if (planCache.models.has(key)) return planCache.models.get(key);
            const model = layoutFromWires(wireConnections, options);
            planCache.models.set(key, model);
            return model;
        }
        function renderPlan(model, name) {
            if (model.symbols.length < 2) view.textContent = "Noch keine signalrelevante Verdrahtung.";
            else view.innerHTML = svgOf(model, "dark", name);
        }
        function showPlan(forceWait) {
            const token = ++planToken;
            const options = planOptions();
            return enqueue(async () => {
                if (token !== planToken) return;
                const stamp = wireStamp(wireConnections);
                const key = options.iec ? "iec" : "form";
                const known = planCache.stamp === stamp && planCache.models.has(key);
                if (forceWait || !known) {
                    showWait("Schaltplan wird erstellt");
                    await afterPaint();
                    if (token !== planToken) return;
                }
                const model = cachedModel(options);
                if (token !== planToken) return;
                renderPlan(model, planName());
                hideWait();
            });
        }
        // Eigene Seite: weißer Grund, dunkle Linien. Die Bildschirmansicht bleibt dunkel.
        function printPlan() {
            enqueue(async () => {
                const name = planName();
                const model = cachedModel(planOptions());
                if (model.symbols.length < 2) return;
                const frame = document.createElement("iframe");
                frame.setAttribute("aria-hidden", "true");
                frame.style.cssText = "position:fixed;left:0;top:0;width:210mm;height:297mm;border:0;opacity:0;pointer-events:none;";
                document.body.appendChild(frame);
                const doc = frame.contentWindow.document;
                doc.open();
                doc.write("<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>" + esc(name) +
                    "</title><style>@page{margin:12mm}html,body{margin:0;background:#fff;color:#000}" +
                    "svg{display:block;width:100%;height:auto}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}</style></head><body>" +
                    svgOf(model, "print", name) + "</body></html>");
                doc.close();
                const win = frame.contentWindow;
                const remove = () => { if (frame.parentNode) frame.parentNode.removeChild(frame); };
                win.addEventListener("afterprint", () => setTimeout(remove, 200));
                setTimeout(() => {
                    win.focus();
                    win.print();
                }, 50);
            });
        }
        function savePlan() {
            enqueue(async () => {
                showWait("Datei wird erstellt");
                await afterPaint();
                const name = planName();
                const model = cachedModel(planOptions());
                if (model.symbols.length < 2) {
                    hideWait();
                    return;
                }
                const file = (name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "Schaltplan") + ".svg";
                const blob = new Blob(["<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" + svgOf(model, "print", name)], { type: "image/svg+xml" });
                hideWait();
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = file;
                document.body.appendChild(link);
                link.click();
                setTimeout(() => {
                    link.remove();
                    URL.revokeObjectURL(url);
                }, 1000);
            });
        }
        button.addEventListener("click", () => {
            if (!dialog.open) dialog.showModal();
            showPlan();
        });
        dialog.querySelector("#schematic-iec").addEventListener("change", () => {
            if (dialog.open) showPlan(true);
        });
        dialog.querySelector("#schematic-print").addEventListener("click", printPlan);
        dialog.querySelector("#schematic-svg").addEventListener("click", savePlan);
        dialog.querySelector("#schematic-close").addEventListener("click", () => dialog.close());
        dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
        dialog.addEventListener("keydown", event => event.stopPropagation());

        ["nw", "ne", "sw", "se"].forEach(corner => {
            const handle = document.createElement("div");
            handle.className = "schematic-corner";
            handle.dataset.corner = corner;
            handle.title = "An der Ecke ziehen, um das Fenster zu vergrößern";
            dialog.appendChild(handle);
            handle.addEventListener("pointerdown", event => {
                event.preventDefault();
                event.stopPropagation();
                const start = dialog.getBoundingClientRect();
                const originX = event.clientX;
                const originY = event.clientY;
                dialog.style.margin = "0";
                dialog.style.right = "auto";
                dialog.style.bottom = "auto";
                dialog.style.left = start.left + "px";
                dialog.style.top = start.top + "px";
                dialog.style.width = start.width + "px";
                dialog.style.height = start.height + "px";
                handle.setPointerCapture(event.pointerId);
                function onMove(ev) {
                    const dx = ev.clientX - originX;
                    const dy = ev.clientY - originY;
                    const minW = 420;
                    const minH = 280;
                    const pad = 8;
                    let left = start.left;
                    let top = start.top;
                    let width = start.width;
                    let height = start.height;
                    if (corner[1] === "e") width = start.width + dx;
                    else {
                        width = start.width - dx;
                        left = start.left + dx;
                    }
                    if (corner[0] === "s") height = start.height + dy;
                    else {
                        height = start.height - dy;
                        top = start.top + dy;
                    }
                    if (width < minW) {
                        if (corner[1] === "w") left = start.left + start.width - minW;
                        width = minW;
                    }
                    if (height < minH) {
                        if (corner[0] === "n") top = start.top + start.height - minH;
                        height = minH;
                    }
                    if (left < pad) {
                        width -= pad - left;
                        left = pad;
                    }
                    if (top < pad) {
                        height -= pad - top;
                        top = pad;
                    }
                    const maxW = window.innerWidth - pad - left;
                    const maxH = window.innerHeight - pad - top;
                    if (width > maxW) width = maxW;
                    if (height > maxH) height = maxH;
                    dialog.style.left = left + "px";
                    dialog.style.top = top + "px";
                    dialog.style.width = Math.max(minW, width) + "px";
                    dialog.style.height = Math.max(minH, height) + "px";
                }
                function onUp(ev) {
                    handle.removeEventListener("pointermove", onMove);
                    handle.removeEventListener("pointerup", onUp);
                    if (handle.hasPointerCapture(ev.pointerId)) handle.releasePointerCapture(ev.pointerId);
                }
                handle.addEventListener("pointermove", onMove);
                handle.addEventListener("pointerup", onUp);
            });
        });
    }

    if (typeof document !== "undefined") mount();
})();
