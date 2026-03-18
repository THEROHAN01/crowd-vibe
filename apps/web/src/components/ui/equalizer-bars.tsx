export default function EqualizerBars() {
  return (
    <div className="flex items-end gap-0.5 h-4" aria-hidden="true">
      <span className="w-[3px] rounded-full bg-accent animate-equalize" style={{ animationDelay: "0s" }} />
      <span className="w-[3px] rounded-full bg-accent animate-equalize" style={{ animationDelay: "0.2s" }} />
      <span className="w-[3px] rounded-full bg-accent animate-equalize" style={{ animationDelay: "0.4s" }} />
      <style>{`
        @keyframes equalize {
          0%, 100% { height: 4px; }
          50% { height: 16px; }
        }
        .animate-equalize {
          animation: equalize 0.8s ease-in-out infinite alternate;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-equalize {
            animation: none;
            height: 8px;
          }
        }
      `}</style>
    </div>
  );
}
