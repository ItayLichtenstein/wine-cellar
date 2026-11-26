"use client";

import Link from "next/link";
import { useState } from "react";
import { FridgePreview, type Place } from "@/components/fridge-preview";
import { ScoreInput } from "@/components/score-input";
import { DRINK_STATES, DRINK_STATE_ORDER, type DrinkState } from "@/lib/drink-state";
import { FRONT_LABEL } from "@/lib/fridge-layout";
import type { PlacedBottle } from "@/lib/fridges";

// Made-up bottles for the demos. Never anyone's data.
const bottle = (id: string, state: DrinkState, year: number, label: string, slot: number | null = null): PlacedBottle => ({
  id,
  slot,
  year,
  state,
  title: label,
  label,
  thumb: null,
});

type Step = { emoji: string; title: string; text: string; demo?: React.ReactNode };

/**
 * The beginner's guide as a short tour: one card at a time, a sentence or
 * two each, and a small live demo to touch (the real fridge drawing).
 * Nothing in the demos is saved.
 */
export function GuideTour() {
  const steps: Step[] = [
    {
      emoji: "🍷",
      title: "ברוכים הבאים למרתף",
      text: "מה יש בבית, איפה כל בקבוק, ומתי לפתוח אותו. סיור של דקה.",
      demo: <Welcome />,
    },
    {
      emoji: "🧊",
      title: "מציירים את המקרר",
      text: "לכל מדף בוחרים סידור, כמו במקרר שלכם. נסו:",
      demo: <ArrangementDemo />,
    },
    {
      emoji: "🍾",
      title: "מוסיפים בקבוק",
      text: "לוחצים על מקום ריק, וזה המקום של הבקבוק. נסו:",
      demo: <PickDemo />,
    },
    {
      emoji: "🎨",
      title: "הצבע אומר מתי לשתות",
      text: "המספר הוא שנת הבציר (19 = 2019). הצבע אומר מתי לשתות. לחצו על בקבוק:",
      demo: <ColorsDemo />,
    },
    {
      emoji: "🥂",
      title: "פתחנו בקבוק",
      text: "לוחצים על הבקבוק, \"שתינו\", ונותנים ציון מ־1 עד 5. נסו:",
      demo: <DrinkDemo />,
    },
    {
      emoji: "↔️",
      title: "מזיזים בקבוק",
      text: "לוחצים על בקבוק, ואז על המקום החדש. נסו:",
      demo: <MoveDemo />,
    },
    {
      emoji: "✨",
      title: "ועוד כמה דברים",
      text: "בקצרה:",
      demo: <MoreDemo />,
    },
    {
      emoji: "🎉",
      title: "זהו, אתם מוכנים!",
      text: "כמעט הכול אפשר לשנות אחר כך. הסיור נמצא תמיד ב\"עוד\".",
      demo: <Finish />,
    },
  ];

  const [i, setI] = useState(0);
  const step = steps[i];
  const last = i === steps.length - 1;

  return (
    <section aria-label="סיור במרתף" className="flex flex-1 flex-col gap-4">
      {/* Progress: a dot per step; tapping one jumps there. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5" role="tablist" aria-label="שלבי הסיור">
          {steps.map((s, k) => (
            <button
              key={s.title}
              type="button"
              role="tab"
              aria-selected={k === i}
              aria-label={`${k + 1}. ${s.title}`}
              onClick={() => setI(k)}
              className={`h-2 rounded-full transition-all ${k === i ? "w-6 bg-accent" : k < i ? "w-2 bg-accent/60" : "w-2 bg-muted/40"}`}
            />
          ))}
        </div>
        <span className="text-xs text-muted tabular-nums">
          {i + 1} מתוך {steps.length}
        </span>
      </div>

      <article key={i} className="flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-sm" aria-live="polite">
        <div className="text-4xl" aria-hidden="true">
          {step.emoji}
        </div>
        <h2 className="text-xl font-bold">{step.title}</h2>
        <p className="text-muted">{step.text}</p>
        {step.demo}
      </article>

      <div className="mt-auto flex gap-3">
        {i > 0 && (
          <button type="button" onClick={() => setI(i - 1)} className="rounded-full border border-muted/40 px-5 py-3">
            → הקודם
          </button>
        )}
        {!last ? (
          <button type="button" onClick={() => setI(i + 1)} className="flex-1 rounded-full bg-accent px-5 py-3 font-medium text-white dark:text-black">
            {i === 0 ? "בואו נתחיל ←" : "הבא ←"}
          </button>
        ) : (
          <Link href="/" className="flex-1 rounded-full bg-accent px-5 py-3 text-center font-medium text-white dark:text-black">
            למקרר שלי ←
          </Link>
        )}
      </div>
    </section>
  );
}

function Welcome() {
  const items = [
    ["🧊", "מציירים את המקרר פעם אחת"],
    ["🍾", "מניחים כל בקבוק במקום שלו"],
    ["🎨", "הצבע אומר מתי לפתוח"],
    ["⭐", "מדרגים, והכול נשמר"],
  ];
  return (
    <ul className="grid grid-cols-2 gap-2">
      {items.map(([icon, text]) => (
        <li key={text} className="flex flex-col items-center gap-1 rounded-xl bg-background p-3 text-center text-sm">
          <span className="text-2xl" aria-hidden="true">
            {icon}
          </span>
          {text}
        </li>
      ))}
    </ul>
  );
}

/** Pick an arrangement and watch the shelf change. */
function ArrangementDemo() {
  const options = {
    one: {
      name: "שורה אחת",
      note: "שורה אחת של בקבוקים.",
      zones: [{ kind: "row" as const, capacity: 4, label: "שורה" }],
    },
    rows: {
      name: "שתי שורות",
      note: "שורה אחורית ושורה קדמית.",
      zones: [
        { kind: "row" as const, capacity: 4, label: "אחורי" },
        { kind: "row" as const, capacity: 3, label: "קדמי" },
      ],
    },
    pile: {
      name: "ערימה",
      note: "בקבוקים זה על זה, למשל בתחתית המקרר.",
      zones: [
        { kind: "stack" as const, capacity: 3, label: "שכבה עליונה" },
        { kind: "stack" as const, capacity: 4, label: "שכבה תחתונה" },
      ],
    },
    front: {
      name: "בחזית",
      note: "בקבוקים ששוכבים לרוחב, לפני המדף.",
      zones: [
        { kind: "row" as const, capacity: 4, label: "אחורי" },
        { kind: "row" as const, capacity: 3, label: "קדמי" },
        { kind: "row" as const, capacity: 2, label: FRONT_LABEL },
      ],
    },
  };
  const [key, setKey] = useState<keyof typeof options>("one");
  const o = options[key];
  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="סידור המדף" className="grid grid-cols-4 gap-1 rounded-xl bg-background p-1">
        {(Object.keys(options) as (keyof typeof options)[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={k === key}
            onClick={() => setKey(k)}
            className={`rounded-lg px-1 py-2 text-sm ${k === key ? "bg-accent font-medium text-white dark:text-black" : "text-muted"}`}
          >
            {options[k].name}
          </button>
        ))}
      </div>
      <FridgePreview shelves={[{ zones: o.zones }]} />
      <p className="text-sm">{o.note}</p>
    </div>
  );
}

/** Tap empty places to pick them, as in "add bottles". */
function PickDemo() {
  const [picked, setPicked] = useState<Place[]>([]);
  const shelves = [
    {
      zones: [
        { id: "p1", kind: "row" as const, capacity: 4, label: "אחורי", bottles: [bottle("x1", "now", 2019, "Rioja", 1), bottle("x2", "hold", 2020, "Barolo", 3)] },
        { id: "p2", kind: "row" as const, capacity: 3, label: "קדמי", bottles: [bottle("x3", "soon", 2021, "Chianti", 2)] },
      ],
    },
  ];
  function pick(p: Place) {
    setPicked((prev) => (prev.some((x) => x.zoneId === p.zoneId && x.slot === p.slot) ? prev.filter((x) => !(x.zoneId === p.zoneId && x.slot === p.slot)) : [...prev, p]));
  }
  return (
    <div className="flex flex-col gap-3">
      <FridgePreview shelves={shelves} onPick={pick} picked={picked} />
      <p className="text-sm font-medium" aria-live="polite">
        {picked.length === 0
          ? "👆 לחצו על אחד המקומות הריקים"
          : `יופי! ${picked.length === 1 ? "מקום אחד נבחר" : `${picked.length} מקומות נבחרו`}. לחיצה נוספת מבטלת.`}
      </p>
    </div>
  );
}

/** Tap a bottle to see what its color means. */
function ColorsDemo() {
  const states = DRINK_STATE_ORDER.filter((s) => s !== "none");
  const bottles = states.map((s, k) => bottle(`c${k}`, s, 2014 + k, ["Port", "Rioja", "Chianti", "Barolo", "Pinot", "Syrah"][k] ?? "Wine", null));
  const [open, setOpen] = useState<DrinkState | null>(null);
  const half = Math.ceil(bottles.length / 2);
  const row = (id: string, bs: PlacedBottle[]) => ({ id, kind: "row" as const, capacity: bs.length, label: "", bottles: bs.map((b, k) => ({ ...b, slot: k + 1 })) });
  const shelves = [{ zones: [row("c-1", bottles.slice(0, half)), row("c-2", bottles.slice(half))] }];
  return (
    <div className="flex flex-col gap-3">
      <FridgePreview shelves={shelves} view="dots" onBottleClick={(b) => setOpen(b.state)} />
      <p className="min-h-10 text-sm font-medium" aria-live="polite">
        {open ? (
          <>
            <span className="me-2 inline-block size-3 rounded-sm align-middle" style={{ backgroundColor: DRINK_STATES[open].color }} aria-hidden="true" />
            {DRINK_STATES[open].label}
          </>
        ) : (
          "👆 לחצו על אחד הבקבוקים"
        )}
      </p>
    </div>
  );
}

/** Open the bottle card, tap "שתינו", give a score. */
function DrinkDemo() {
  const [stage, setStage] = useState<"shelf" | "card" | "rate" | "done">("shelf");
  const [score, setScore] = useState("");
  const b = bottle("d1", "now", 2019, "Rioja", 2);
  if (stage === "shelf") {
    return (
      <div className="flex flex-col gap-3">
        <FridgePreview shelves={[{ zones: [{ id: "d-row", kind: "row" as const, capacity: 3, label: "שורה", bottles: [b] }] }]} onBottleClick={() => setStage("card")} />
        <p className="text-sm font-medium">👆 לחצו על הבקבוק</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-background p-4">
      <p className="font-semibold">
        Bodega – Rioja <span className="text-muted">2019</span>
      </p>
      {stage === "card" && (
        <button type="button" onClick={() => setStage("rate")} className="self-start rounded-full bg-accent px-4 py-2 font-medium text-white dark:text-black">
          🍷 שתינו
        </button>
      )}
      {stage === "rate" && (
        <div className="flex flex-col gap-2">
          <span className="text-sm">איך היה? ציון מ־1 עד 5:</span>
          <ScoreInput value={score} onChange={setScore} />
          <button
            type="button"
            disabled={!score}
            onClick={() => setStage("done")}
            className="self-start rounded-full bg-accent px-4 py-2 font-medium text-white disabled:opacity-50 dark:text-black"
          >
            לחיים!
          </button>
        </div>
      )}
      {stage === "done" && (
        <p className="text-sm" aria-live="polite">
          <span className="text-lg">לחיים! {score}</span>
          <br />
          נשמר בהיסטוריה.{" "}
          <button type="button" onClick={() => (setStage("shelf"), setScore(""))} className="underline underline-offset-2">
            שוב
          </button>
        </p>
      )}
    </div>
  );
}

/** Tap a bottle, then an empty place: it moves (or swaps with a bottle). */
function MoveDemo() {
  const [slots, setSlots] = useState<Record<string, number>>({ m1: 1, m2: 3 });
  const [moving, setMoving] = useState<string | null>(null);
  const all = [bottle("m1", "now", 2019, "Rioja"), bottle("m2", "hold", 2020, "Barolo")];
  const shelves = [{ zones: [{ id: "m-row", kind: "row" as const, capacity: 4, label: "שורה", bottles: all.map((b) => ({ ...b, slot: slots[b.id] })) }] }];
  function to(slot: number | null) {
    if (!moving || slot === null) return;
    setSlots((prev) => {
      const other = Object.keys(prev).find((id) => prev[id] === slot && id !== moving);
      return { ...prev, [moving]: slot, ...(other ? { [other]: prev[moving] } : {}) };
    });
    setMoving(null);
  }
  return (
    <div className="flex flex-col gap-3">
      <FridgePreview
        shelves={shelves}
        activeBottleId={moving ?? undefined}
        onPick={moving ? (p) => to(p.slot) : undefined}
        onBottleClick={(b, p) => (moving && b.id !== moving ? to(p.slot) : setMoving(b.id === moving ? null : b.id))}
      />
      <p className="text-sm font-medium" aria-live="polite">
        {moving ? "עכשיו לחצו על המקום החדש" : "👆 לחצו על בקבוק כדי להזיז אותו"}
      </p>
    </div>
  );
}

function MoreDemo() {
  const items = [
    ["📋", "רשימה", "כל הבקבוקים, עם חיפוש וסינון."],
    ["♡", "Wishlist", "יינות שרוצים לקנות או לטעום."],
    ["📊", "סטטיסטיקות", "שווי המרתף, מה בשל, ומה אתם הכי אוהבים."],
    ["🤝", "שיתוף", "מזמינים בקישור. שותף מנהל איתכם, חבר רק צופה."],
    ["✨", "חיבור AI", "שואלים \"מה לפתוח הערב?\", או מצלמים את המקרר וה־AI ממלא אותו."],
    ["🌓", "מראה", "בהיר, כהה או אוטומטי. ב\"עוד\"."],
    ["📲", "כמו אפליקציה", "בדפדפן: שיתוף ← \"הוספה למסך הבית\"."],
  ];
  return (
    <ul className="flex flex-col gap-2">
      {items.map(([icon, name, text]) => (
        <li key={name} className="flex items-start gap-3 rounded-xl bg-background px-3 py-2.5">
          <span className="text-lg" aria-hidden="true">
            {icon}
          </span>
          <span className="flex flex-col">
            <span className="font-medium">{name}</span>
            <span className="text-sm text-muted">{text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Finish() {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">מכאן אפשר להמשיך ישר:</p>
      <div className="flex flex-wrap gap-2">
      <Link href="/fridges/new" className="rounded-full border border-muted/40 px-4 py-2 text-sm">
        🧊 הגדרת מקרר
      </Link>
      <Link href="/bottles/new" className="rounded-full border border-muted/40 px-4 py-2 text-sm">
        🍾 הוספת בקבוק
      </Link>
      <Link href="/ai" className="rounded-full border border-muted/40 px-4 py-2 text-sm">
        ✨ חיבור AI
      </Link>
      </div>
    </div>
  );
}
