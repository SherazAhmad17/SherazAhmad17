// Generates the animated SVGs used by the profile README (no JS needed on GitHub).
// Style: DevDay-like draw-dots text + agent bot. Run: npm i && npm run build
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "..", "assets");
const F = {
  m: opentype.loadSync(path.join(here, "fonts/Inter-Medium.woff")),
  r: opentype.loadSync(path.join(here, "fonts/Inter-Regular.woff")),
  mono: opentype.loadSync(path.join(here, "fonts/JetBrainsMono-Regular.woff")),
};
const C = { blue: "#006aff", green: "#00ab44", green2: "#04b84c", orange: "#f26d00", purple: "#924ff7", white: "#ffffff", grey: "#9a9aa2", dim: "#6b6b73", line: "#26262a", bg: "#000000", card: "#0a0a0b" };
const DOTS = [C.blue, C.green, C.orange, C.purple];
const fmt = n => Number(n.toFixed(2));

/* ---------------- text → path helpers ---------------- */
function cmdsToD(cmds) {
  const o = []; let open = false;
  for (const c of cmds) {
    if (c.type === "M") { if (open) o.push("Z"); o.push(`M${fmt(c.x)} ${fmt(c.y)}`); open = true; }
    else if (c.type === "L") o.push(`L${fmt(c.x)} ${fmt(c.y)}`);
    else if (c.type === "Q") o.push(`Q${fmt(c.x1)} ${fmt(c.y1)} ${fmt(c.x)} ${fmt(c.y)}`);
    else if (c.type === "C") o.push(`C${fmt(c.x1)} ${fmt(c.y1)} ${fmt(c.x2)} ${fmt(c.y2)} ${fmt(c.x)} ${fmt(c.y)}`);
    else if (c.type === "Z") { if (open) o.push("Z"); open = false; }
  }
  if (open) o.push("Z");
  return o.join("");
}
function layout(font, str, size, ls = 0) {
  const cs = [...str]; let x = 0; const items = [];
  cs.forEach((c, i) => {
    items.push({ c, x, i });
    x += font.getAdvanceWidth(c, size, { kerning: false });
    if (i < cs.length - 1) x += font.getKerningValue(font.charToGlyph(c), font.charToGlyph(cs[i + 1])) * size / font.unitsPerEm + ls;
  });
  return { items, width: x };
}
const width = (font, s, size, ls = 0) => layout(font, s, size, ls).width;
// anchor: start | middle | end
function text(font, str, x, y, size, { ls = 0, anchor = "start" } = {}) {
  const { items, width: w } = layout(font, str, size, ls);
  const ox = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
  return items.filter(i => i.c.trim()).map(i => cmdsToD(font.getPath(i.c, ox + i.x, y, size).commands)).join("");
}
const T = (font, str, x, y, size, fill, opts = {}, extra = "") => `<path d="${text(font, str, x, y, size, opts)}" fill="${fill}" ${extra}/>`;

/* ---------------- keyframes helper (discrete value changes) ---------------- */
function kf(name, prop, v0, changes, total) {
  const pc = t => Math.min(100, Math.max(0, (t / total) * 100));
  const f = n => Number(n.toFixed(4));
  let s = `@keyframes ${name}{0%{${prop}:${v0}}`; let pv = v0;
  for (const [t, v] of changes) { s += `${f(pc(t) - 0.0005)}%{${prop}:${pv}}${f(pc(t))}%{${prop}:${v}}`; pv = v; }
  return s + `100%{${prop}:${pv}}}`;
}

