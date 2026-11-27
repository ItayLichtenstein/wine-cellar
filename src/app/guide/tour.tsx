"use client";

import { LineIcon, type IconName } from "@/components/line-icon";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GUIDE_SEEN_COOKIE } from "@/lib/guide-first";
import { useT } from "@/i18n/provider";
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
  const t = useT();
  const g = t.guide;
  const steps: Step[] = [
    {
      emoji: "🍷",
      title: g.steps.welcome[0],
      text: g.steps.welcome[1],
      demo: <Welcome />,
    },
    {
      emoji: "🧊",
      title: g.steps.draw[0],
      text: g.steps.draw[1],
      demo: <ArrangementDemo />,
    },
    {
      emoji: "🍾",
      title: g.steps.add[0],
      text: g.steps.add[1],
      demo: <PickDemo />,
    },
    {
      emoji: "🎨",
      title: g.steps.colors[0],
      text: g.steps.colors[1],
      demo: <ColorsDemo />,
    },
    {
      emoji: "🥂",
      title: g.steps.drink[0],
      text: g.steps.drink[1],
      demo: <DrinkDemo />,
    },
    {
      emoji: "↔️",
      title: g.steps.move[0],
      text: g.steps.move[1],
      demo: <MoveDemo />,
    },
    {
      emoji: "🤖",
      title: t.guide.aiTitle,
      text: `${t.guide.aiText}. ${t.guide.aiWhere}`,
    },
    {
      emoji: "✨",
      title: g.steps.more[0],
      text: g.steps.more[1],
      demo: <MoreDemo />,
    },
    {
      emoji: "🎉",
      title: g.steps.done[0],
      text: g.steps.done[1],
      demo: <Finish />,
    },
  ];

  const [i, setI] = useState(0);
  // Seen on this device: the home page stops opening it by itself.
  useEffect(() => {
    document.cookie = `${GUIDE_SEEN_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
  }, []);
  const step = steps[i];
  const last = i === steps.length - 1;

  return (
    <section aria-label={g.tour} className="flex flex-1 flex-col gap-4">
      {/* Progress: a dot per step; tapping one jumps there. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5" role="tablist" aria-label={g.stepsLabel}>
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
          {g.of(i + 1, steps.length)}
        </span>
      </div>

      <article key={i} className="flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-sm" aria-live="polite">
        <div className="text-4xl" aria-hidden="true">
          {step.emoji}
        </div>
        <h2 className="text-xl font-bold">{step.title}</h2>
        <p className="text-muted">{step.text}</p>
        {step.demo && i > 0 && (
          <p className="-mb-2 text-center text-xs text-muted">{t.guide.sample}</p>
        )}
        {step.demo}
      </article>

      <div className="mt-auto flex gap-3">
        {i > 0 && (
          <button type="button" onClick={() => setI(i - 1)} className="rounded-full border border-muted/40 px-5 py-3">
            {g.prev}
          </button>
        )}
        {!last ? (
          <button type="button" onClick={() => setI(i + 1)} className="flex-1 rounded-full bg-accent px-5 py-3 font-medium text-white dark:text-black">
            {i === 0 ? g.start : g.next}
          </button>
        ) : (
          <Link href="/" className="flex-1 rounded-full bg-accent px-5 py-3 text-center font-medium text-white dark:text-black">
            {g.toFridge}
          </Link>
        )}
      </div>
    </section>
  );
}

function Welcome() {
  const t = useT();
  const items = ["🧊", "🍾", "🎨", "⭐"].map((icon, k) => [icon, t.guide.welcome[k]]);
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
  const { guide } = useT();
  const a = guide.arrangements;
  const options = {
    one: {
      name: a.one[0],
      note: a.one[1],
      zones: [{ kind: "row" as const, capacity: 4, label: "שורה" }],
    },
    rows: {
      name: a.rows[0],
      note: a.rows[1],
      zones: [
        { kind: "row" as const, capacity: 4, label: "אחורי" },
        { kind: "row" as const, capacity: 3, label: "קדמי" },
      ],
    },
    pile: {
      name: a.pile[0],
      note: a.pile[1],
      zones: [
        { kind: "stack" as const, capacity: 3, label: "שכבה עליונה" },
        { kind: "stack" as const, capacity: 4, label: "שכבה תחתונה" },
      ],
    },
    front: {
      name: a.front[0],
      note: a.front[1],
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
      <div role="radiogroup" aria-label={guide.arrangementLabel} className="grid grid-cols-4 gap-1 rounded-xl bg-background p-1">
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
  const g = useT().guide;
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
          ? g.tapEmpty
          : g.picked(picked.length)}
      </p>
    </div>
  );
}

/** Tap a bottle to see what its color means. */
function ColorsDemo() {
  const t = useT();
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
            {t.drinkState[open]}
          </>
        ) : (
          t.guide.tapBottleOne
        )}
      </p>
    </div>
  );
}

/** Open the bottle card, tap "שתינו", give a score. */
function DrinkDemo() {
  const g = useT().guide;
  const [stage, setStage] = useState<"shelf" | "card" | "rate" | "done">("shelf");
  const [score, setScore] = useState("");
  const b = bottle("d1", "now", 2019, "Rioja", 2);
  if (stage === "shelf") {
    return (
      <div className="flex flex-col gap-3">
        <FridgePreview shelves={[{ zones: [{ id: "d-row", kind: "row" as const, capacity: 3, label: "שורה", bottles: [b] }] }]} onBottleClick={() => setStage("card")} />
        <p className="text-sm font-medium">{g.tapTheBottle}</p>
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
          {g.drank}
        </button>
      )}
      {stage === "rate" && (
        <div className="flex flex-col gap-2">
          <span className="text-sm">{g.howWasIt}</span>
          <ScoreInput value={score} onChange={setScore} />
          <button
            type="button"
            disabled={!score}
            onClick={() => setStage("done")}
            className="self-start rounded-full bg-accent px-4 py-2 font-medium text-white disabled:opacity-50 dark:text-black"
          >
            {g.cheers}
          </button>
        </div>
      )}
      {stage === "done" && (
        <p className="text-sm" aria-live="polite">
          <span className="text-lg">{g.cheers} {score}</span>
          <br />
          {g.savedToHistory}{" "}
          <button type="button" onClick={() => (setStage("shelf"), setScore(""))} className="underline underline-offset-2">
            {g.again}
          </button>
        </p>
      )}
    </div>
  );
}

/** Tap a bottle, then an empty place: it moves (or swaps with a bottle). */
function MoveDemo() {
  const g = useT().guide;
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
        {moving ? g.tapNewPlace : g.tapToMove}
      </p>
    </div>
  );
}

function MoreDemo() {
  const m = useT().guide.moreItems;
  const icons: IconName[] = ["list", "wish", "stats", "people", "sparkle", "moon", "phone"];
  const items: [IconName, string, string][] = icons.map((icon) => [icon, m[icon][0], m[icon][1]]);
  return (
    // A plain list, not cards: testers took boxed rows for buttons.
    <ul className="flex flex-col divide-y divide-muted/20">
      {items.map(([icon, name, text]) => (
        <li key={name} className="flex items-start gap-3 py-2.5">
          <span className="pt-0.5 text-accent">
            <LineIcon name={icon} className="size-5" />
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
  const g = useT().guide;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{g.goOn}</p>
      <div className="flex flex-wrap gap-2">
      <Link href="/fridges/new" className="rounded-full border border-muted/40 px-4 py-2 text-sm">
        {g.setupFridge}
      </Link>
      <Link href="/bottles/new" className="rounded-full border border-muted/40 px-4 py-2 text-sm">
        {g.addBottle}
      </Link>
      <Link href="/ai" className="rounded-full border border-muted/40 px-4 py-2 text-sm">
        {g.connectAi}
      </Link>
      </div>
    </div>
  );
}
