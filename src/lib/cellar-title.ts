// "המרתף של נועה ויונתן" – the cellar's title from its members' names.
// Pure, so the Hebrew grammar is tested.

/**
 * Hebrew "and" is a prefix: "ויונתן". Before a name that does not start
 * with a Hebrew letter it gets a maqaf, so it stays readable: "ו־Maya".
 */
function and(name: string): string {
  return /^[א-ת]/.test(name) ? `ו${name}` : `ו־${name}`;
}

/** The cellar's own name if it has one, else the title from its full members' names. */
export function cellarTitle(names: string[], customName?: string | null): string {
  if (customName?.trim()) return customName.trim();
  const list = names.map((n) => n.trim()).filter(Boolean);
  if (list.length === 0) return "מרתף יין";
  if (list.length === 1) return `המרתף של ${list[0]}`;
  return `המרתף של ${list.slice(0, -1).join(", ")} ${and(list.at(-1)!)}`;
}