/* ---------------- draw-dots text (looping version of the website effect) ---------------- */
function anchorPoints(cmds, min) {
  const pts = []; let prev = null;
  for (const c of cmds) {
    if (c.type === "M") prev = null;
    if ("x" in c && "y" in c) { if (prev && Math.hypot(prev.x - c.x, prev.y - c.y) < min) continue; prev = { x: c.x, y: c.y }; pts.push(prev); }
  }
  return pts;
}
function drawDots({ id, str, x, y, size, anchor = "start", colorAt, cycle = 10, K = 0.06, wave = 4.6, font = F.m }) {
  const { items, width: w } = layout(font, str, size);
  const ox = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
  const words = []; { let s = 0; [...str].forEach((c, i) => { if (c === " ") { if (i > s) words.push([s, i]); s = i + 1; } }); words.push([s, [...str].length]); }
  const wordOf = i => words.findIndex(a => i >= a[0] && i < a[1]);
  const rL = size * 0.047 * 1.15, rS = size * 0.047 * 0.7, sw = size * 0.03;
  let defs = "", body = "", li = 0;
  for (const it of items) {
    if (!it.c.trim()) continue;
    const p = font.getPath(it.c, ox + it.x, y, size), d = cmdsToD(p.commands), col = colorAt(it.i, wordOf(it.i));
    const pts = anchorPoints(p.commands, size * 0.2), dl = (li * K).toFixed(3);
    defs += `<clipPath id="${id}c${li}"><path d="${d}"/></clipPath>`;
    body += `<g><path class="${id}s" d="${d}" stroke="${col}" clip-path="url(#${id}c${li})" style="animation-delay:${dl}s"/><path class="${id}f" d="${d}" fill="${col}" style="animation-delay:${dl}s"/>`;
    pts.forEach((q, n) => {
      const pd = (li * K + n * 0.035).toFixed(3);
      body += `<circle class="${id}l" cx="${fmt(q.x)}" cy="${fmt(q.y)}" r="${fmt(rL)}" fill="${col}" style="animation-delay:${pd}s"/><circle class="${id}d" cx="${fmt(q.x)}" cy="${fmt(q.y)}" r="${fmt(rS)}" fill="${col}" style="animation-delay:${pd}s"/>`;
    });
    body += `</g>`; li++;
  }
  const tw = wave, end = cycle - 0.7;
  const css = `.${id}s{fill:none;stroke-width:${fmt(sw)};stroke-linejoin:round;opacity:0;animation:${id}S ${cycle}s linear infinite both}` +
    `.${id}f{opacity:0;animation:${id}F ${cycle}s linear infinite both}` +
    `.${id}l,.${id}d{opacity:0;animation-duration:${cycle}s;animation-timing-function:linear;animation-iteration-count:infinite;animation-fill-mode:both}.${id}l{animation-name:${id}L}.${id}d{animation-name:${id}D}` +
    kf(id + "S", "opacity", 0, [[0.16, 1], [0.44, 0], [tw, 1], [tw + 0.6, 0]], cycle) +
    kf(id + "F", "opacity", 0, [[0.44, 1], [tw, 0], [tw + 0.6, 1], [end, 0]], cycle) +
    kf(id + "L", "opacity", 1, [[0.06, 0], [tw, 1], [tw + 0.09, 0]], cycle) +
    kf(id + "D", "opacity", 0, [[0.06, 1], [0.42, 0], [tw + 0.09, 1], [tw + 0.6, 0]], cycle);
  return { defs, body, css, width: w, box: { x1: ox, x2: ox + w } };
}
const nameWidth = (str, size) => width(F.m, str, size);

