/**
 * Thin outline icons (24×24, stroke = text color, no fill), one style for the
 * whole app instead of emoji: emoji differ in size and color per phone and
 * look busy next to the burgundy theme.
 */
const PATHS = {
  fridge: "M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm-1 7h12M9 6v2m0 5v3",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  stats: "M4 20h16M7 16v-5m5 5V6m5 10v-8",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  wish: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
  glass: "M8 3h8l-.4 5.5a3.6 3.6 0 0 1-7.2 0L8 3Zm4 9.2V20m-3.5 0h7",
  sparkle: "M12 3.5l1.7 4.8 4.8 1.7-4.8 1.7L12 16.5l-1.7-4.8L5.5 10l4.8-1.7L12 3.5ZM18 15l.7 1.8 1.8.7-1.8.7L18 20l-.7-1.8-1.8-.7 1.8-.7L18 15Z",
  people: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0m1.5-16.2a3.5 3.5 0 0 1 0 6.9M21 20a6 6 0 0 0-3.5-5.5",
  sliders: "M4 7h9m4 0h3M4 17h3m4 0h9M15 5v4M9 15v4",
  moon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z",
  phone: "M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm3 15h2",
  book: "M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5m0-13C14 5 17 4.5 20 5v13c-3-.5-6 0-8 1.5m0-13v13",
} as const;

export type IconName = keyof typeof PATHS;

export function LineIcon({ name, className = "size-6", strokeWidth = 1.7 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
