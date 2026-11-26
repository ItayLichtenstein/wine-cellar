import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "פרטיות · מרתף יין" };

// Plain language on purpose: what we keep, who sees it, what we never do.
// Keep this page in sync with docs/product-spec.md ("עמוד פרטיות").
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10 leading-relaxed">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">פרטיות</h1>
        <p className="text-muted">
          מרתף יין הוא פרויקט אישי ולא מסחרי. כך אנחנו מתייחסים למידע שלכם, בלי אותיות קטנות.
        </p>
      </header>

      <Section title="מה נשמר">
        <ul className="list-disc ps-5">
          <li>השם וכתובת המייל מחשבון הגוגל שאיתו התחברתם. תמונת הפרופיל לא נשמרת.</li>
          <li>מה שאתם מכניסים: מקררים, יינות, בקבוקים, מחירים, ציונים והערות.</li>
          <li>
            תמונות תוויות, אם תעלו. לפני ההעלאה המכשיר שלכם מוחק מהן את המידע הנסתר, כולל המיקום שבו
            צולמו.
          </li>
        </ul>
      </Section>

      <Section title="מי רואה מה">
        <ul className="list-disc ps-5">
          <li>
            <strong>בני משק הבית</strong> – הכול.
          </li>
          <li>
            <strong>חברים</strong> – את המרתף, חוץ ממחירים (אלא אם אישרתם לחבר מסוים לראות אותם).
          </li>
          <li>
            <strong>מי שקיבל קישור צפייה</strong> – לפי מה שבחרתם להציג, ורק עד שתבטלו את הקישור.
          </li>
          <li>
            <strong>כתובת המייל שלכם לא מוצגת לאף אחד</strong> – לא לשותפים במרתף, לא לחברים ולא בקישורים.
          </li>
        </ul>
      </Section>

      <Section title="מה אנחנו לא עושים">
        <ul className="list-disc ps-5">
          <li>לא מוכרים ולא מעבירים מידע לאף אחד.</li>
          <li>אין פרסומות ואין כלי מעקב של צד שלישי.</li>
          <li>
            האתר לא שולח את הנתונים שלכם לשום בינה מלאכותית. רק אם תבחרו לחבר את ה־AI שלכם, הוא יוכל
            לקרוא את המרתף – ושום שינוי לא נכנס בלי אישור שלכם.
          </li>
        </ul>
      </Section>

      <Section title="איפה המידע נשמר">
        <p>
          מסד הנתונים מאוחסן ב־Supabase והאתר מאוחסן ב־Vercel. הגישה למידע נאכפת במסד הנתונים עצמו, כך שגם
          פנייה ישירה שעוקפת את האתר לא תחשוף מידע של אחרים.
        </p>
      </Section>

      <Section title="השליטה אצלכם">
        <ul className="list-disc ps-5">
          <li>אפשר לייצא את כל הנתונים לקובץ מתוך ההגדרות.</li>
          <li>
            אפשר למחוק את החשבון מתוך ההגדרות. המחיקה מוחקת את הפרטים שלכם; נתוני מרתף משותף נשארים אצל
            השותפים האחרים.
          </li>
        </ul>
      </Section>

      <Section title="יצירת קשר">
        <p>
          <span className="inline-block">שאלות, בקשה לקבל או למחוק את המידע שלכם:</span>{" "}
          <a href="mailto:thewinecellarapp@gmail.com" dir="ltr" className="underline underline-offset-2">
            thewinecellarapp@gmail.com
          </a>
        </p>
      </Section>

      <Link href="/" className="text-sm underline underline-offset-2">
        חזרה לאתר
      </Link>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
