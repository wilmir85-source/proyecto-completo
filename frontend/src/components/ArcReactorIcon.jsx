const COILS = Array.from({ length: 10 }, (_, i) => i * 36);

export const ArcReactorIcon = ({ className = "w-6 h-6", glow = true }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true"
    style={glow ? { filter: "drop-shadow(0 0 3px rgba(34,211,238,0.75))" } : undefined}>
    <defs>
      <radialGradient id="ari-core" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="55%" stopColor="#a5f3fc" />
        <stop offset="100%" stopColor="#0891b2" />
      </radialGradient>
    </defs>
    <circle cx="24" cy="24" r="21.5" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.9" />
    <circle cx="24" cy="24" r="17" fill="none" stroke="#22d3ee" strokeWidth="1.2" opacity="0.7" />
    {COILS.map((a) => (
      <rect key={a} x="22.4" y="5.2" width="3.2" height="4.6" rx="0.8" fill="#f97316" opacity="0.9" transform={`rotate(${a} 24 24)`} />
    ))}
    <circle cx="24" cy="24" r="11" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="24" cy="24" r="7.5" fill="url(#ari-core)" />
    {[0, 120, 240].map((a) => (
      <rect key={a} x="22.9" y="12.6" width="2.2" height="4" rx="0.6" fill="#e0f2fe" transform={`rotate(${a} 24 24)`} />
    ))}
  </svg>
);
