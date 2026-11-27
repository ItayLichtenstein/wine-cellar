/**
 * The three AI assistants a household can connect to the cellar (MCP).
 * Pure data: the steps to connect each one, and how to open it with a
 * request already typed. Menu names change from time to time, so the steps
 * name the place, and the page says so.
 */
export type AiKey = "claude" | "chatgpt" | "gemini";

export type AiProvider = {
  name: string;
  /**
   * Offered in "connect an AI". False where a regular (free or personal)
   * account can't connect it today: ChatGPT allows custom connections only on
   * work plans, so it is kept just to recognise a connection made there.
   */
  connectable: boolean;
  /** Shown first, with a "recommended" tag: works on any account, also on the phone. */
  recommended: boolean;
  /**
   * The page the first connection step opens, given our MCP address and the
   * name to show. The steps' words (and who can connect it) live in the
   * dictionaries under `ai.setup`, in both languages.
   */
  setupUrl: ((mcpUrl: string, name: string) => string) | null;
  /** Opens a new chat; with the request typed in when the app supports it. */
  chatUrl: (request: string) => string;
  prefills: boolean;
};

// Checked 27 Nov 2026 (research_notes/חיבור בינה מלאכותית אישית). Sources:
// support.claude.com/en/articles/11176164 (free accounts get one custom
// connector), help.openai.com/en/articles/12584461 (custom MCP only on
// Business/Enterprise/Edu), Gemini "custom apps" (personal accounts, web
// setup in English, Keep Activity on; only secondary sources so far).
export const AI_PROVIDERS: Record<AiKey, AiProvider> = {
  claude: {
    name: "Claude",
    connectable: true,
    recommended: true,
    // Claude's own install link: opens "add custom connector" already filled in.
    setupUrl: (url, name) =>
      `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=${encodeURIComponent(name)}&connectorUrl=${encodeURIComponent(url)}`,
    chatUrl: (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}`,
    prefills: true,
  },
  chatgpt: {
    name: "ChatGPT",
    connectable: false,
    recommended: false,
    setupUrl: null,
    chatUrl: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}`,
    prefills: true,
  },
  gemini: {
    name: "Gemini",
    connectable: true,
    recommended: false,
    setupUrl: () => "https://gemini.google.com/app",
    chatUrl: () => "https://gemini.google.com/app",
    prefills: false,
  },
};

export const AI_KEYS = Object.keys(AI_PROVIDERS) as AiKey[];

/** The assistants offered in "connect an AI". */
export const CONNECTABLE = AI_KEYS.filter((k) => AI_PROVIDERS[k].connectable);


/**
 * Which assistant a connected OAuth client is. Clients name themselves when
 * they register (dynamic registration), so this is a best guess by name;
 * null = some other MCP client, shown by its own name.
 */
export function identifyAi(clientName: string): AiKey | null {
  const n = clientName.toLowerCase();
  if (n.includes("claude") || n.includes("anthropic")) return "claude";
  if (n.includes("chatgpt") || n.includes("openai")) return "chatgpt";
  if (n.includes("gemini") || n.includes("google")) return "gemini";
  return null;
}
