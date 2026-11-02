// Prüft, dass parallele Leitungen verschiedener Signale auseinanderliegen.
// node test/leitungsabstand.js

"use strict";

const fs = require("fs");
const path = require("path");
const api = require("../js/schaltplan.js");

const CLEAR = 13.5;
const projects = [
    "counter-1.json",
    "counter-2.json",
    "lauflicht-D0-D7.json",
    "lauflicht-D0-D7-Pendel.json"
];

function segments(model) {
    const list = [];
    model.lines.forEach(line => {
        for (let index = 1; index < line.points.length; index++) {
            const a = line.points[index - 1];
            const b = line.points[index];
            if (Math.hypot(b.x - a.x, b.y - a.y) < 1) continue;
            const horiz = Math.abs(a.y - b.y) < 0.6;
            const vert = Math.abs(a.x - b.x) < 0.6;
            list.push({ line: line, a: a, b: b, horiz: horiz, vert: vert });
        }
    });
    return list;
}

function overlap(left, right) {
    const start = left.horiz
        ? Math.max(Math.min(left.a.x, left.b.x), Math.min(right.a.x, right.b.x))
        : Math.max(Math.min(left.a.y, left.b.y), Math.min(right.a.y, right.b.y));
    const end = left.horiz
        ? Math.min(Math.max(left.a.x, left.b.x), Math.max(right.a.x, right.b.x))
        : Math.min(Math.max(left.a.y, left.b.y), Math.max(right.a.y, right.b.y));
    return end - start;
}

function onSegment(point, seg) {
    const dx = seg.b.x - seg.a.x;
    const dy = seg.b.y - seg.a.y;
    const length = dx * dx + dy * dy;
    if (length < 1) return false;
    const t = ((point.x - seg.a.x) * dx + (point.y - seg.a.y) * dy) / length;
    if (t < -0.02 || t > 1.02) return false;
    const x = seg.a.x + t * dx;
    const y = seg.a.y + t * dy;
    return Math.hypot(point.x - x, point.y - y) < 1.2;
}

function check(name) {
    const wires = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "projects", name), "utf8")).wires;
    const model = api.layoutFromWires(wires, {});
    const list = segments(model);
    const problems = [];
    function report(text) {
        if (!problems.includes(text)) problems.push(text);
    }
    for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
            const left = list[i];
            const right = list[j];
            if (left.line.net === right.line.net || left.horiz !== right.horiz || !left.horiz && !left.vert) continue;
            if (!right.horiz && !right.vert) continue;
            const gap = left.horiz ? Math.abs(left.a.y - right.a.y) : Math.abs(left.a.x - right.a.x);
            const along = overlap(left, right);
            if (along >= 2 && gap < CLEAR) {
                report("Abstand " + Math.round(gap * 10) / 10 + " px, Netz " + left.line.net + "/" + right.line.net);
            }
        }
    }
    let corners = 0;
    list.forEach(seg => {
        if (!seg.horiz && !seg.vert) report("schräge Leitung");
    });
    model.lines.forEach(line => {
        let count = 0;
        for (let index = 1; index < line.points.length - 1; index++) {
            const ahead = Math.abs(line.points[index].x - line.points[index - 1].x) < 0.6;
            const next = Math.abs(line.points[index + 1].x - line.points[index].x) < 0.6;
            if (ahead !== next) count += 1;
        }
        corners = Math.max(corners, count);
    });
    if (corners > 4) report("Leitung mit " + corners + " Richtungsänderungen");
    model.lines.forEach(line => {
        for (let index = 1; index < line.points.length; index++) {
            const a = line.points[index - 1];
            const b = line.points[index];
            const steps = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
            for (let step = 0; step <= steps; step++) {
                const x = a.x + (b.x - a.x) * step / steps;
                const y = a.y + (b.y - a.y) * step / steps;
                const nearPin = model.symbols.some(symbol => symbol.pins.some(pin => Math.hypot(pin.ax - x, pin.ay - y) < 16));
                if (nearPin) continue;
                model.symbols.forEach(symbol => {
                    const box = symbol.box;
                    const inside = x > box.x + 1 && x < box.x + box.w - 1 && y > box.y + 1 && y < box.y + box.h - 1;
                    if (inside) report("Leitung durch ein Symbol");
                    const dx = x < box.x ? box.x - x : x > box.x + box.w ? x - (box.x + box.w) : 0;
                    const dy = y < box.y ? box.y - y : y > box.y + box.h ? y - (box.y + box.h) : 0;
                    if (!inside && Math.hypot(dx, dy) < 13.5) report("Leitung zu nah an " + symbol.title);
                });
            }
        }
    });
    const byNet = new Map();
    list.forEach(seg => {
        if (seg.line.join === false) return;
        if (!byNet.has(seg.line.net)) byNet.set(seg.line.net, []);
        byNet.get(seg.line.net).push(seg);
    });
    byNet.forEach(parts => {
        parts.forEach((seg, index) => {
            [seg.a, seg.b].forEach(point => {
                const pin = model.symbols.some(symbol => symbol.pins.some(item => Math.hypot(item.ax - point.x, item.ay - point.y) < 1.2));
                const joined = parts.some((other, otherIndex) => otherIndex !== index && onSegment(point, other));
                if (!pin && !joined) report("offenes Ende, Netz " + seg.line.net);
            });
        });
    });
    return problems;
}

let failed = 0;
projects.forEach(name => {
    const problems = check(name);
    if (!problems.length) {
        console.log(name + " ok");
        return;
    }
    failed += 1;
    console.log(name);
    problems.slice(0, 8).forEach(problem => console.log("  " + problem));
});
if (failed) process.exit(1);
