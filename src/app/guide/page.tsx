import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { FridgePreview } from "@/components/fridge-preview";
import { DRINK_STATES, DRINK_STATE_ORDER, type DrinkState } from "@/lib/drink-state";
import { FRONT_LABEL } from "@/lib/fridge-layout";
import type { PlacedBottle } from "@/lib/fridges";

export const metadata: Metadata = { title: "מדריך למתחילים · מרתף יין" };

// Example bottles for the drawings. Made-up wines, never anyone's data.
let n = 0;
const b = (state: DrinkState, year: number, label: string, slot: number | null = null): PlacedBottle => ({
  id: `demo-${n++}`,
  slot,
  year,
  state,
  title: label,
  label,
});

const ROWS_SHELF = {
  zones: [
    { kind: "row" as const, capacity: 5, label: "אחורית", bottles: [b("now", 2019, "Rioja", 1), b("hold", 2020, "Barolo", 2), b("soon", 2021, "Chianti", 4)] },
    { kind: "row" as const, capacity: 4, label: "קדמית", bottles: [b("past", 2012, "Merlot", 1), b("young", 2023, "Syrah", 3)] },
  ],
};
const PILE_SHELF = {
  zones: [
    { kind: "stack" as const, capacity: 4, label: "שכבה עליונה", bottles: [b("hold", 2018, "Bordeaux"), b("now", 2017, "Malbec")] },
    { kind: "stack" as const, capacity: 5, label: "שכבה תחתונה", bottles: [b("near", 2022, "Pinot"), b("soon", 2020, "Cava"), b("now", 2016, "Rioja")] },
    { kind: "row" as const, capacity: 2, label: FRONT_LABEL, bottles: [b("past", 2014, "Port", 1)] },
  ],
};

const SECTIONS = [
  { id: "start", title: "מתחילים: המקרר" },
  { id: "add", title: "הוספת בקבוקים" },
  { id: "colors", title: "מה אומרים הצבעים" },
  { id: "open", title: "פתחנו בקבוק" },
  { id: "move", title: "הזזת בקבוק" },
  { id: "list", title: "רשימה, Wishlist וסטטיסטיקות" },
  { id: "people", title: "בני הבית וחברים" },
  { id: "ai", title: "חיבור AI" },
  { id: "tips", title: "טיפים ושאלות" },
];

/**
 * The beginner's guide: what the app is for and how to use every part of
 * it, in short sections with real drawings (the same component the app
 * uses), so what you read is exactly what you will see.
 */
