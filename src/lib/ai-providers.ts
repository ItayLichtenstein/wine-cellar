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
  /** Who can connect a custom server (plan, account, country); shown before the steps. */
  who: string;
  /** Whether a regular personal account can expect to have it. */
  forEveryone: boolean;
  /** Steps after copying the address and before approving on our site. */
  steps: ConnectStep[];
  /** Opens a new chat; with the request typed in when the app supports it. */
  chatUrl: (request: string) => string;
  prefills: boolean;
};

// Checked against each company's help pages (Nov 2026). Sources:
// support.claude.com/en/articles/11176164, help.openai.com/en/articles/12584461,
// support.google.com/gemini/answer/17209137
export const AI_PROVIDERS: Record<AiKey, AiProvider> = {
  claude: {
    name: "Claude",
    who: "כל חשבון Claude, גם החינמי (בחינמי: חיבור אחד כזה).",
    forEveryone: true,
    steps: [
      { text: "פתחו את דף החיבורים של Claude (אם צריך, התחברו לחשבון שלכם).", link: { href: "https://claude.ai/customize/connectors", label: "פתיחת דף החיבורים" } },
      { text: "לחצו על הכפתור + ואז על Add custom connector." },
      { text: "בשדה Name כתבו: מרתף יין. בשדה URL הדביקו את הכתובת שהעתקתם. לחצו Add." },
      { text: "ליד \"מרתף יין\" לחצו Connect." },
    ],
    chatUrl: (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}`,
    prefills: true,
  },
  chatgpt: {
    name: "ChatGPT",
    who: "לפי OpenAI, כרגע רק בחשבונות עבודה (Business, Enterprise, Edu). בחשבון רגיל, גם Plus, כנראה לא תמצאו את האפשרות. במקרה כזה השתמשו בהעתקה הידנית בתחתית העמוד.",
    forEveryone: false,
    steps: [
      { text: "פתחו את ChatGPT באתר, במחשב.", link: { href: "https://chatgpt.com/", label: "פתיחת ChatGPT" } },
      { text: "בתפריט שבצד לחצו על Plugins, אחר כך על + ואז על Add custom MCP server." },
      { text: "בשדה Name כתבו: מרתף יין. בשדה URL הדביקו את הכתובת שהעתקתם. אשרו את האזהרה ולחצו Create." },
    ],
    chatUrl: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}`,
    prefills: true,
  },
  gemini: {
    name: "Gemini",
    who: "חשבון גוגל אישי (לא של עבודה או לימודים), מגיל 18. Google פותחת את זה בהדרגה, וייתכן שעוד לא בכל המדינות.",
    forEveryone: false,
    steps: [
      { text: "פתחו את Gemini באתר, במחשב.", link: { href: "https://gemini.google.com/app", label: "פתיחת Gemini" } },
      { text: "לחצו על Settings (גלגל השיניים, למטה בצד) ואז על Connected Apps." },
      { text: "לחצו Add a custom app, הדביקו את הכתובת שהעתקתם ואשרו." },
    ],
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
