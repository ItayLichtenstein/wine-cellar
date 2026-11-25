import type { AiKey } from "@/lib/ai-providers";

/**
 * Small marks for the three assistants, drawn in the app's own simple
 * style (not the official logo files): Claude's orange burst, ChatGPT's
 * knot, Gemini's four-pointed sparkle. They only say "works with".
 */
export function AiLogo({ ai, className = "size-9" }: { ai: AiKey; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full shadow-sm ring-2 ring-surface ${BG[ai]} ${className}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[62%]">
        {MARK[ai]}
      </svg>
    </span>
  );
}

const BG: Record<AiKey, string> = {
  claude: "bg-[#f4ede4]",
  chatgpt: "bg-[#101010]",
  gemini: "bg-white",
};

// Claude: twelve rays around the centre.
const rays = Array.from({ length: 12 }, (_, i) => i * 30);

const MARK: Record<AiKey, React.ReactNode> = {
  claude: (
    <g stroke="#d97757" strokeWidth={2.6} strokeLinecap="round">
      {rays.map((deg, i) => (
        <line key={deg} x1="12" y1="12" x2="12" y2={i % 2 ? 3.5 : 2} transform={`rotate(${deg} 12 12)`} />
      ))}
    </g>
  ),
  chatgpt: (
    <g fill="none" stroke="#fff" strokeWidth={1.6}>
      {[0, 60, 120].map((deg) => (
        <rect key={deg} x="7.5" y="3" width="9" height="18" rx="4.5" transform={`rotate(${deg} 12 12)`} />
      ))}
    </g>
  ),
  gemini: (
    <>
      <defs>
        <linearGradient id="gemini-sparkle" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4285f4" />
          <stop offset="0.6" stopColor="#9b72cb" />
          <stop offset="1" stopColor="#d96570" />
        </linearGradient>
      </defs>
      <path d="M12 1.5c.6 5.4 5.1 9.9 10.5 10.5-5.4.6-9.9 5.1-10.5 10.5C11.4 17.1 6.9 12.6 1.5 12 6.9 11.4 11.4 6.9 12 1.5Z" fill="url(#gemini-sparkle)" />
    </>
  ),
};

/** The three marks overlapping, as on an "available on" badge. */
export function AiLogoStack({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center ${className}`} aria-hidden="true">
      {(["claude", "chatgpt", "gemini"] as const).map((ai, i) => (
        <AiLogo key={ai} ai={ai} className={`size-8 ${i > 0 ? "-ms-2" : ""}`} />
      ))}
    </span>
  );
}
