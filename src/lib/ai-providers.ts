/**
 * The three AI assistants a household can connect to the cellar (MCP).
 * Pure data: the steps to connect each one, and how to open it with a
 * request already typed. Menu names change from time to time, so the steps
 * name the place, and the page says so.
 */
export type AiKey = "claude" | "chatgpt" | "gemini";

export type AiProvider = {
  name: string;
  /** Where to add a custom MCP server, as the app's own menu calls it. */
  path: string;
  /** Who can do it (plan, account); empty when anyone can. */
  note: string;
  /** Opens a new chat; with the request typed in when the app supports it. */
  chatUrl: (request: string) => string;
  prefills: boolean;
};

export const AI_PROVIDERS: Record<AiKey, AiProvider> = {
  claude: {
    name: "Claude",
    path: "Settings → Connectors → Add custom connector",
    note: "",
    chatUrl: (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}`,
    prefills: true,
  },
  chatgpt: {
    name: "ChatGPT",
    path: "Settings → Apps → Add custom MCP server",
    note: "בתוכנית בתשלום בלבד (Plus ומעלה).",
    chatUrl: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}`,
    prefills: true,
  },
  gemini: {
    name: "Gemini",
    path: "Settings → Connected Apps → Add custom app",
    note: "לחשבון גוגל אישי, וייתכן שעוד לא בכל המדינות.",
    chatUrl: () => "https://gemini.google.com/app",
    prefills: false,
  },
};

export const AI_KEYS = Object.keys(AI_PROVIDERS) as AiKey[];

/** The requests the main screen opens the chat with. */
export const AI_REQUESTS = {
  drink: "מה כדאי לפתוח הערב מהמרתף שלי? האירוע: ",
  scan: "אני מצרף צילום של תוויות יין או של קבלה. זהה את הבקבוקים והצע אותם כטיוטות במרתף היין שלי.",
} as const;

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
