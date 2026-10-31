// ------------------------------------------------------------
// DigiTrainer – Schaltplan aus der Verdrahtung (schaltplan.js)
//
// Eigene Ansicht. simulator.js bleibt unverändert.
// Der Signalfluss läuft von links nach rechts: jede Stufe
// steht eine Spalte weiter rechts. Versorgung bleibt unsichtbar.
// Drei oder mehr gleichlaufende Leitungen zwischen zwei Spalten
// werden als Bus gezeichnet, wenn die Anschlussreihenfolge
// auf beiden Seiten übereinstimmt. Der Bus ist standardmäßig aus.
// Ein Punkt markiert eine elektrische Verbindung. Eine Kreuzung
// ohne Punkt verbindet nicht. Echte Kreise bleiben kurze
// Rückführungen.
// ------------------------------------------------------------

(function () {
    "use strict";

    const SVGNS = "http://www.w3.org/2000/svg";
    const GAP = 20;
    const GUTTER = 64;

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

    const LANE = 16;

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
        const bottom = Math.max(...columns.flat().map(symbol => symbol.y + sizeOf(symbol).h / 2), top + 20);
        return {
            width: Math.max(160, cursor + 16),
            height: Math.ceil(bottom + 16)
        };
    }

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

    function layoutPins(symbol) {
        const size = sizeOf(symbol);
        const box = { x: symbol.x - size.w / 2, y: symbol.y - size.h / 2, w: size.w, h: size.h };
        symbol.box = box;
        const inputs = symbol.pins.filter(pin => pin.role === "in");
        const outputs = symbol.pins.filter(pin => pin.role === "out");
        if (symbol.kind !== "block" && symbol.kind !== "term") {
            const outline = gateOutline(symbol.kind, box.w, box.h);
            inputs.forEach((pin, index) => {
                const localY = outline.y0 + (outline.y1 - outline.y0) * (index + 1) / (inputs.length + 1);
                pin.ay = box.y + localY;
                pin.ax = box.x + (symbol.kind === "xor" ? xorFront(localY, box.h) : outline.inX);
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

    function gateOutline(kind, w, h) {
        const bubble = kind === "not" || kind === "nor" || kind === "nand";
        const radius = 4.5;
        const y0 = h * 0.16;
        const y1 = h * 0.84;
        const cy = h / 2;
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
            const lanes = bus && bundles.length >= 3 && sameOrder(bundles) ? 1 : group.length;
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
                const ordered = bundles.slice().sort((a, b) => a[0].source.pin.ay - b[0].source.pin.ay);
                ordered.forEach((bundle, index) => {
                    if (far) bundle.forEach(edge => drawOrtho(edge, 0, 1, lines, take()));
                    else if (bundle.length > 1) drawTree(bundle, index, ordered.length, lines);
                    else bundle.forEach(edge => drawOrtho(edge, index, ordered.length, lines, null));
                });
            }
        });
        return { lines: lines, labels: labels };
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

    function routeFeedback(edges, lanes, mid) {
        const lines = [];
        edges.filter(edge => edge.local).forEach(edge => {
            const source = edge.source.pin;
            const target = edge.target.pin;
            const top = edge.source.symbol.box.y - 8;
            addLine(lines, [
                { x: source.ax, y: source.ay },
                { x: source.ax + 10, y: source.ay },
                { x: source.ax + 10, y: top },
                { x: target.ax - 10, y: top },
                { x: target.ax - 10, y: target.ay },
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

    function layoutFromWires(wires, options) {
        const bus = !!(options && options.bus);
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
        symbols.forEach(layoutPins);
        const plan = bandPlan(edges, symbols, bus);
        const shift = plan.top * 14;
        if (shift) symbols.forEach(symbol => { symbol.y += shift; });
        sheet.height += shift + plan.bottom * 14;
        symbols.forEach(layoutPins);
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
        return {
            symbols: symbols,
            lines: drawn,
            labels: forward.labels,
            dots: junctionDots(drawn, symbols),
            width: sheet.width,
            height: sheet.height,
            feedback: edges.filter(edge => edge.local || edge.back).length,
            buses: forward.labels.length
        };
    }

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
        const color = palette(theme || "dark");
        const parts = [];
        parts.push('<svg xmlns="' + SVGNS + '" viewBox="0 0 ' + model.width + " " + model.height +
            '" role="img" aria-label="' + esc(label || "Schaltplan") + '">');
        if (color.bg !== "transparent") {
            parts.push('<rect width="' + model.width + '" height="' + model.height + '" fill="' + color.bg + '"></rect>');
        }
        model.lines.forEach(line => {
            parts.push('<polyline points="' + pointsAttr(line.points) + '" fill="none" stroke="' + color.wire +
                '" stroke-width="1.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"></polyline>');
        });
        (model.dots || []).forEach(dot => {
            parts.push('<circle cx="' + num(dot.x) + '" cy="' + num(dot.y) + '" r="3.2" fill="' + color.wire + '"></circle>');
        });
        model.symbols.forEach(symbol => {
            const box = symbol.box;
            parts.push('<g transform="translate(' + num(box.x) + " " + num(box.y) + ')">');
            if (symbol.kind === "block" || symbol.kind === "term") {
                parts.push('<rect x="0" y="0" width="' + num(box.w) + '" height="' + num(box.h) +
                    '" rx="6" fill="' + color.fill + '" stroke="' + color.stroke +
                    '" stroke-width="1.5" vector-effect="non-scaling-stroke"></rect>');
                parts.push('<text x="' + num(box.w / 2) + '" y="16" text-anchor="middle" fill="' + color.text +
                    '" font-size="12" font-family="Arial,sans-serif">' + esc(symbol.title) + "</text>");
            } else {
                const outline = gateOutline(symbol.kind, box.w, box.h);
                parts.push('<path d="' + outline.body + '" fill="' + color.fill +
                    '" stroke="' + color.stroke + '" stroke-width="1.5" vector-effect="non-scaling-stroke"></path>');
                if (outline.xor) {
                    parts.push('<path d="' + outline.xor + '" fill="none" stroke="' + color.stroke +
                        '" stroke-width="1.5" vector-effect="non-scaling-stroke"></path>');
                }
                if (outline.bubble) {
                    parts.push('<circle cx="' + num(outline.bubble.cx) + '" cy="' + num(outline.bubble.cy) +
                        '" r="' + num(outline.bubble.r) + '" fill="' + color.fill + '" stroke="' + color.stroke +
                        '" stroke-width="1.4" vector-effect="non-scaling-stroke"></circle>');
                }
                const titleX = outline.bubble ? (outline.bubble.cx - outline.bubble.r) * 0.42 : box.w * 0.38;
                parts.push('<text x="' + num(titleX) + '" y="' + num(box.h / 2 + 4) +
                    '" text-anchor="middle" fill="' + color.text + '" font-size="11" font-family="Arial,sans-serif">' +
                    esc(symbol.title) + "</text>");
            }
            symbol.pins.forEach(pin => {
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

    function mount() {
        if (typeof buildWireNets !== "function" || typeof hotspots === "undefined" ||
                typeof wireConnections === "undefined") {
            return;
        }
        const style = document.createElement("style");
        style.textContent = [
            "#schematic-dialog { box-sizing:border-box; display:flex; flex-direction:column; width:min(1040px,calc(100vw - 16px)); height:min(760px,calc(100dvh - 16px)); max-height:calc(100dvh - 16px); padding:0; border:1px solid #777; border-radius:8px; background:#242424; color:#fff; }",
            "#schematic-dialog::backdrop { background:rgba(0,0,0,.70); }",
            "#schematic-dialog .project-header { display:flex; align-items:center; gap:12px; padding:10px 14px; background:#303030; border-bottom:1px solid #555; }",
            "#schematic-bus-label { margin-left:auto; display:flex; align-items:center; gap:6px; cursor:pointer; }",
            "#schematic-dialog button { background:#333; color:white; border:1px solid #777; border-radius:5px; padding:6px 11px; cursor:pointer; }",
            "#schematic-body { flex:1; min-height:0; padding:8px; box-sizing:border-box; }",
            "#schematic-view { width:100%; height:100%; }",
            "#schematic-view svg { width:100%; height:100%; }"
        ].join("");
        document.head.appendChild(style);

        const dialog = document.createElement("dialog");
        dialog.id = "schematic-dialog";
        dialog.innerHTML = '<div class="project-header"><strong>Schaltplan</strong><label id="schematic-bus-label"><input type="checkbox" id="schematic-bus"> Bus</label><button type="button" id="schematic-close" aria-label="Schaltplan schließen">✕</button></div><div id="schematic-body"><div id="schematic-view"></div></div>';
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

        function showPlan() {
            const model = layoutFromWires(wireConnections, { bus: dialog.querySelector("#schematic-bus").checked });
            if (model.symbols.length < 2) view.textContent = "Noch keine signalrelevante Verdrahtung.";
            else view.innerHTML = svgOf(model, "dark", "Schaltplan");
        }
        button.addEventListener("click", () => {
            showPlan();
            dialog.showModal();
        });
        dialog.querySelector("#schematic-bus").addEventListener("change", () => {
            if (dialog.open) showPlan();
        });
        dialog.querySelector("#schematic-close").addEventListener("click", () => dialog.close());
        dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
        dialog.addEventListener("keydown", event => event.stopPropagation());
    }

    if (typeof document !== "undefined") mount();
})();
