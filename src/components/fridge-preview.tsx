"use client";

import type { Zone } from "@/lib/fridge-layout";
import { DRINK_STATES } from "@/lib/drink-state";
import type { PlacedBottle } from "@/lib/fridges";

/** A zone as drawn: from the setup form (no id/bottles) or from the database. */
type DrawnZone = Zone & { id?: string; bottles?: PlacedBottle[] };

/** A place the user picked: a row slot, or a stack (slot = null). */
export type Place = { zoneId: string; slot: number | null };

/** "labels": wine name + year in each slot (the default). "dots": year only, compact. */
export type FridgeViewMode = "labels" | "dots";

// Half a slot plus half the gap, per view: shifts the shorter of two
// staggered rows so each of its bottles sits between two of the other row
// (bottles on a shelf lie head to tail, 5 at the back and 4 in front).
const HALF_STEP: Record<FridgeViewMode, string> = {
  labels: "ms-[1.625rem] sm:ms-[2.125rem]", // (3rem + 0.25rem) / 2, (4rem + 0.25rem) / 2
  dots: "ms-[1.25rem] sm:ms-[1.5rem]", //      (2.25rem + 0.25rem) / 2, (2.75rem + 0.25rem) / 2
};

/** Index of the row to shift: two rows on a shelf, one shorter by exactly one. */
export function staggeredZone(zones: { kind: string; capacity: number }[]): number | null {
  if (zones.length !== 2 || zones.some((z) => z.kind !== "row")) return null;
  const [a, b] = zones;
  if (Math.abs(a.capacity - b.capacity) !== 1) return null;
  return a.capacity < b.capacity ? 0 : 1;
}

// Slot size per view. On a phone labels are 3rem wide so 5 slots still fit
// a row; from the sm breakpoint (640px) there is room for bigger slots.
const SLOT_SHAPE: Record<FridgeViewMode, string> = {
  labels: "h-11 w-12 sm:h-14 sm:w-16 rounded-lg",
  dots: "size-9 sm:size-11 rounded-full",
};

type Props = {
  shelves: { zones: DrawnZone[] }[];
  /** When set, empty slots and stacks with room become buttons. */
  onPick?: (place: Place) => void;
  /** Places already picked (shown highlighted). */
  picked?: Place[];
  /** When set, bottles become buttons (open the card, or swap while moving). */
  onBottleClick?: (bottle: PlacedBottle, place: Place) => void;
  /** The bottle being moved, drawn highlighted. */
  activeBottleId?: string;
  view?: FridgeViewMode;
};

/**
 * Drawing of a fridge: one frame per shelf (top first), one line per zone.
 * Bottles are neutral; only the small year badge carries the drink-window
 * color (never red frames – red reads as "bad wine").
 */
