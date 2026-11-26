import { ImageResponse } from "next/og";
import { DRINK_STATES, type DrinkState } from "@/lib/drink-state";

// The picture in a shared link's preview: a little fridge, shelves of
// bottles with the app's year-badge colors. No text: the image renderer
// does not lay out right-to-left text, and the title already says it all.
export const alt = "מרתף יין";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SHELVES: DrinkState[][] = [
  ["now", "soon", "hold", "now", "young"],
  ["past", "now", "near", "soon", "hold"],
  ["hold", "young", "now", "past", "soon"],
];

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#3a0f17" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, padding: 34, borderRadius: 40, background: "#1c1716" }}>
          {SHELVES.map((shelf, i) => (
            <div key={i} style={{ display: "flex", gap: 18, padding: 18, borderRadius: 22, background: "#2b2321" }}>
              {shelf.map((state, j) => (
                <div
                  key={j}
                  style={{ width: 96, height: 96, borderRadius: 48, background: "#d9d2cb", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <div style={{ width: 44, height: 28, borderRadius: 6, background: DRINK_STATES[state].color, border: "2px solid rgba(0,0,0,0.25)" }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
