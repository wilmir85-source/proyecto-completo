() => {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const blend = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
  const out = [];
  const all = document.querySelectorAll("body *");
  for (const el of all) {
    if (!Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) continue;
    if (cs.webkitTextFillColor && cs.webkitTextFillColor.includes("rgba(0, 0, 0, 0)")) continue;
    let fg = parse(cs.color);
    if (!fg) continue;
    const layers = []; let gradient = false; let n = el;
    while (n && n.nodeType === 1) {
      const s = getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage.includes("gradient") && n !== document.body && n !== document.documentElement && !n.classList.contains("app-shell")) { gradient = true; break; }
      const b = parse(s.backgroundColor);
      if (b && b[3] > 0) { layers.push(b); if (b[3] >= 0.99) break; }
      n = n.parentElement;
    }
    if (gradient) continue;
    let bg = [246, 239, 227, 1];
    if (document.documentElement.classList.contains("dark")) bg = [8, 8, 10, 1];
    for (let i = layers.length - 1; i >= 0; i--) bg = blend(layers[i], bg);
    fg = blend(fg, bg);
    const L1 = lum(fg), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (ratio < 3) {
      const t = el.textContent.trim().slice(0, 40);
      const tid = el.closest("[data-testid]")?.dataset.testid || "";
      out.push(`${ratio.toFixed(2)} | ${t} | color=${cs.color} bg=rgb(${bg.slice(0,3).map(Math.round)}) | cls=${(el.className && el.className.baseVal === undefined ? el.className : "").slice(0, 90)} | tid=${tid}`);
    }
  }
  return Array.from(new Set(out)).slice(0, 25);
}