export default function GuidePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 py-8">
      <BackLink href="/" label="למקרר" />

      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold">ברוכים הבאים למרתף 🍷</h1>
        <p className="text-muted">
          <span className="inline-block">האתר עוזר לדעת בכל רגע אילו יינות יש בבית,</span>{" "}
          <span className="inline-block">איפה בדיוק כל בקבוק נמצא במקרר,</span>{" "}
          <span className="inline-block">ומתי הכי כדאי לפתוח אותו.</span>
        </p>
        <ul className="flex flex-col gap-1.5 rounded-xl bg-surface p-4 text-sm shadow-sm">
          <li>🧊 מציירים את המקרר פעם אחת, כמו שהוא באמת.</li>
          <li>🍾 מוסיפים בקבוקים ומניחים אותם במקום שלהם.</li>
          <li>🎨 הצבע של כל בקבוק אומר אם כבר הזמן לפתוח אותו.</li>
          <li>⭐ כשפותחים, מדרגים, והכול נשמר בהיסטוריה.</li>
        </ul>
        <p className="text-sm text-muted">
          <span className="inline-block">כמעט כל פעולה אפשר לבטל או לשנות אחר כך,</span>{" "}
          <span className="inline-block">אז אין מה לחשוש לנסות.</span>
        </p>
        <nav aria-label="תוכן המדריך" className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="rounded-full border border-muted/40 px-3 py-1 text-sm hover:border-accent">
              {s.title}
            </a>
          ))}
        </nav>
      </header>

      <Section id="start" title="מתחילים: המקרר" emoji="🧊">
        <p>
          <span className="inline-block">בכניסה הראשונה לוחצים על &quot;הגדרת המקרר הראשון&quot;.</span>{" "}
          <span className="inline-block">אם המקרר שלכם מלנדרס או מוינופו, בוחרים יצרן,</span>{" "}
          <span className="inline-block">אחר כך כמה בקבוקים הוא מחזיק, ואז את הדגם.</span>{" "}
          <span className="inline-block">המדפים מתמלאים לבד, ואפשר לתקן כל מדף.</span>
        </p>
        <p>
          <span className="inline-block">לכל מדף בוחרים סידור, כמו במקרר האמיתי:</span>
        </p>
        <Term name="שורה אחורית וקדמית">
          הבקבוקים שוכבים בשתי שורות. בשורה הקדמית בדרך כלל יש בקבוק אחד פחות, כי הבקבוקים שוכבים ראש מול זנב. בציור השורה האחורית למעלה.
        </Term>
        <FridgePreview shelves={[ROWS_SHELF]} />
        <Term name="ערימה (שכבה על שכבה)">
          בקבוקים מונחים זה על זה, למשל בתחתית המקרר. השכבה העליונה יושבת בשקעים שבין הבקבוקים של התחתונה. בערימה אין מקום ממוספר: יודעים רק באיזו שכבה הבקבוק.
        </Term>
        <Term name="+ בחזית">
          לפעמים נשאר מקום לעוד כמה בקבוקים ששוכבים לרוחב, לפני השורות. בוחרים סידור שבסופו המילה &quot;בחזית&quot;, והבקבוקים האלה מופיעים מתחת לקו המקווקו.
        </Term>
        <FridgePreview shelves={[PILE_SHELF]} />
        <p className="text-sm text-muted">
          <span className="inline-block">יש יותר ממקרר אחד? מוסיפים אותו דרך &quot;עוד&quot; ← &quot;המקררים&quot;.</span>{" "}
          <span className="inline-block">שם גם קובעים איזה מקרר נפתח ראשון.</span>
        </p>
      </Section>

      <Section id="add" title="הוספת בקבוקים" emoji="🍾">
        <Steps
          items={[
            "לוחצים על \"+ הוספת בקבוקים\" במסך הראשי.",
            "ממלאים יקב ושם יין. בציר, סוג ומחיר הם רשות.",
            "קניתם כמה בקבוקים מאותו יין? משנים את הכמות.",
            "בציור המקרר לוחצים על מקום ריק לכל בקבוק. לחיצה נוספת מבטלת.",
            "לוחצים \"הוספת הבקבוק\".",
          ]}
        />
        <p>
          <span className="inline-block">קיצור דרך: לוחצים על מקום ריק במקרר עצמו,</span>{" "}
          <span className="inline-block">והטופס נפתח עם המקום כבר בחור.</span>
        </p>
        <p className="text-sm text-muted">
          <span className="inline-block">אין עכשיו מקום? בוחרים &quot;מחוץ למקרר&quot;.</span>{" "}
          <span className="inline-block">הזמנתם ועוד לא הגיע? &quot;בדרך אלינו&quot;.</span>{" "}
          <span className="inline-block">שתי הרשימות מופיעות מתחת למקרר, ומשם משבצים כשמתפנה מקום.</span>
        </p>
      </Section>

      <Section id="colors" title="מה אומרים הצבעים" emoji="🎨">
        <p>
          <span className="inline-block">על כל בקבוק יש מספר קטן: שתי הספרות האחרונות של שנת הבציר</span>{" "}
          <span className="inline-block">(19 = 2019, NV = בלי בציר).</span>{" "}
          <span className="inline-block">הצבע שלו אומר מתי הכי כדאי לשתות:</span>
        </p>
        <ul className="flex flex-col gap-2 rounded-xl bg-surface p-4 shadow-sm">
          {DRINK_STATE_ORDER.filter((s) => s !== "none").map((s) => (
            <li key={s} className="flex items-center gap-3 text-sm">
              <span className="w-8 shrink-0 rounded-sm text-center text-xs font-bold leading-5 text-black" style={{ backgroundColor: DRINK_STATES[s].color }}>
                19
              </span>
              {DRINK_STATES[s].label}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          <span className="inline-block">הצבע נקבע לפי חלון השתייה של היין (משנה, עד שנה).</span>{" "}
          <span className="inline-block">בלי חלון, המספר אפור.</span>{" "}
          <span className="inline-block">&quot;מה לשתות עכשיו&quot; במסך הראשי מציג את הבקבוקים הדחופים ביותר.</span>
        </p>
      </Section>

      <Section id="open" title="פתחנו בקבוק" emoji="🥂">
        <Steps
          items={[
            "לוחצים על הבקבוק במקרר. נפתח כרטיס עם כל הפרטים.",
            "לוחצים \"שתינו\".",
            "בוחרים תאריך, נותנים ציון מ־1 עד 5, ואם רוצים כותבים איך היה.",
            "אהבתם? מסמנים \"לקנות שוב\", והיין נכנס ל־Wishlist.",
          ]}
        />
        <p className="text-sm text-muted">
          <span className="inline-block">הבקבוק יוצא מהמקרר ונשמר ב&quot;היסטוריה ודירוגים&quot;,</span>{" "}
          <span className="inline-block">שנמצאת ב&quot;עוד&quot; בסרגל התחתון.</span>{" "}
          <span className="inline-block">שתיתם יין שלא היה במקרר, למשל במסעדה? אפשר להוסיף אותו שם ידנית.</span>
        </p>
      </Section>

      <Section id="move" title="הזזת בקבוק" emoji="↔️">
        <Steps
          items={[
            "לוחצים על הבקבוק ואז על \"הזזה\".",
            "לוחצים על המקום החדש. אם הוא תפוס, שני הבקבוקים מתחלפים.",
          ]}
        />
      </Section>

      <Section id="list" title="רשימה, Wishlist וסטטיסטיקות" emoji="📋">
        <Term name="רשימה">
          כל הבקבוקים בשורות, שורה לכל יין ובציר. אפשר לחפש לפי יקב, יין או ארץ, לסנן לפי סוג, בשלות, כשרות ומחיר, ולמיין.
        </Term>
        <Term name="Wishlist">
          יינות שרוצים לקנות או לטעום. כשהיין נקנה, לוחצים &quot;קניתי&quot;, וטופס ההוספה נפתח עם כל הפרטים.
        </Term>
        <Term name="סטטיסטיקות">
          כמה שווה המרתף, מה בשל לשתייה, מאילו ארצות וזנים, ומה אתם הכי אוהבים לפי הדירוגים. יש גם סיכום שנה.
        </Term>
      </Section>

      <Section id="people" title="בני הבית וחברים" emoji="👨‍👩‍👧">
        <Term name="בני הבית">
          מרתף אחד לכל הבית. ב&quot;עוד&quot; ← &quot;בני הבית&quot; יוצרים קישור הזמנה ושולחים אותו. <b>שותף</b> יכול להוסיף, להזיז ולסמן ששתיתם. <b>צופה</b> רק רואה.
        </Term>
        <Term name="חברים">
          חברים רואים את המרתף שלכם, ואתם את שלהם. רק צפייה, בלי שינויים. אפשר להסתיר מהם את המחירים. בכרטיס בקבוק של חבר יש &quot;♡ גם אני רוצה&quot;, שמוסיף את היין ל־Wishlist שלכם.
        </Term>
        <Term name="קישור צפייה">
          למי שאין חשבון: קישור שמראה את המקרר בלי הרשמה. אפשר לבטל אותו בכל רגע.
        </Term>
        <p className="text-sm text-muted">כל הקישורים נשלחים על ידכם, בוואטסאפ או במייל. האתר לא שולח הודעות בעצמו.</p>
      </Section>

      <Section id="ai" title="חיבור AI" emoji="✨">
        <p>
          <span className="inline-block">אפשר לחבר את Claude, ChatGPT או Gemini למרתף,</span>{" "}
          <span className="inline-block">ואז פשוט לדבר איתם:</span>
        </p>
        <ul className="flex list-inside list-disc flex-col gap-1 text-sm">
          <li>&quot;מה כדאי לפתוח הערב לארוחה איטלקית?&quot;</li>
          <li>שולחים צילום של תוויות או של קבלה, והבקבוקים מגיעים לאתר כטיוטות.</li>
        </ul>
        <p className="text-sm text-muted">
          <span className="inline-block">ה־AI רק קורא ומציע. כל טיוטה מחכה לאישור שלכם,</span>{" "}
          <span className="inline-block">והוא לא יכול לשנות, להזיז או למחוק כלום.</span>
        </p>
        <Link href="/ai" className="self-start rounded-full bg-accent px-4 py-2 text-sm font-medium text-white dark:text-black">
          להוראות החיבור, צעד אחר צעד ←
        </Link>
      </Section>

      <Section id="tips" title="טיפים ושאלות" emoji="💡">
        <Term name="המסך בורדו ולפעמים בהיר?">
          ברירת המחדל היא לפי הטלפון: במצב כהה האתר בורדו, ובמצב בהיר הוא בהיר. אפשר לקבוע ב&quot;עוד&quot; ← &quot;מראה&quot;.
        </Term>
        <Term name="רוצים שמות יין על הבקבוקים, או רק שנים?">
          הכפתור &quot;הצג תוויות&quot; מעל המקרר מחליף בין התצוגות.
        </Term>
        <Term name="להוסיף לטלפון כמו אפליקציה">
          בדפדפן פותחים את תפריט השיתוף ובוחרים &quot;הוספה למסך הבית&quot;.
        </Term>
        <Term name="רוצים את הכול באקסל?">&quot;עוד&quot; ← &quot;חשבון&quot; ← ייצוא.</Term>
        <Term name="מצאתם באג או שיש רעיון?">ספרו לנו. כל הערה עוזרת.</Term>
      </Section>
    </main>
  );
}

function Section({ id, title, emoji, children }: { id: string; title: string; emoji: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-4 flex-col gap-3">
      <h2 className="text-xl font-semibold">
        <span aria-hidden="true">{emoji}</span> {title}
      </h2>
      {children}
    </section>
  );
}

/** A named idea and one or two sentences about it. */
function Term({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface p-3 shadow-sm">
      <p className="font-medium">{name}</p>
      <p className="text-sm text-muted">{children}</p>
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {items.map((text, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white dark:text-black" aria-hidden="true">
            {i + 1}
          </span>
          <span className="pt-0.5">{text}</span>
        </li>
      ))}
    </ol>
  );
}