/* ---------------- agent bot ---------------- */
const MODES = {
  building: { color: C.green, ex: [{ t: "</>", x: 78, y: -29, w: 66 }] },
  designing: { color: C.purple, ex: [{ t: "!", x: -24, y: -4, w: 13 }] },
  iterating: { color: C.blue, ex: [{ t: ",", x: -10, y: -16, w: 12, flip: true }, { t: ",", x: 62, y: 69, w: 12 }] },
  testing: { color: C.orange, ex: [{ t: "<3", x: 93, y: 53, w: 54 }] },
  shipping: { color: "#dfdfdf", ex: [{ t: "<3", x: 89, y: -14, w: 50 }] },
  thinking: { color: "#262626", ex: [{ t: "?", x: -26, y: -7, w: 23 }], exColor: "#ffffff" },
};
const eyesOf = m => {
  const s = fs.readFileSync(path.join(here, `fonts/agent-eyes-${m}.svg`), "utf8");
  const fill = (s.match(/<svg[^>]*fill="([^"]+)"/) || [])[1] || "#000";
  return { inner: s.replace(/<svg[^>]*>/, "").replace("</svg>", ""), fill };
};
// gaze path (screen-space offsets in px of the 100px face, max 12) → rotated into the head frame like the website does
const GAZE = [[0, 0], [10, -6], [-7, -9], [-11, 4], [6, 10], [11, 1], [0, 0]];
function bot({ id, seq, period = 5, gazeT = 6, x = 0, y = 0, s = 1, startDelay = 0 }) {
  const total = seq.length * period, a = 12 * Math.PI / 180;
  const loc = ([dx, dy]) => [fmt(dx * Math.cos(a) - dy * Math.sin(a)), fmt(dx * Math.sin(a) + dy * Math.cos(a))];
  let css = `.${id}g{animation:${id}G ${gazeT}s ease-in-out infinite}@keyframes ${id}G{` +
    GAZE.map((g, i) => { const [lx, ly] = loc(g); return `${fmt(i / (GAZE.length - 1) * 100)}%{transform:translate(${lx}px,${ly}px)}`; }).join("") + "}";
  let body = `<g transform="translate(${x} ${y}) scale(${s})">`;
  const pc = t => Number(((t / total) * 100).toFixed(4));
  seq.forEach((mode, i) => {
    const M = MODES[mode], st = i * period + startDelay * 0, e = st + period, ey = eyesOf(mode);
    const eps = 0.0005;
    const frames = [];
    if (st > 0) frames.push(`0%{transform:scale(.22);visibility:hidden}`, `${pc(st) - eps}%{transform:scale(.22);visibility:hidden}`);
    frames.push(`${pc(st)}%{transform:scale(.22);visibility:visible;animation-timing-function:cubic-bezier(.29256,.93431,.53909,1)}`,
      `${pc(st + 0.7875)}%{transform:scale(1.08)}`, `${pc(st + 1.05)}%{transform:scale(1)}`,
      `${pc(e - 0.65)}%{transform:scale(1);animation-timing-function:cubic-bezier(.5,0,.80955,.20652)}`,
      `${pc(e)}%{transform:scale(.22);visibility:visible}`);
    if (e < total) frames.push(`${pc(e) + eps}%{transform:scale(.22);visibility:hidden}`, `100%{transform:scale(.22);visibility:hidden}`);
    css += `.${id}m${i}{animation:${id}R${i} ${total}s linear infinite both}@keyframes ${id}R${i}{${frames.join("")}}`;
    const exc = M.exColor || M.color;
    body += `<g transform="translate(90 82)"><g class="${id}m${i}"><g transform="translate(-90 -82)">` +
      `<g transform="translate(90 82) rotate(-12)"><circle r="50" fill="${M.color}"/>` +
      `<clipPath id="${id}k${i}"><circle r="50"/></clipPath><g clip-path="url(#${id}k${i})"><g class="${id}g"><g transform="translate(-50 -50)" fill="${ey.fill}">${ey.inner}</g></g></g></g>`;
    for (const ex of M.ex) {
      const cx = ex.x + 40 + ex.w / 2, cy = ex.y + 32 + 27;
      body += `<path d="${text(F.m, ex.t, cx, cy + 16.7, 46, { ls: -1.84, anchor: "middle" })}" fill="${exc}"${ex.flip ? ` transform="translate(${2 * cx} 0) scale(-1 1)"` : ""}/>`;
    }
    body += `</g></g></g>`;
  });
  return { body: body + `</g>`, css };
}