export function FridgePreview({ shelves, onPick, picked = [], onBottleClick, activeBottleId, view = "labels" }: Props) {
  return (
    // w-fit: the fridge is as wide as its widest shelf, not the whole page.
    <ol className="mx-auto flex w-fit min-w-72 max-w-full flex-col gap-2 rounded-2xl bg-fridge p-3" aria-label="שרטוט המקרר">
      {shelves.map((shelf, i) => (
        <li key={i} className="flex items-start gap-2 rounded-lg bg-shelf p-2">
          <span className="w-5 shrink-0 pt-1 text-center text-xs text-on-fridge/60" aria-hidden="true">
            {i + 1}
          </span>
          <div className="flex flex-1 flex-col gap-1.5">
            {shelf.zones.map((zone, j) => (
              <ZoneLine
                key={zone.id ?? j}
                zone={zone}
                shifted={staggeredZone(shelf.zones) === j}
                shelfNo={i + 1}
                onPick={onPick}
                picked={picked}
                onBottleClick={onBottleClick}
                activeBottleId={activeBottleId}
                view={view}
              />
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ZoneLine({
  zone,
  shifted = false,
  shelfNo,
  onPick,
  picked,
  onBottleClick,
  activeBottleId,
  view,
}: {
  zone: DrawnZone;
  shifted?: boolean;
  shelfNo: number;
  onPick?: (p: Place) => void;
  picked: Place[];
  onBottleClick?: (bottle: PlacedBottle, place: Place) => void;
  activeBottleId?: string;
  view: FridgeViewMode;
}) {
  const shape = SLOT_SHAPE[view];
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
          {bottles.map((b) =>
            onBottleClick && zone.id ? (
              <button
                key={b.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onBottleClick(b, { zoneId: zone.id!, slot: null });
                }}
                aria-label={`${b.title} ${b.year ?? "NV"}`}
                className={b.id === activeBottleId ? "rounded-sm ring-2 ring-on-fridge" : ""}
              >
                <StackBottle bottle={b} view={view} />
              </button>
            ) : (
              <StackBottle key={b.id} bottle={b} view={view} />
            ),
          )}
          {pickedHere.map((_, k) => (
            <span key={k} className="h-4 w-7 rounded-sm bg-on-fridge" aria-hidden="true" />
          ))}
        </span>
      </>
    );
    // w-0 min-w-full: a stack wraps to the width the rows set, instead of
    // stretching the whole fridge (the fridge itself has a minimum width).
    const className =
      "flex w-0 min-w-full flex-wrap items-center gap-2 rounded-md border border-dashed border-on-fridge/40 px-2 py-1 text-xs text-on-fridge/80";
    return canPick && !onBottleClick ? (
      <button
        type="button"
        onClick={() => onPick({ zoneId: zone.id!, slot: null })}
        className={`${className} hover:border-on-fridge`}
        aria-label={`הוספה ל${zone.label || "ערימה"}, מדף ${shelfNo}`}
      >
        {content}
      </button>
    ) : canPick ? (
      // Bottles inside are buttons, so the stack itself can't be one.
      <div className={className}>
        {content}
        <button
          type="button"
          onClick={() => onPick({ zoneId: zone.id!, slot: null })}
          className="rounded-full border border-on-fridge/50 px-2 leading-5 hover:border-on-fridge"
          aria-label={`הוספה ל${zone.label || "ערימה"}, מדף ${shelfNo}`}
        >
          +
        </button>
      </div>
    ) : (
      <div className={className}>{content}</div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-1 ${shifted ? HALF_STEP[view] : ""}`} title={zone.label}>
      {Array.from({ length: zone.capacity }, (_, k) => {
        const slot = k + 1;
        const bottle = bottles.find((b) => b.slot === slot);
        if (bottle) {
          return onBottleClick && zone.id ? (
            <button
              key={slot}
              type="button"
              onClick={() => onBottleClick(bottle, { zoneId: zone.id!, slot })}
              className={`${shape} ${bottle.id === activeBottleId ? "ring-2 ring-on-fridge ring-offset-2 ring-offset-shelf" : ""}`}
              aria-label={`${bottle.title} ${bottle.year ?? "NV"}, מדף ${shelfNo}, מקום ${slot}`}
            >
              <BottleSlot bottle={bottle} view={view} />
            </button>
          ) : (
            <BottleSlot key={slot} bottle={bottle} view={view} />
          );
        }

        const isPicked = pickedHere.some((p) => p.slot === slot);
        if (onPick && zone.id) {
          return (
            <button
              key={slot}
              type="button"
              onClick={() => onPick({ zoneId: zone.id!, slot })}
              aria-pressed={isPicked}
              aria-label={`מדף ${shelfNo}, ${zone.label}, מקום ${slot}`}
              className={`${shape} border-2 ${
                isPicked ? "border-on-fridge bg-on-fridge" : "border-on-fridge/35 hover:border-on-fridge/80"
              }`}
            />
          );
        }
        return <span key={slot} className={`${shape} border-2 border-on-fridge/25`} aria-hidden="true" />;
      })}
      {/* In the labels view the slots fill the row; the back row is always drawn first. */}
      {zone.label && view === "dots" && <span className="ms-1 text-[10px] text-on-fridge/50">{zone.label}</span>}
    </div>
  );
}

/**
 * An occupied row slot: a neutral bottle with the colored year badge.
 * In the labels view the wine's name sits above the badge.
 */
function BottleSlot({ bottle, view }: { bottle: PlacedBottle; view: FridgeViewMode }) {
  return (
    <span
      className={`flex flex-col items-center justify-center gap-0.5 bg-[#d9d2cb] ${SLOT_SHAPE[view]}`}
      title={`${bottle.title} · ${bottle.year ?? "NV"} · ${DRINK_STATES[bottle.state].label}`}
    >
      {view === "labels" && <WineLabel text={bottle.label} className="w-full px-0.5" />}
      <YearBadge bottle={bottle} />
    </span>
  );
}

/** A bottle inside a stack: the badge, plus the name in the labels view. */
function StackBottle({ bottle, view }: { bottle: PlacedBottle; view: FridgeViewMode }) {
  if (view === "dots") return <YearBadge bottle={bottle} />;
  return (
    <span className="flex items-center gap-1 rounded bg-[#d9d2cb] py-0.5 ps-1 pe-0.5">
      <WineLabel text={bottle.label} className="max-w-16" />
      <YearBadge bottle={bottle} />
    </span>
  );
}

/** One line of wine name, cut with "…" when too long. dir=auto: Hebrew or Latin. */
function WineLabel({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span dir="auto" className={`truncate text-center text-[9px] font-medium leading-tight text-black ${className}`}>
      {text}
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
