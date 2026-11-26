"use client";

import { frontZone, type Zone } from "@/lib/fridge-layout";
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

/**
 * Index of the zone to shift half a slot: two rows on a shelf where one is
 * shorter by exactly one, or the two layers of a pile (the upper layer
 * rests in the grooves of the lower one; with equal layers the upper moves).
 */
export function staggeredZone(zones: { kind: string; capacity: number }[]): number | null {
  if (isPile(zones)) {
    const diff = zones[0].capacity - zones[1].capacity;
    return Math.abs(diff) > 1 ? null : diff > 0 ? 1 : 0;
  }
  if (zones.length !== 2 || zones.some((z) => z.kind !== "row")) return null;
  const diff = zones[0].capacity - zones[1].capacity;
  if (Math.abs(diff) !== 1) return null;
  return diff < 0 ? 0 : 1;
}

/**
 * A pile: the shelf starts with two stack layers (upper, lower), maybe
 * with a row in front ("בחזית"). Drawn as bottles lying on each other.
 */
function isPile(zones: { kind: string }[]): boolean {
  return zones.length >= 2 && zones[0].kind === "stack" && zones[1].kind === "stack";
}

// Slot size per view. On a phone labels are 3rem wide so 5 slots still fit
// a row; from the sm breakpoint (640px) there is room for bigger slots.
const SLOT_SHAPE: Record<FridgeViewMode, string> = {
  labels: "h-14 w-12 sm:h-20 sm:w-16 rounded-lg", // portrait, like a label
  dots: "size-9 sm:size-11 rounded-full",
};

type Props = {
  shelves: { zones: DrawnZone[] }[];
  /** When set, empty slots and stacks with room become buttons. */
  onPick?: (place: Place) => void;
  /** Places already picked (shown highlighted). */
  picked?: Place[];
  /** Tapping a picked place in a pile un-picks it (row slots toggle through onPick). */
  onUnpick?: (place: Place) => void;
  /** When set, bottles become buttons (open the card, or swap while moving). */
  onBottleClick?: (bottle: PlacedBottle, place: Place) => void;
  /** The bottle being moved, drawn highlighted. */
  activeBottleId?: string;
  view?: FridgeViewMode;
  /** Visitors: draw only the bottles, no empty places or empty shelves. */
  hideEmpty?: boolean;
};

/**
 * Drawing of a fridge: one frame per shelf (top first), one line per zone.
 * Bottles are neutral; only the small year badge carries the drink-window
 * color (never red frames – red reads as "bad wine").
 */
