"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FridgePreview } from "@/components/fridge-preview";
import { createClient } from "@/lib/supabase/client";
import {
  LIMITS,
  SHELF_PRESETS,
  clamp,
  fridgeCapacity,
  type PresetKey,
  type Shelf,
} from "@/lib/fridge-layout";

// A shelf in the form remembers which preset it came from, so the
// dropdown can show it. Only `zones` is sent to the database.
type FormShelf = Shelf & { preset: PresetKey };

const DEFAULT_SIZE: Record<PresetKey, number> = {
  twoRows: 5,
  oneRow: 5,
  doubleStack: 8,
  stacksAndRow: 8,
};

function makeShelf(preset: PresetKey): FormShelf {
  return { preset, ...SHELF_PRESETS[preset].make(DEFAULT_SIZE[preset]) };
}

export function NewFridgeForm() {
  const router = useRouter();
  const [name, setName] = useState("מקרר יין");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [shelves, setShelves] = useState<FormShelf[]>(() =>
    Array.from({ length: 6 }, () => makeShelf("twoRows")),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setShelfCount(count: number) {
    const n = clamp(count, LIMITS.shelves.min, LIMITS.shelves.max);
    setShelves((prev) =>
      n > prev.length
        ? [...prev, ...Array.from({ length: n - prev.length }, () => makeShelf("twoRows"))]
        : prev.slice(0, n),
    );
  }

  function changePreset(index: number, preset: PresetKey) {
    setShelves((prev) => prev.map((s, i) => (i === index ? makeShelf(preset) : s)));
  }

  function changeCapacity(shelfIndex: number, zoneIndex: number, value: number) {
    const capacity = clamp(value, LIMITS.capacity.min, LIMITS.capacity.max);
    setShelves((prev) =>
      prev.map((s, i) =>
        i !== shelfIndex
          ? s
          : { ...s, zones: s.zones.map((z, j) => (j === zoneIndex ? { ...z, capacity } : z)) },
      ),
    );
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("צריך לתת למקרר שם.");
      return;
    }
    setSaving(true);
    setError(null);

    const { error: rpcError } = await createClient().rpc("create_fridge", {
      p_name: name,
      p_brand: brand || undefined,
      p_model: model || undefined,
      p_shelves: shelves.map(({ zones }) => ({ zones })),
    });

    if (rpcError) {
      setSaving(false);
      // Never show database details to the user.
      setError("לא הצלחנו לשמור את המקרר. בדקו את הפרטים ונסו שוב.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-lg font-semibold">פרטי המקרר</legend>
        <TextField label="שם" value={name} onChange={setName} required />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="יצרן (לא חובה)" value={brand} onChange={setBrand} />
          <TextField label="דגם (לא חובה)" value={model} onChange={setModel} />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-lg font-semibold">מדפים</legend>
        <div className="flex items-center gap-3">
          <span>כמה מדפים?</span>
          <Stepper value={shelves.length} onChange={setShelfCount} min={LIMITS.shelves.min} max={LIMITS.shelves.max} />
        </div>
        <p className="text-sm text-muted">
          מדף 1 הוא העליון. לכל מדף בוחרים סידור, ואפשר לשנות כמה בקבוקים נכנסים בכל חלק. כך המקרר באתר
          ייראה בדיוק כמו המקרר האמיתי.
        </p>

        <ol className="flex flex-col gap-3">
          {shelves.map((shelf, i) => (
            <li key={i} className="flex flex-col gap-2 rounded-xl bg-surface p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">מדף {i + 1}</span>
                <select
                  aria-label={`סידור מדף ${i + 1}`}
                  value={shelf.preset}
                  onChange={(e) => changePreset(i, e.target.value as PresetKey)}
                  className="rounded-lg border border-muted/40 bg-background px-2 py-1 text-sm"
                >
                  {(Object.keys(SHELF_PRESETS) as PresetKey[]).map((key) => (
                    <option key={key} value={key}>
                      {SHELF_PRESETS[key].title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {shelf.zones.map((zone, j) => (
                  <label key={j} className="flex items-center gap-2 text-sm">
                    <span className="text-muted">{zone.label}</span>
                    <Stepper
                      value={zone.capacity}
                      onChange={(v) => changeCapacity(i, j, v)}
                      min={LIMITS.capacity.min}
                      max={LIMITS.capacity.max}
                      label={`${zone.label}, מדף ${i + 1}`}
                    />
                  </label>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </fieldset>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">כך זה ייראה</h2>
        <p className="text-sm text-muted">סך הכול מקום ל־{fridgeCapacity(shelves)} בקבוקים.</p>
        <FridgePreview shelves={shelves} />
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-full bg-accent px-5 py-3 font-medium text-white disabled:opacity-60 dark:text-black"
      >
        {saving ? "שומר…" : "שמירת המקרר"}
      </button>
    </form>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        maxLength={LIMITS.name}
        className="rounded-lg border border-muted/40 bg-surface px-3 py-2 text-base"
      />
    </label>
  );
}

function Stepper({
  value,
  onChange,
  min,
  max,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  label?: string;
}) {
  const button = "size-8 rounded-full border border-muted/40 text-lg leading-none disabled:opacity-40";
  return (
    <span className="inline-flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" className={button} onClick={() => onChange(value - 1)} disabled={value <= min} aria-label="פחות">
        −
      </button>
      <span className="w-6 text-center tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" className={button} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="יותר">
        +
      </button>
    </span>
  );
}