/* ---------------- small shared pieces ---------------- */
const svgWrap = (w, h, css, defs, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><style>${css}</style><defs>${defs}</defs>${body}</svg>\n`;
const frame = (w, h, r = 24, fill = C.bg) => `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="${r}" fill="${fill}" stroke="${C.line}"/>`;
// four palette dots at the corners of a box that pulse one after another (the CTA hover effect)
function cornerDots(x, y, w, h, delay = 0, dur = 3.2) {
  const pos = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  return pos.map(([cx, cy], i) =>
    `<circle cx="${cx}" cy="${cy}" r="4.5" fill="${DOTS[i]}"><animate attributeName="r" values="1.6;4.5;4.5;1.6" keyTimes="0;.12;.7;1" dur="${dur}s" begin="${(delay + i * 0.035).toFixed(3)}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".15;1;1;.15" keyTimes="0;.12;.7;1" dur="${dur}s" begin="${(delay + i * 0.035).toFixed(3)}s" repeatCount="indefinite"/></circle>`).join("");
}
// CTA / chip pill that morphs round → square while its corner dots pop in (like the website button hover)
function ctaPill(x, y, w, h, label, { size = 15, delay = 0, fill = C.white, ink = "#000", dur = 4 } = {}) {
  const r = h / 2;
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"><animate attributeName="rx" values="${r};${r};0;0;${r}" keyTimes="0;.1;.2;.7;.8" dur="${dur}s" begin="${delay}s" repeatCount="indefinite"/></rect>` +
    T(F.m, label, x + w / 2, y + h / 2 + size * 0.36, size, ink, { anchor: "middle" }) + cornerDots(x, y, w, h, delay + dur * 0.1, dur) + `</g>`;
}
const outlinePill = (x, y, label, size = 14, color = C.white) => {
  const w = width(F.m, label, size) + 28, h = size + 18;
  return { w, svg: `<rect x="${x + .5}" y="${y + .5}" width="${w}" height="${h}" rx="${(h) / 2}" fill="none" stroke="${C.line}"/>` + T(F.m, label, x + 14.5, y + h / 2 + size * 0.36 + .5, size, color) };
};

/* =============================================================== HERO =============================================================== */
function hero() {
  const W = 1000, H = 520, SIZE_TARGET = 640;
  const size = 100 * SIZE_TARGET / nameWidth("SHERAZ AHMAD", 100);
  const dd = drawDots({ id: "h", str: "SHERAZ AHMAD", x: 56, y: 208, size, colorAt: (i, w) => w === 1 ? C.green2 : C.white });
  const b = bot({ id: "hb", seq: ["building", "iterating", "testing", "shipping", "thinking", "designing"], period: 5, x: 668, y: 118, s: 1.56 });
  let body = frame(W, H);
  // 2 years pill
  const pw = width(F.m, "2 years experience", 14) + 36;
  body += `<rect x="56" y="58" width="${pw}" height="34" rx="17" fill="${C.white}"/>` + T(F.m, "2 years experience", 56 + pw / 2, 79.5, 14, "#000", { anchor: "middle" }) + cornerDots(56, 58, pw, 34, 0.5, 4);
  body += dd.body;
  body += T(F.m, "AI Full Stack Developer", 58, 262, 24, C.white);
  body += T(F.r, "I turn ideas into intelligent products that solve real problems.", 58, 296, 17, C.grey);
  let px = 56; const py = 322;
  for (const l of ["SaaS", "REST APIs", "E-commerce", "AI agents"]) { const p = outlinePill(px, py, l, 13.5); body += p.svg; px += p.w + 10; }
  body += ctaPill(56, 378, 176, 46, "See my projects", { size: 15, delay: 1.2 });
  body += T(F.m, "GitHub", 258, 407, 15, C.white) + `<rect x="258" y="412" width="${fmt(width(F.m, "GitHub", 15))}" height="1.2" fill="${C.white}"/>`;
  body += b.body;
  // ticker
  const items = ["SaaS platforms", "REST APIs", "LangGraph", "Next.js", "NestJS", "MongoDB", "PostgreSQL", "E-commerce", "Chatbots", "AI agents"];
  let tx = 0, tk = "";
  items.forEach((s, i) => { tk += T(F.m, s, tx, 0, 19, C.white) + `<circle cx="${fmt(tx + width(F.m, s, 19) + 26)}" cy="-7" r="4.5" fill="${DOTS[i % 4]}"/>`; tx += width(F.m, s, 19) + 52; });
  body += `<clipPath id="tk"><rect x="1" y="462" width="998" height="57"/></clipPath><line x1="1" y1="462" x2="999" y2="462" stroke="${C.line}"/><g clip-path="url(#tk)"><g transform="translate(0 497)"><g class="tick">${tk}<g transform="translate(${fmt(tx)} 0)">${tk}</g></g></g></g>`;
  const css = dd.css + b.css + `.tick{animation:tick 36s linear infinite}@keyframes tick{to{transform:translateX(${-fmt(tx)}px)}}`;
  return svgWrap(W, H, css, dd.defs, body);
}

