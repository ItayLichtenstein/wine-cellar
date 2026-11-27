import { describe, expect, it } from "vitest";
import { AI_PROVIDERS, CONNECTABLE, identifyAi } from "./ai-providers";

describe("identifyAi", () => {
  it("knows the three assistants by the name they register with", () => {
    expect(identifyAi("Claude")).toBe("claude");
    expect(identifyAi("ChatGPT Connector")).toBe("chatgpt");
    expect(identifyAi("OpenAI")).toBe("chatgpt");
    expect(identifyAi("Gemini")).toBe("gemini");
  });
  it("null for any other client", () => {
    expect(identifyAi("Test AI")).toBeNull();
  });
});

describe("who can connect", () => {
  it("offers Claude (recommended) and Gemini, not ChatGPT", () => {
    expect(CONNECTABLE).toEqual(["claude", "gemini"]);
    expect(AI_PROVIDERS.claude.recommended).toBe(true);
  });
  it("Claude's install link carries the name and address, encoded", () => {
    const link = AI_PROVIDERS.claude.setupUrl!("https://x.app/api/mcp", "מרתף יין");
    const q = new URL(link).searchParams;
    expect(q.get("modal")).toBe("add-custom-connector");
    expect(q.get("connectorName")).toBe("מרתף יין");
    expect(q.get("connectorUrl")).toBe("https://x.app/api/mcp");
  });
});

describe("chatUrl", () => {
  it("puts the request in the link, encoded", () => {
    expect(AI_PROVIDERS.claude.chatUrl("מה & איך?")).toBe(`https://claude.ai/new?q=${encodeURIComponent("מה & איך?")}`);
  });
  it("Gemini has no request in its link", () => {
    expect(AI_PROVIDERS.gemini.chatUrl("x")).toBe("https://gemini.google.com/app");
  });
});
