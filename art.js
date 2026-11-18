// Draws objects and their broken pieces in four art styles, all from the same 12 x 12 drawing.
export const STYLES = ["pixel", "ascii", "watercolor", "3d"];
export const STYLE_NAMES = { pixel: "Pixel", ascii: "ASCII", watercolor: "Watercolor", "3d": "3D" };

const SLOT = { a: 0, b: 1, c: 2, d: 3 };
const RAMP = "@%#*+=-:"; // ASCII characters from dense to light

// o: { x, y, size, angle, stretch, spinY, colors, seed, art }
export function drawObject(ctx, o, style) {
  const cell = o.size / 12;
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(o.angle);
  // Stretching makes it wider and thinner, squeezing makes it narrower and taller.
  ctx.scale(o.stretch, 1 / Math.sqrt(o.stretch));
  if (style === "3d") draw3d(ctx, o, cell);
  else if (style === "ascii") drawAscii(ctx, o, cell);
  else if (style === "watercolor") drawWatercolor(ctx, o, cell);
  else drawPixels(ctx, o, cell);
  ctx.restore();
}

// Every filled pixel of the drawing: column, row, color.
function* cells(o) {
  for (let r = 0; r < 12; r++) for (let c = 0; c < 12; c++) {
    const ch = o.art[r][c];
    if (ch !== ".") yield { c, r, color: o.colors[SLOT[ch]] };
  }
}

function drawPixels(ctx, o, cell) {
  for (const p of cells(o)) {
    ctx.fillStyle = p.color;
    ctx.fillRect((p.c - 6) * cell, (p.r - 6) * cell, cell + 0.6, cell + 0.6);
  }
}

function drawAscii(ctx, o, cell) {
  ctx.font = `bold ${cell * 1.35}px ui-monospace, Menlo, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const p of cells(o)) {
    ctx.fillStyle = p.color;
    ctx.fillText(asciiFor(p.color), (p.c - 5.5) * cell, (p.r - 5.5) * cell);
  }
}

// Soft overlapping dabs of color that bleed past the lines, like paint on wet paper.
function drawWatercolor(ctx, o, cell) {
  const rand = seeded(o.seed);
  for (let pass = 0; pass < 2; pass++) {
    for (const p of cells(o)) {
      const x = (p.c - 5.5 + (rand() - 0.5) * 0.8) * cell, y = (p.r - 5.5 + (rand() - 0.5) * 0.8) * cell;
      const rad = cell * (0.9 + rand() * 0.5);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, withAlpha(p.color, 0.42));
      g.addColorStop(0.7, withAlpha(p.color, 0.22));
      g.addColorStop(1, withAlpha(p.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// A solid block you can turn: back layers in shadow, the front face turns with the object.
function draw3d(ctx, o, cell) {
  const turn = Math.cos(o.spinY), depth = 4;
  for (let k = depth; k >= 0; k--) {
    const dx = Math.sin(o.spinY) * k * cell * 0.45, dy = k * cell * 0.22;
    ctx.save();
    ctx.translate(dx, dy);
    ctx.scale(Math.max(0.18, Math.abs(turn)), 1);
    for (const p of cells(o)) {
      ctx.fillStyle = k === 0 ? p.color : shade(p.color, 0.45 + 0.08 * (depth - k));
      ctx.fillRect((p.c - 6) * cell, (p.r - 6) * cell, cell + 0.6, cell + 0.6);
    }
    ctx.restore();
  }
}

// Broken pieces fly in the same style as the object.
export function drawPiece(ctx, p, style) {
  ctx.globalAlpha = Math.max(0, p.life);
  if (style === "ascii") {
    ctx.font = `bold ${p.size * 1.35}px ui-monospace, Menlo, monospace`;
    ctx.fillStyle = p.color;
    ctx.fillText(asciiFor(p.color), p.x, p.y);
  } else if (style === "watercolor") {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
    g.addColorStop(0, withAlpha(p.color, 0.45));
    g.addColorStop(1, withAlpha(p.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  } else {
    if (style === "3d") { ctx.fillStyle = shade(p.color, 0.5); ctx.fillRect(p.x - p.size / 2 + p.size * 0.3, p.y - p.size / 2 + p.size * 0.3, p.size, p.size); }
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// ---------- Color helpers ----------
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const hex = ([r, g, b]) => "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
export const withAlpha = (h, a) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; };
export const shade = (h, k) => hex(rgb(h).map((v) => v * k));
export const mix = (h1, h2, t) => { const a = rgb(h1), b = rgb(h2); return hex(a.map((v, i) => v + (b[i] - v) * t)); };
const lum = (h) => { const [r, g, b] = rgb(h); return (0.3 * r + 0.59 * g + 0.11 * b) / 255; };
const asciiFor = (color) => RAMP[Math.min(RAMP.length - 1, Math.floor((1 - lum(color)) * RAMP.length))];
function seeded(seed) { let s = seed || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