/* =============================================================== SECTION TITLES =============================================================== */
function title(file, str, tag) {
  const W = 1000, H = 84, size = 52, full = tag ? `${str} ${tag}` : str;
  const dd = drawDots({ id: "t", str: full, x: 6, y: 62, size, colorAt: (i, w) => (tag && i >= [...str].length + 1) ? C.purple : (w === 0 ? C.white : C.green2), cycle: 9, wave: 4.2 });
  return [file, svgWrap(W, H, dd.css, dd.defs, dd.body)];
}

/* =============================================================== TERMINAL (about) =============================================================== */
function terminal() {
  const W = 1000, size = 15, adv = F.mono.getAdvanceWidth("M", size), lh = 27, top = 92, cycle = 16;
  const lines = [
    ["$ ", "whoami"], ["  ", "sheraz_ahmad"], ["$ ", "cat role.txt"], ["  ", "AI Full Stack Developer  [2 years]  @ Uconnect Technologies"],
    ["$ ", "cat summary.txt"], ["  ", "\"I turn ideas into intelligent products that solve real problems.\""],
    ["$ ", "ls stack/"], ["  ", "javascript  typescript  react  nextjs  nodejs  express  mongodb  postgresql  langgraph"],
    ["$ ", "cat focus.txt"], ["  ", "SaaS platforms | REST APIs | E-commerce | AI agents | chatbots | payments | deployment"],
    ["$ ", "echo $LOCATION"], ["  ", "Gilgit, Gilgit-Baltistan"],
  ];
  const H = top + lines.length * lh + 30;
  let defs = "", body = frame(W, H, 20) + `<line x1="1" y1="52" x2="999" y2="52" stroke="${C.line}"/>`;
  [C.blue, C.green, C.orange, C.purple].forEach((c, i) => body += `<circle cx="${30 + i * 22}" cy="26" r="6" fill="${c}"/>`);
  body += T(F.mono, "sheraz@portfolio ~ zsh", W / 2, 31, 13, C.dim, { anchor: "middle" });
  let t = 0.8;
  lines.forEach(([pre, s], i) => {
    const cmd = pre === "$ ", y = top + i * lh, x0 = 34, n = [...pre + s].length, w = n * adv, dur = Math.max(0.35, n * 0.028);
    const st = t; t += dur + (cmd ? 0.18 : 0.12);
    const col = cmd ? C.white : (s.startsWith('"') ? C.green2 : C.grey);
    defs += `<clipPath id="tc${i}"><rect x="${x0 - 2}" y="${y - 20}" height="28" width="0"><animate attributeName="width" dur="${cycle}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${[0, ...Array.from({ length: n }, (_, k) => (st + (k + 1) * dur / n) / cycle), 0.96].map(v => fmt(v * 1000) / 1000).join(";")}" values="0;${Array.from({ length: n }, (_, k) => fmt((k + 1) * adv + 2)).join(";")};0"/></rect></clipPath>`;
    body += `<g clip-path="url(#tc${i})">` + (cmd ? T(F.mono, "$", x0, y, size, C.green2) + T(F.mono, s, x0 + adv * 2, y, size, col) : T(F.mono, s, x0 + adv * 2, y, size, col)) + `</g>`;
  });
  const cy = top + (lines.length - 1) * lh;
  body += `<rect x="34" y="${cy + 8 + lh - 20}" width="${fmt(adv * .9)}" height="3" fill="${C.green2}"><animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite"/></rect>`;
  return svgWrap(W, H, "", defs, body);
}

