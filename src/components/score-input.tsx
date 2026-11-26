"use client";

/**
 * A score from 1.0 to 5.0, one decimal (the database stores numeric(2,1)).
 * A big number to read, a slider to set it quickly, and −/+ for 0.1 steps.
 * The value is a string ("" = no score yet), like the forms that use it.
 */
export function ScoreInput({ value, onChange, label = "ציון" }: { value: string; onChange: (v: string) => void; label?: string }) {
  const n = value === "" ? null : Number(value);
  const set = (x: number) => onChange((Math.round(Math.min(5, Math.max(1, x)) * 10) / 10).toFixed(1));
  const button = "size-10 shrink-0 rounded-full border border-muted/40 text-xl leading-none disabled:opacity-40";

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-background p-3" role="group" aria-label={label}>
      {/* Left to right like the slider: − by the 1, + by the 5. */}
      <div className="flex items-center gap-3" dir="ltr">
        <button type="button" className={button} onClick={() => set((n ?? 3) - 0.1)} disabled={n !== null && n <= 1} aria-label="פחות 0.1">
          −
        </button>
        <output className="relative flex-1 text-center tabular-nums" aria-live="polite">
          {n === null ? (
            <span className="text-muted">בלי ציון</span>
          ) : (
            <>
              <span className="text-3xl font-bold">{n.toFixed(1)}</span>
              <span className="text-sm text-muted"> / 5</span>
              <Cheer score={n} />
            </>
          )}
        </output>
        <button type="button" className={button} onClick={() => set((n ?? 3) + 0.1)} disabled={n !== null && n >= 5} aria-label="יותר 0.1">
          +
        </button>
      </div>
      {/* dir=ltr: 1 on the left, 5 on the right, like any scale with numbers. */}
      <input
        type="range"
        min={1}
        max={5}
        step={0.1}
        dir="ltr"
        value={n ?? 3}
        onChange={(e) => set(Number(e.target.value))}
        aria-label={label}
        className={`w-full accent-accent ${n === null ? "opacity-50" : ""}`}
      />
      <div className="flex justify-between text-xs text-muted" dir="ltr" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((k) => (
          <span key={k}>{k}</span>
        ))}
      </div>
      {n !== null && (
        <button type="button" onClick={() => onChange("")} className="self-start text-xs text-muted underline underline-offset-2">
          בלי ציון
        </button>
      )}
    </div>
  );
}

/**
 * A little joy for a great bottle: a star pops in from 4.0, and from 4.5
 * a party popper with a burst of sparks. Keyed by level, so it plays once each
 * time the score crosses into a level, not on every 0.1 step. Motion is
 * skipped for people who ask their device for less of it.
 */
function Cheer({ score }: { score: number }) {
  const level = score >= 4.5 ? "fireworks" : score >= 4 ? "star" : null;
  if (!level) return null;
  return (
    <span key={level} className="relative ms-2 inline-block align-middle" aria-hidden="true">
      <span className="cheer-pop inline-block text-2xl">{level === "fireworks" ? "🎉" : "⭐"}</span>
      {level === "fireworks" &&
        [0, 60, 120, 180, 240, 300].map((deg) => (
          <span key={deg} className="cheer-spark absolute start-1/2 top-1/2 size-1.5 rounded-full bg-accent" style={{ "--deg": `${deg}deg` } as React.CSSProperties} />
        ))}
    </span>
  );
}
