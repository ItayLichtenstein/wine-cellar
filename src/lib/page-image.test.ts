import { describe, expect, it } from "vitest";
import { findPageImage } from "./page-image";

const page = "https://shop.example.com/wines/alon-2022";

describe("findPageImage", () => {
  it("reads og:image", () => {
    expect(findPageImage('<head><meta property="og:image" content="https://cdn.example.com/a.jpg"></head>', page)).toBe("https://cdn.example.com/a.jpg");
  });

  it("does not care about attribute order or quotes", () => {
    expect(findPageImage("<meta content='https://cdn.example.com/b.png' property='og:image' />", page)).toBe("https://cdn.example.com/b.png");
  });

  it("prefers the https variant, then og:image, then twitter:image", () => {
    const html =
      '<meta name="twitter:image" content="https://x.example.com/t.jpg"><meta property="og:image" content="https://x.example.com/o.jpg"><meta property="og:image:secure_url" content="https://x.example.com/s.jpg">';
    expect(findPageImage(html, page)).toBe("https://x.example.com/s.jpg");
    expect(findPageImage('<meta name="twitter:image" content="https://x.example.com/t.jpg">', page)).toBe("https://x.example.com/t.jpg");
  });

  it("resolves a relative address against the page and decodes &amp;", () => {
    expect(findPageImage('<meta property="og:image" content="/img/alon.jpg?w=800&amp;h=800">', page)).toBe("https://shop.example.com/img/alon.jpg?w=800&h=800");
  });

  it("falls back to link rel=image_src", () => {
    expect(findPageImage('<link rel="image_src" href="https://cdn.example.com/c.webp">', page)).toBe("https://cdn.example.com/c.webp");
  });

  it("skips non-https images and pages without one", () => {
    expect(findPageImage('<meta property="og:image" content="http://cdn.example.com/a.jpg">', page)).toBeNull();
    expect(findPageImage('<meta property="og:image" content="data:image/png;base64,AAA">', page)).toBeNull();
    expect(findPageImage("<html><head><title>Alon</title></head></html>", page)).toBeNull();
  });
});
