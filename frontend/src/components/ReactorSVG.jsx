import React from "react";

const COILS = Array.from({ length: 10 }, (_, i) => i * 36);
const BUMPS = Array.from({ length: 24 }, (_, i) => i * 15);
const ARMS = [0, 120, 240];

function Defs() {
  return (
    <defs>
      <linearGradient id="jr-metal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#e5e7eb" />
        <stop offset="35%" stopColor="#9ca3af" />
        <stop offset="55%" stopColor="#f3f4f6" />
        <stop offset="100%" stopColor="#6b7280" />
      </linearGradient>
      <linearGradient id="jr-copper" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#7c2d12" />
        <stop offset="30%" stopColor="#ea580c" />
        <stop offset="55%" stopColor="#fdba74" />
        <stop offset="80%" stopColor="#c2410c" />
        <stop offset="100%" stopColor="#7c2d12" />
      </linearGradient>
      <pattern id="jr-wind" width="4" height="1.6" patternUnits="userSpaceOnUse">
        <rect width="4" height="0.7" fill="rgba(60,15,5,0.55)" />
      </pattern>
      <radialGradient id="jr-light" cx="50%" cy="50%" r="50%">
        <stop offset="70%" stopColor="#0891b2" />
        <stop offset="85%" stopColor="#a5f3fc" />
        <stop offset="100%" stopColor="#0e7490" />
      </radialGradient>
      <radialGradient id="jr-core" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="45%" stopColor="#cffafe" />
        <stop offset="80%" stopColor="#22d3ee" />
        <stop offset="100%" stopColor="#0e7490" />
      </radialGradient>
      <pattern id="jr-hex" width="4" height="6.93" patternUnits="userSpaceOnUse" patternTransform="scale(0.9)">
        <path d="M2 0 L4 1.15 L4 3.46 L2 4.62 L0 3.46 L0 1.15 Z M2 4.62 L2 6.93" fill="none" stroke="rgba(8,145,178,0.45)" strokeWidth="0.35" />
      </pattern>
      <path id="jr-top" d="M 15 100 A 85 85 0 0 1 185 100" />
      <path id="jr-bottom" d="M 8 100 A 92 92 0 0 0 192 100" />
    </defs>
  );
}

function MetalRing() {
  return (
    <g>
      <circle cx="100" cy="100" r="89" fill="none" stroke="url(#jr-metal)" strokeWidth="18" />
      <circle cx="100" cy="100" r="98" fill="none" stroke="#4b5563" strokeWidth="0.8" />
      <circle cx="100" cy="100" r="80" fill="none" stroke="#374151" strokeWidth="1" />
      <g className="jr-text" fontSize="11.5" fontWeight="800" letterSpacing="1.6" textAnchor="middle">
        <text data-testid="reactor-text-top"><textPath href="#jr-top" startOffset="50%">MUNDO DE JOYAS</textPath></text>
        <text data-testid="reactor-text-bottom"><textPath href="#jr-bottom" startOffset="50%">JOYERÍA 3D</textPath></text>
      </g>
      <circle cx="11" cy="100" r="1.8" fill="#374151" />
      <circle cx="189" cy="100" r="1.8" fill="#374151" />
    </g>
  );
}

function CoilRing() {
  return (
    <g>
      <circle cx="100" cy="100" r="69" fill="none" stroke="url(#jr-light)" strokeWidth="20" className="jr-lightband" />
      <g className="jr-spin jr-spin-coils">
        {COILS.map((a) => (
          <g key={a} transform={`rotate(${a} 100 100)`}>
            <rect x="91" y="20" width="18" height="22" rx="1.5" fill="#1e293b" />
            <rect x="92" y="21.5" width="16" height="19" fill="url(#jr-copper)" />
            <rect x="92" y="21.5" width="16" height="19" fill="url(#jr-wind)" />
            <circle cx="89.5" cy="31" r="1.4" fill="#111827" />
            <circle cx="110.5" cy="31" r="1.4" fill="#111827" />
          </g>
        ))}
      </g>
    </g>
  );
}

function InnerRing() {
  return (
    <g>
      <circle cx="100" cy="100" r="57" fill="#0f172a" stroke="#64748b" strokeWidth="1.2" />
      <g className="jr-spin jr-spin-bumps">
        {BUMPS.map((a) => (
          <circle key={a} cx="100" cy="49" r="3" fill="#cbd5e1" stroke="#334155" strokeWidth="0.8" transform={`rotate(${a} 100 100)`} />
        ))}
      </g>
      <circle cx="100" cy="100" r="43" fill="none" stroke="#e2e8f0" strokeWidth="1" opacity="0.6" />
    </g>
  );
}

function Core() {
  return (
    <g className="jr-core">
      <circle cx="100" cy="100" r="40" fill="url(#jr-core)" />
      <circle cx="100" cy="100" r="22" fill="url(#jr-hex)" />
      <circle cx="100" cy="100" r="27" fill="none" stroke="#fde68a" strokeWidth="1" opacity="0.7" />
      <circle cx="100" cy="100" r="22" fill="none" stroke="#ffffff" strokeWidth="0.8" />
      {ARMS.map((a) => (
        <rect key={a} x="95" y="58" width="10" height="16" rx="1.5" fill="rgba(255,255,255,0.85)" stroke="#a5f3fc" strokeWidth="0.6" transform={`rotate(${a} 100 100)`} />
      ))}
    </g>
  );
}

export default function ReactorSVG() {
  return (
    <svg viewBox="0 0 200 200" className="jr-svg" aria-hidden="true">
      <Defs />
      <CoilRing />
      <InnerRing />
      <Core />
      <MetalRing />
    </svg>
  );
}
