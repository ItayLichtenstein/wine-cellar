import type { FridgeView, PlacedBottle } from "./fridges";

/**
 * The fridges as they will look once move_bottle is done, so the bottle
 * jumps at once instead of after the round trip to the server. Same rule
 * as the database: a bottle already in the target slot swaps places.
 * Unknown bottle (e.g. one outside the fridge): no change, the refresh
 * shows it. Pure, so it is tested.
 */
export function applyMove(fridges: FridgeView[], bottleId: string, to: { zoneId: string; slot: number | null }): FridgeView[] {
  let moving: PlacedBottle | undefined;
  let fromZone = "";
  for (const f of fridges)
    for (const s of f.shelves)
      for (const z of s.zones) {
        const b = z.bottles.find((x) => x.id === bottleId);
        if (b) [moving, fromZone] = [b, z.id];
      }
  if (!moving) return fridges;
  const from = { zoneId: fromZone, slot: moving.slot };
  const other =
    to.slot === null
      ? undefined
      : fridges.flatMap((f) => f.shelves.flatMap((s) => s.zones)).find((z) => z.id === to.zoneId)?.bottles.find((b) => b.slot === to.slot && b.id !== bottleId);

  return fridges.map((f) => ({
    ...f,
    shelves: f.shelves.map((s) => ({
      ...s,
      zones: s.zones.map((z) => {
        if (z.id !== from.zoneId && z.id !== to.zoneId) return z;
        let bottles = z.bottles.filter((b) => b.id !== bottleId && b.id !== other?.id);
        if (z.id === to.zoneId) bottles = [...bottles, { ...moving!, slot: to.slot }];
        if (other && z.id === from.zoneId) bottles = [...bottles, { ...other, slot: from.slot }];
        return { ...z, bottles };
      }),
    })),
  }));
}
