import type { Shelf, Zone } from "@/lib/fridge-layout";
import { shelfCapacity } from "@/lib/fridge-layout";

/**
 * A simple drawing of a fridge layout: one frame per shelf (top first),
 * one line per zone. Rows show their slots, stacks show their capacity.
 * Empty slots are neutral rings – never red (red reads as "bad wine").
 */
export function FridgePreview({ shelves }: { shelves: Shelf[] }) {
  return (
    <ol className="flex flex-col gap-2 rounded-2xl bg-fridge p-3" aria-label="שרטוט המקרר">
      {shelves.map((shelf, i) => (
        <li key={i} className="flex items-start gap-2 rounded-lg bg-shelf p-2">
          <span className="w-6 shrink-0 pt-0.5 text-center text-xs text-on-fridge/60" aria-hidden="true">
            {i + 1}
          </span>
          <div className="flex flex-1 flex-col gap-1.5">
            {shelf.zones.map((zone, j) => (
              <ZoneLine key={j} zone={zone} />
            ))}
          </div>
          <span className="sr-only">
            מדף {i + 1}: {shelfCapacity(shelf)} בקבוקים
          </span>
        </li>
      ))}
    </ol>
  );
}

function ZoneLine({ zone }: { zone: Zone }) {
  if (zone.kind === "stack") {
    return (
      <div className="flex items-center gap-2 text-xs text-on-fridge/80">
        <span className="rounded-md border border-dashed border-on-fridge/40 px-2 py-1">
          {zone.label || "ערימה"} · עד {zone.capacity}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1" title={zone.label}>
      {Array.from({ length: zone.capacity }, (_, k) => (
        <span key={k} className="size-4 rounded-full border-2 border-on-fridge/35" aria-hidden="true" />
      ))}
      {zone.label && <span className="ms-1 text-[10px] text-on-fridge/50">{zone.label}</span>}
    </div>
  );
}
