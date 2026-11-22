import React, { useEffect, useRef } from "react";
import ReactorSVG from "./ReactorSVG";
import "./JarvisReactor.css";


function buildBolt(cx, cy, r0, r1) {
  const angle = Math.random() * Math.PI * 2;
  const len = r0 + (r1 - r0) * (0.6 + Math.random() * 0.4);
  const segs = 8 + Math.floor(Math.random() * 6);
  const jitter = (r1 - r0) * 0.12;
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const d = r0 + ((len - r0) * i) / segs;
    const off = i === 0 ? 0 : (Math.random() - 0.5) * jitter * 2;
    const a = angle + off / d;
    pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]);
  }
  const branch = Math.random() < 0.45 ? Math.floor(segs * (0.3 + Math.random() * 0.4)) : -1;
  return { pts, branch, angle, life: 1, decay: 0.035 + Math.random() * 0.05, width: Math.random() < 0.35 ? 2.4 : 1.2 };
}

function drawPath(ctx, pts, width, alpha) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = `rgba(103,232,249,${alpha * 0.55})`;
  ctx.lineWidth = width * 3;
  ctx.shadowBlur = 18;
  ctx.shadowColor = "rgba(34,211,238,0.9)";
  ctx.stroke();
  ctx.strokeStyle = `rgba(240,253,255,${alpha})`;
  ctx.lineWidth = width;
  ctx.shadowBlur = 6;
  ctx.stroke();
}

function useLightning(canvasRef, active) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, raf = 0;
    let bolts = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2;
      if (Math.random() < 0.35 && bolts.length < 9) bolts.push(buildBolt(cx, cy, r * 0.3, r * 0.98));
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      bolts.forEach((b) => {
        const flicker = 0.6 + Math.random() * 0.4;
        drawPath(ctx, b.pts, b.width, b.life * flicker);
        if (b.branch > 0) {
          const [bx, by] = b.pts[b.branch];
          const sub = buildBolt(bx, by, 0, r * 0.3).pts;
          drawPath(ctx, [[bx, by], ...sub.slice(1, 4)], b.width * 0.6, b.life * flicker * 0.7);
        }
        b.life -= b.decay;
      });
      bolts = bolts.filter((b) => b.life > 0);
      raf = requestAnimationFrame(tick);
    };

    if (active) raf = requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, w, h);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [canvasRef, active]);
}

export default function JarvisReactor({ active = false, onClick }) {
  const canvasRef = useRef(null);
  useLightning(canvasRef, active);

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="jarvis-arc-reactor"
      aria-label="Activar Jarvis"
      className={`arc-reactor ${active ? "is-active" : ""}`}
    >
      <div className="arc-glow" />
      <ReactorSVG />
      <canvas ref={canvasRef} className="arc-canvas" data-testid="jarvis-arc-canvas" />
    </button>
  );
}