export function FridgePreview({ shelves, onPick, picked = [], onUnpick, onBottleClick, activeBottleId, view = "labels", hideEmpty = false }: Props) {
  // Visitors (friends, a view link) care about the bottles, not the free
  // places: only shelves and rows that hold something, packed together.
  const shown = shelves
    .map((shelf, i) => ({ shelf, no: i + 1 }))
    .filter(({ shelf }) => !hideEmpty || shelf.zones.some((z) => (z.bottles ?? []).length > 0));
  if (shown.length === 0) return <p className="text-center text-sm text-muted">המקרר ריק כרגע</p>;
  return (
    // w-fit: the fridge is as wide as its widest shelf, not the whole page.
    <ol className="mx-auto flex w-fit min-w-72 max-w-full touch-manipulation flex-col gap-2 rounded-2xl bg-fridge p-3 select-none [-webkit-touch-callout:none]" aria-label="שרטוט המקרר">
      {shown.map(({ shelf, no }) => (
        <li key={no} className="wood flex items-start gap-2 rounded-lg p-2">
          <span className="w-5 shrink-0 pt-1 text-center text-xs text-on-fridge/60" aria-hidden="true">
            {no}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {shelf.zones.map((zone, j) => (
              hideEmpty && (zone.bottles ?? []).length === 0 ? null : (
              <ZoneLine
                key={zone.id ?? j}
                zone={zone}
                hideEmpty={hideEmpty}
                shifted={!hideEmpty && staggeredZone(shelf.zones) === j}
                // A pile: the upper layer is shifted half a bottle and sits close above the lower one.
                layer={isPile(shelf.zones) && j < 2 ? (j === 0 ? "upper" : "lower") : undefined}
                front={frontZone(shelf.zones) === zone}
                shelfNo={no}
                onPick={onPick}
                onUnpick={onUnpick}
                picked={picked}
                onBottleClick={onBottleClick}
                activeBottleId={activeBottleId}
                view={view}
              />
              )
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

type Cell = { bottle?: PlacedBottle; picked: boolean; place: Place | null; slot: number };

function ZoneLine({
  zone,
  shifted = false,
  layer,
  front = false,
  shelfNo,
  onPick,
  onUnpick,
  picked,
  onBottleClick,
  activeBottleId,
  view,
  hideEmpty = false,
}: {
  zone: DrawnZone;
  hideEmpty?: boolean;
  shifted?: boolean;
  layer?: "upper" | "lower";
  /** Bottles lying across the front of the shelf: set apart by a dashed line. */
  front?: boolean;
  shelfNo: number;
  onPick?: (p: Place) => void;
  onUnpick?: (p: Place) => void;
  picked: Place[];
  onBottleClick?: (bottle: PlacedBottle, place: Place) => void;
  activeBottleId?: string;
  view: FridgeViewMode;
}) {
  // A pile layer never wraps (that would break the picture): its bottles shrink instead.
  const shape = layer ? `${SLOT_SHAPE[view]} min-w-0` : SLOT_SHAPE[view];
  const bottles = zone.bottles ?? [];
  const pickedHere = picked.filter((p) => p.zoneId === zone.id);
  const isStack = zone.kind === "stack";

  // A row has numbered places. A stack has none: its bottles fill it from
  // the start, then the places just picked, then empty room.
  const cells: Cell[] = Array.from({ length: Math.max(zone.capacity, isStack ? bottles.length : 0) }, (_, k) => {
    const slot = k + 1;
    const place = zone.id ? { zoneId: zone.id, slot: isStack ? null : slot } : null;
    if (isStack) return { bottle: bottles[k], picked: k >= bottles.length && k < bottles.length + pickedHere.length, place, slot };
    return { bottle: bottles.find((b) => b.slot === slot), picked: pickedHere.some((p) => p.slot === slot), place, slot };
  });
  const where = isStack ? `${zone.label || "ערימה"}, מדף ${shelfNo}` : [`מדף ${shelfNo}`, zone.label, "מקום"].filter(Boolean).join(", ");
  const layerClass =
    layer === "lower" ? "-mt-1" : front ? "mt-0.5 border-t border-dashed border-on-fridge/30 pt-1.5" : "";

  return (
    <div
      className={`flex items-center gap-1 ${layer ? "flex-nowrap" : "flex-wrap"} ${shifted ? HALF_STEP[view] : ""} ${layerClass}`}
      title={zone.label}
    >
      {cells.map(({ bottle, picked: isPicked, place, slot }) => {
        if (!bottle && hideEmpty) return null;
        if (bottle) {
          return onBottleClick && place ? (
            <button
              key={slot}
              type="button"
              onClick={() => onBottleClick(bottle, place)}
              className={`${shape} ${bottle.id === activeBottleId ? "ring-2 ring-on-fridge ring-offset-2 ring-offset-shelf" : ""}`}
              aria-label={`${bottle.title} ${bottle.year ?? "NV"}, ${isStack ? where : `${where} ${slot}`}`}
            >
              <BottleSlot bottle={bottle} view={view} shape={`${shape} !w-full`} />
            </button>
          ) : (
            <BottleSlot key={slot} bottle={bottle} view={view} shape={shape} />
          );
        }
        // Un-picking: a row slot toggles through onPick; a pile place has no number, so it needs onUnpick.
        const action = !place ? undefined : isPicked ? (isStack ? onUnpick : onPick) : onPick;
        if (action && place) {
          return (
            <button
              key={slot}
              type="button"
              onClick={() => action(place)}
              aria-pressed={isPicked}
              aria-label={isStack ? `${isPicked ? "ביטול בחירה" : "מקום פנוי"}, ${where}` : `${where} ${slot}`}
              className={`${shape} border-2 ${
                isPicked ? "border-on-fridge bg-on-fridge" : "border-on-fridge/35 bg-slot hover:border-on-fridge/80"
              }`}
            />
          );
        }
        return (
          <span
            key={slot}
            className={`${shape} border-2 ${isPicked ? "border-on-fridge bg-on-fridge" : "border-on-fridge/25 bg-slot"}`}
            aria-hidden="true"
          />
        );
      })}
      {/* In the labels view the slots fill the row; the back row is always drawn first. */}
      {zone.label && view === "dots" && <span className="ms-1 text-[10px] text-on-fridge/50">{zone.label}</span>}
    </div>
  );
}

/**
 * An occupied row slot with the colored year badge. In the labels view it
 * shows the label photo; without one, the wine's name.
 */
function BottleSlot({ bottle, view, shape = SLOT_SHAPE[view] }: { bottle: PlacedBottle; view: FridgeViewMode; shape?: string }) {
  return (
    <span
      className={`relative flex flex-col items-center justify-center gap-0.5 overflow-hidden bg-[#d9d2cb] ${shape}`}
      title={`${bottle.title} · ${bottle.year ?? "NV"} · ${DRINK_STATES[bottle.state].label}`}
    >
      {view === "labels" && bottle.thumb ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- a 4KB data: URL; next/image adds nothing here */}
          <img src={bottle.thumb} alt="" className="absolute inset-0 size-full object-cover" />
          <span className="absolute bottom-0.5 end-0.5 shadow-sm">
            <YearBadge bottle={bottle} />
          </span>
        </>
      ) : (
        <>
          {view === "labels" && <WineLabel text={bottle.label} className="w-full px-0.5" />}
          <YearBadge bottle={bottle} />
        </>
      )}
    </span>
  );
}

/** Up to two lines of text, cut with "…" when too long. dir=auto: Hebrew or Latin. */
function WineLabel({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span dir="auto" className={`line-clamp-2 break-words text-center text-[9px] font-medium leading-tight text-black ${className}`}>
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
