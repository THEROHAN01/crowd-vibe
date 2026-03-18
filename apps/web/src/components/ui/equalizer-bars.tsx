export default function EqualizerBars() {
  return (
    <div className="flex items-end gap-0.5 h-4" aria-hidden="true">
      <span className="w-[3px] rounded-full bg-accent animate-equalize" style={{ animationDelay: "0s" }} />
      <span className="w-[3px] rounded-full bg-accent animate-equalize" style={{ animationDelay: "0.2s" }} />
      <span className="w-[3px] rounded-full bg-accent animate-equalize" style={{ animationDelay: "0.4s" }} />
    </div>
  );
}
