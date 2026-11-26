import { ImageResponse } from "next/og";

/**
 * The app icon, drawn in code (no image files to keep in sync): the
 * burgundy of the theme, and three bottles seen from the front, piled,
 * each with a year badge in one of the app's drink-window colors.
 * `padding` leaves the safe zone Android needs for maskable icons.
 */
export function appIcon(size: number, padding = 0.12): ImageResponse {
  const inner = size * (1 - padding * 2);
  const d = inner * 0.42; // one bottle (seen from the front, lying down)
  const bottle = (badge: string) => (
    <div
      style={{
        width: d,
        height: d,
        borderRadius: "50%",
        background: "#d9d2cb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 ${size * 0.012}px ${size * 0.03}px rgba(0,0,0,0.4)`,
      }}
    >
      <div style={{ width: d * 0.46, height: d * 0.28, borderRadius: d * 0.06, background: badge }} />
    </div>
  );
  // A little pile: one bottle resting on two, like a pile shelf in the app.
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#3a0f17" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {bottle("#2e9e4a")}
          <div style={{ display: "flex", gap: d * 0.06, marginTop: -d * 0.12 }}>
            {bottle("#4fc3d4")}
            {bottle("#f2a23c")}
          </div>
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
