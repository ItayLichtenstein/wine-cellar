import { describe, expect, it } from "vitest";
import { AI_PROVIDERS, identifyAi } from "./ai-providers";

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

describe("chatUrl", () => {
  it("puts the request in the link, encoded", () => {
    expect(AI_PROVIDERS.claude.chatUrl("מה & איך?")).toBe(`https://claude.ai/new?q=${encodeURIComponent("מה & איך?")}`);
  });
  it("Gemini has no request in its link", () => {
    expect(AI_PROVIDERS.gemini.chatUrl("x")).toBe("https://gemini.google.com/app");
  });
});
