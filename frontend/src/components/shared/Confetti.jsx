const COLORS = ["#17b8ae", "#2467e6", "#f2b73d", "#f472b6", "#34d399"];
const PIECES = Array.from({ length: 24 }, (_, i) => ({
  left: Math.random() * 100,
  delay: Math.random() * 0.3,
  duration: 1.1 + Math.random() * 0.6,
  color: COLORS[i % COLORS.length],
  rotate: Math.random() * 360,
}));

// Fixed-position, non-interactive burst that plays once and removes
// itself from layout entirely (pointer-events: none) -- nothing else on
// the page needs to account for it.
export default function Confetti() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {PIECES.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 h-2 w-2 rounded-sm"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