/* =============================================================== TECH STACK =============================================================== */
function tech() {
  const W = 1000, cols = 5, cw = 184, ch = 112, gx = 20, gy = 20, H = ch * 2 + gy + 2;
  const items = [["Frontend", "Next.js"], ["Frontend", "React.js"], ["Language", "TypeScript"], ["Language", "JavaScript"], ["AI agents", "LangGraph"],
    ["Runtime", "Node.js"], ["Backend", "NestJS"], ["API", "Express.js"], ["Database", "MongoDB"], ["Database", "PostgreSQL"]];
  let body = "";
  items.forEach(([cat, name], i) => {
    const c = i % cols, r = Math.floor(i / cols), x = 1 + c * (cw + gx), y = 1 + r * (ch + gy), col = DOTS[i % 4], d = (i * 0.45).toFixed(2), dur = 6;
    body += `<g><rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="22" fill="${C.card}" stroke="${C.line}"><animate attributeName="rx" values="22;22;0;0;22" keyTimes="0;.12;.22;.6;.7" dur="${dur}s" begin="${d}s" repeatCount="indefinite"/></rect>` +
      `<circle cx="${x + 24}" cy="${y + 26}" r="5" fill="${col}"/>` + T(F.mono, cat.toUpperCase(), x + 38, y + 30.5, 11.5, C.dim, { ls: 1.2 }) +
      T(F.m, name, x + 22, y + 82, 25, C.white) + cornerDots(x, y, cw, ch, +d + dur * 0.12, dur) + `</g>`;
  });
  return svgWrap(W, H, "", "", body);
}

/* =============================================================== EXPERIENCE =============================================================== */
function experience() {
  const W = 1000, H = 250;
  const b = bot({ id: "eb", seq: ["designing"], period: 12, x: 705, y: 14, s: 1.4 });
  let body = frame(W, H, 22);
  body += T(F.m, "AI Full Stack Developer", 40, 70, 34, C.white);
  body += T(F.m, "Uconnect Technologies Pvt. Ltd.", 40, 104, 19, C.green2);
  const yw = width(F.m, "2026", 14) + 28;
  body += `<rect x="${40.5}" y="122.5" width="${yw}" height="30" rx="15" fill="none" stroke="${C.purple}"/>` + T(F.m, "2026", 40.5 + yw / 2, 142, 14, C.purple, { anchor: "middle" });
  [["Develop and maintain SaaS platforms, e-commerce systems and AI-powered applications.", 0], ["Build scalable REST APIs and backend services.", 1], ["Collaborate on multiple products including Gilgit App and QuoHR.", 2]].forEach(([s, i]) => {
    body += `<circle cx="46" cy="${178 + i * 27 - 5}" r="4" fill="${DOTS[(i + 1) % 4]}"/>` + T(F.r, s, 62, 178 + i * 27, 16, C.grey);
  });
  body += b.body + cornerDots(0, 0, W, H, 0.4, 5);
  return svgWrap(W, H, b.css, "", body);
}

