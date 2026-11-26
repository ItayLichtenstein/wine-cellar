/**
 * The three AI assistants a household can connect to the cellar (MCP).
 * Pure data: the steps to connect each one, and how to open it with a
 * request already typed. Menu names change from time to time, so the steps
 * name the place, and the page says so.
 */
export type AiKey = "claude" | "chatgpt" | "gemini";

/** One step of the connection guide. Menu words appear in English, as on screen. */
export type ConnectStep = { text: string; link?: { href: string; label: string } };

export type AiProvider = {
  name: string;
  /** Who can connect it, in one short sentence; shown before the steps. */
  who: string;
  /** Offered in "connect an AI". False where it can't be done from Israel today. */
  connectable: boolean;
  /** Steps after copying the address and before approving on our site. */
  steps: ConnectStep[];
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
    who: "עובד בכל חשבון Claude, גם בחינמי",
    connectable: true,
    steps: [
      { text: "פתחו את דף החיבורים של Claude (ואם צריך, התחברו לחשבון)", link: { href: "https://claude.ai/customize/connectors", label: "פתיחת דף החיבורים" } },
      { text: "לחצו על הכפתור + ואז על Add custom connector" },
      { text: "בשדה Name כתבו \"מרתף יין\", בשדה URL הדביקו את הכתובת שהעתקתם, ולחצו Add" },
      { text: "ליד \"מרתף יין\" לחצו Connect" },
    ],
    chatUrl: (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}`,
    prefills: true,
  },
  chatgpt: {
    name: "ChatGPT",
    who: "עובד רק בחשבון ChatGPT של עבודה (Business או Enterprise), לא בחינמי או ב־Plus",
    connectable: true,
    steps: [
      { text: "פתחו במחשב את דף ה־Plugins של ChatGPT", link: { href: "https://chatgpt.com/plugins", label: "פתיחת Plugins" } },
      { text: "לחצו על + ואז על Add custom MCP server" },
      { text: "בשדה Name כתבו \"מרתף יין\", ובשדה URL הדביקו את הכתובת שהעתקתם" },
      { text: "לחצו I understand and want to continue, ואחר כך Create as a plugin ו־Install" },
    ],
    chatUrl: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}`,
    prefills: true,
  },
  // Custom connections in Gemini are US-only and English-only for now, so
  // it is not offered; kept so a connection made elsewhere is recognised.
  gemini: {
    name: "Gemini",
    who: "בינתיים רק בארה\"ב",
    connectable: false,
    steps: [],
    chatUrl: () => "https://gemini.google.com/app",
    prefills: false,
  },
};

export const AI_KEYS = Object.keys(AI_PROVIDERS) as AiKey[];

/** The assistants offered in "connect an AI". */
export const CONNECTABLE = AI_KEYS.filter((k) => AI_PROVIDERS[k].connectable);

/** The requests the main screen opens the chat with. */
export const AI_REQUESTS = {
  drink: "מה כדאי לפתוח הערב מהמרתף שלי? האירוע: ",
  scan: "אני מצרף צילום של תוויות יין או של קבלה. זהה את הבקבוקים והצע אותם כטיוטות במרתף היין שלי.",
  fill: "עזור לי להכניס למרתף היין שלי את כל הבקבוקים שכבר יש לי, כל אחד במקום שלו במקרר. תתחיל מ־fridge_layout, ואז תבקש ממני צילום של מדף אחרי מדף.",
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
