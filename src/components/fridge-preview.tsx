"use client";

import type { Zone } from "@/lib/fridge-layout";
import { DRINK_STATES } from "@/lib/drink-state";
import type { PlacedBottle } from "@/lib/fridges";

/** A zone as drawn: from the setup form (no id/bottles) or from the database. */
type DrawnZone = Zone & { id?: string; bottles?: PlacedBottle[] };

/** A place the user picked: a row slot, or a stack (slot = null). */
export type Place = { zoneId: string; slot: number | null };

type Props = {
  shelves: { zones: DrawnZone[] }[];
  /** When set, empty slots and stacks with room become buttons. */
  onPick?: (place: Place) => void;
  /** Places already picked (shown highlighted). */
  picked?: Place[];
};

/**
 * Drawing of a fridge: one frame per shelf (top first), one line per zone.
 * Bottles are neutral; only the small year badge carries the drink-window
 * color (never red frames – red reads as "bad wine").
 */
export function FridgePreview({ shelves, onPick, picked = [] }: Props) {
  return (
    <ol className="flex flex-col gap-2 rounded-2xl bg-fridge p-3" aria-label="שרטוט המקרר">
      {shelves.map((shelf, i) => (
        <li key={i} className="flex items-start gap-2 rounded-lg bg-shelf p-2">
          <span className="w-5 shrink-0 pt-1 text-center text-xs text-on-fridge/60" aria-hidden="true">
            {i + 1}
          </span>
          <div className="flex flex-1 flex-col gap-1.5">
            {shelf.zones.map((zone, j) => (
              <ZoneLine key={zone.id ?? j} zone={zone} shelfNo={i + 1} onPick={onPick} picked={picked} />
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ZoneLine({
  zone,
  shelfNo,
  onPick,
  picked,
}: {
  zone: DrawnZone;
  shelfNo: number;
  onPick?: (p: Place) => void;
  picked: Place[];
}) {
  const bottles = zone.bottles ?? [];
  const pickedHere = picked.filter((p) => p.zoneId === zone.id);

  if (zone.kind === "stack") {
    const used = bottles.length + pickedHere.length;
    const canPick = onPick && zone.id && used < zone.capacity;
    const content = (
      <>
        <span>
          {zone.label || "ערימה"} · {used}/{zone.capacity}
        </span>
        <span className="flex flex-wrap gap-0.5">
          {bottles.map((b) => (
            <YearBadge key={b.id} bottle={b} />
          ))}
          {pickedHere.map((_, k) => (
            <span key={k} className="h-4 w-7 rounded-sm bg-on-fridge" aria-hidden="true" />
          ))}
        </span>
      </>
    );
    const className =
      "flex flex-wrap items-center gap-2 rounded-md border border-dashed border-on-fridge/40 px-2 py-1 text-xs text-on-fridge/80";
    return canPick ? (
      <button
        type="button"
        onClick={() => onPick({ zoneId: zone.id!, slot: null })}
        className={`${className} hover:border-on-fridge`}
        aria-label={`הוספה ל${zone.label || "ערימה"}, מדף ${shelfNo}`}
      >
        {content}
      </button>
    ) : (
      <div className={className}>{content}</div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1" title={zone.label}>
      {Array.from({ length: zone.capacity }, (_, k) => {
        const slot = k + 1;
        const bottle = bottles.find((b) => b.slot === slot);
        if (bottle) return <BottleSlot key={slot} bottle={bottle} />;

        const isPicked = pickedHere.some((p) => p.slot === slot);
        if (onPick && zone.id) {
          return (
            <button
              key={slot}
              type="button"
              onClick={() => onPick({ zoneId: zone.id!, slot })}
              aria-pressed={isPicked}
              aria-label={`מדף ${shelfNo}, ${zone.label}, מקום ${slot}`}
              className={`size-9 rounded-full border-2 ${
                isPicked ? "border-on-fridge bg-on-fridge" : "border-on-fridge/35 hover:border-on-fridge/80"
              }`}
            />
          );
        }
        return <span key={slot} className="size-9 rounded-full border-2 border-on-fridge/25" aria-hidden="true" />;
      })}
      {zone.label && <span className="ms-1 text-[10px] text-on-fridge/50">{zone.label}</span>}
    </div>
  );
}

/** An occupied row slot: a neutral bottle top with the colored year badge. */
function BottleSlot({ bottle }: { bottle: PlacedBottle }) {
  return (
    <span
      className="flex size-9 items-center justify-center rounded-full bg-[#d9d2cb]"
      title={`${bottle.title} · ${bottle.year ?? "NV"} · ${DRINK_STATES[bottle.state].label}`}
    >
      <YearBadge bottle={bottle} />
    </span>
  );
}

function YearBadge({ bottle }: { bottle: PlacedBottle }) {
  return (
    <span
      className="rounded-sm px-0.5 text-[10px] font-bold leading-4 text-black tabular-nums"
      style={{ backgroundColor: DRINK_STATES[bottle.state].color }}
    >
      {bottle.year ? String(bottle.year).slice(-2) : "NV"}
    </span>
  );
}