/* =============================================================== PROJECT CARDS =============================================================== */
function card(file, { n, role, name, sub, d1, d2, tags, mode, delay }) {
  const W = 480, H = 270, M = MODES[mode], col = M.color === "#dfdfdf" ? C.white : (mode === "thinking" ? C.white : M.color);
  const b = bot({ id: "cb", seq: [mode], period: 12, x: 292, y: -14, s: 1.0 });
  let body = frame(W, H, 22);
  body += T(F.mono, n, 28, 44, 13, C.dim) + `<circle cx="${28 + width(F.mono, n, 13) + 14}" cy="40" r="4" fill="${col}"/>` + T(F.mono, role.toUpperCase(), 28 + width(F.mono, n, 13) + 26, 44, 12, col, { ls: 1.1 });
  body += T(F.m, name, 28, 108, 36, C.white) + T(F.mono, sub.toUpperCase(), 28, 134, 12, C.grey, { ls: 1.2 });
  body += T(F.r, d1, 28, 172, 15, "#c9c9cf") + T(F.r, d2, 28, 195, 15, C.dim);
  let px = 28;
  tags.forEach(t => { const p = outlinePill(px, 216, t.toUpperCase(), 11.5); body += p.svg; px += p.w + 8; });
  body += b.body + cornerDots(0, 0, W, H, delay, 5);
  return [file, svgWrap(W, H, b.css, "", body)];
}

/* =============================================================== FOOTER =============================================================== */
function footer() {
  const W = 1000, H = 330;
  const size = 100 * 700 / nameWidth("Let's build something", 100);
  const dd = drawDots({ id: "f", str: "Let's build something", x: 50, y: 150, size, colorAt: (i, w) => w === 2 ? C.green2 : C.white, cycle: 11, wave: 5 });
  const b = bot({ id: "fb", seq: ["shipping", "building", "testing"], period: 6, x: 770, y: 30, s: 1.2 });
  let body = frame(W, H) + dd.body;
  body += T(F.r, "Open to collaboration", 52, 196, 17, C.grey);
  const em = "sherazahmad7434@gmail.com", ew = width(F.m, em, 16) + 56;
  body += ctaPill(50, 226, ew, 48, em, { size: 16, delay: 1.5, dur: 5 });
  body += T(F.m, "Thanks for visiting", 50, 308, 13, C.dim);
  body += b.body;
  return svgWrap(W, H, dd.css + b.css, dd.defs, body);
}

/* ---------------- write everything ---------------- */
const files = [
  ["hero.svg", hero()],
  title("title-about.svg", "About me", "[01]"),
  title("title-skills.svg", "Tech stack", "[02]"),
  title("title-projects.svg", "Featured projects", "[03]"),
  title("title-github.svg", "GitHub activity", "[04]"),
  title("title-contact.svg", "Get in touch", "[05]"),
  ["terminal.svg", terminal()],
  ["tech3d.svg", tech()],
  card("card-gilgit.svg", { n: "01", role: "Full Stack Developer", name: "Gilgit App", sub: "E-commerce platform", d1: "Features for discovering and purchasing products.", d2: "Backend APIs and full-stack product/user workflows.", tags: ["E-commerce", "REST APIs", "Full stack"], mode: "testing", delay: 0 }),
  card("card-quohr.svg", { n: "02", role: "Junior Developer", name: "QuoHR", sub: "Workforce attendance system", d1: "Geolocation-based attendance for on-site workers.", d2: "Automatic checkout when leaving the workplace area.", tags: ["Geolocation", "Attendance", "Workforce"], mode: "iterating", delay: 0.4 }),
  card("card-careerforge.svg", { n: "03", role: "Team project", name: "CareerForge", sub: "AI career platform", d1: "AI CV builder, blog and real-time notifications.", d2: "Stripe subscriptions, Google and LinkedIn login.", tags: ["React", "Express 5", "MongoDB", "Stripe", "Groq"], mode: "designing", delay: 0.8 }),
  card("card-ailab.svg", { n: "04", role: "Personal projects", name: "AI Lab", sub: "GenAI / LangGraph / WebRTC", d1: "Agents, GenAI and real-time experiments.", d2: "GenAi, LangGraph_Custom_Agent, webRtc, Sass.", tags: ["LangGraph", "GenAI", "WebRTC"], mode: "building", delay: 1.2 }),
  ["footer.svg", footer()],
];
for (const [name, svg] of files) { fs.writeFileSync(path.join(out, name), svg); console.log(name.padEnd(24), (svg.length / 1024).toFixed(1) + " KB"); }
