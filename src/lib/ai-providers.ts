/**
 * The three AI assistants a household can connect to the cellar (MCP).
 * Pure data: the steps to connect each one, and how to open it with a
 * request already typed. Menu names change from time to time, so the steps
 * name the place, and the page says so.
 */
export type AiKey = "claude" | "chatgpt" | "gemini";

export type AiProvider = {
  name: string;
  /** Offered in "connect an AI". False where it can't be done from Israel today. */
  connectable: boolean;
  /**
   * The page the first connection step opens. The steps' words (and who can
   * connect it) live in the dictionaries under `aiSetup`, in both languages.
   */
  setupUrl: string | null;
  /** Opens a new chat; with the request typed in when the app supports it. */
  chatUrl: (request: string) => string;
  prefills: boolean;
};

// Checked against each company's help pages (26 Nov 2026). Sources:
// support.claude.com/en/articles/11176164, help.openai.com/en/articles/12584461,
// support.google.com/gemini/answer/17209137
export const AI_PROVIDERS: Record<AiKey, AiProvider> = {
  claude: {
    name: "Claude",
    connectable: true,
    setupUrl: "https://claude.ai/customize/connectors",
    chatUrl: (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}`,
    prefills: true,
  },
  chatgpt: {
    name: "ChatGPT",
    connectable: true,
    setupUrl: "https://chatgpt.com/plugins",
    chatUrl: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}`,
    prefills: true,
  },
  // Custom connections in Gemini are US-only and English-only for now, so
  // it is not offered; kept so a connection made elsewhere is recognised.
  gemini: {
    name: "Gemini",
    connectable: false,
    setupUrl: null,
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
