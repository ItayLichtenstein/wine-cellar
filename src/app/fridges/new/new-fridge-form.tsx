"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FridgePreview } from "@/components/fridge-preview";
import { DeleteFridge } from "./delete-fridge";
import type { FridgeView } from "@/lib/fridges";
import { CATALOG, capacityGroups, estimateShelves, type ModelSpec } from "@/lib/fridge-catalog";
import { createClient } from "@/lib/supabase/client";
import {
  LIMITS,
  CHOOSABLE_PRESETS,
  FRONT_LABEL,
  SHELF_PRESETS,
  bottlesLeaving,
  clamp,
  fridgeCapacity,
  frontZone,
  withoutFront,
  type PresetKey,
  type Shelf,
} from "@/lib/fridge-layout";

// A shelf in the form remembers which preset it came from, so the
// dropdown can show it. When editing, shelves and zones also keep their
// database ids: a kept id means "same place, its bottles stay".
type FormZone = Shelf["zones"][number] & { id?: string };
type FormShelf = { id?: string; preset: PresetKey; zones: FormZone[] };

const DEFAULT_SIZE: Record<PresetKey, number> = {
  twoRows: 5,
  oneRow: 5,
  doubleStack: 8,
  stacksAndRow: 8,
};

function makeShelf(preset: PresetKey): FormShelf {
  return { preset, ...SHELF_PRESETS[preset].make(DEFAULT_SIZE[preset]) };
}

/** Which dropdown entry a catalog shelf matches. */
function presetOf(shelf: Shelf): PresetKey {
  const zones = withoutFront(shelf.zones); // the front row is an extra, not part of the arrangement
  if (zones.every((z) => z.kind === "stack")) return "doubleStack";
  if (zones.some((z) => z.kind === "stack")) return "stacksAndRow";
  return zones.length === 2 ? "twoRows" : "oneRow";
}

const OTHER = "other";
/** The one extra dropdown entry: adds bottles lying across the front. */
const ADD_FRONT = "add-front";

/** The new-fridge form; with `existing` it edits that fridge instead. */
export function NewFridgeForm({ existing }: { existing?: FridgeView }) {
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? "מקרר יין");
  const [brand, setBrand] = useState(existing?.brand ?? "");
  const [model, setModel] = useState(existing?.model ?? "");
  const knownBrand = CATALOG.some((b) => b.brand === existing?.brand);
  // catalog brand, OTHER, or "" (not chosen)
  const [brandChoice, setBrandChoice] = useState(existing?.brand ? (knownBrand ? existing.brand : OTHER) : "");
  const [spec, setSpec] = useState<ModelSpec | null>(null); // the catalog model the layout came from
  // Step 2 of the picker: bottle count first, so the model list stays short.
  const [capacity, setCapacity] = useState<number | null>(
    () => CATALOG.find((b) => b.brand === existing?.brand)?.models.find((m) => m.model === existing?.model)?.capacity ?? null,
  );
  const groups = brandChoice && brandChoice !== OTHER ? capacityGroups(brandChoice) : [];
  const sameCapacity = groups.find((g) => g.capacity === capacity)?.models ?? [];
  const [shelves, setShelves] = useState<FormShelf[]>(() =>
    existing
      ? existing.shelves.map((s) => ({
          id: s.id,
          preset: presetOf(s),
          zones: s.zones.map(({ id, kind, capacity, label }) => ({ id, kind, capacity, label })),
        }))
      : Array.from({ length: 6 }, () => makeShelf("twoRows")),
  );
  const [confirmed, setConfirmed] = useState(false);
  const leaving = existing
    ? bottlesLeaving(
        existing.shelves.flatMap((s) => s.zones),
        shelves.map((s) => s.zones),
      )
    : 0;
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

  function chooseBrand(value: string) {
    setBrandChoice(value);
    setSpec(null);
    setModel("");
    setCapacity(null);
    setBrand(value === OTHER ? "" : value);
  }

  /** One model with that many bottles is picked at once; several open a short model list. */
  function chooseCapacity(value: string) {
    const n = value ? Number(value) : null;
    setCapacity(n);
    const models = groups.find((g) => g.capacity === n)?.models ?? [];
    if (models.length === 1) chooseModel(models[0]);
    else {
      setSpec(null);
      setModel("");
    }
  }

  /** A catalog model replaces the shelves with its starting layout; everything stays editable. */
  function chooseModel(found: ModelSpec | null) {
    setSpec(found);
    setModel(found?.model ?? "");
    if (found) setShelves(estimateShelves(found).map((s) => ({ preset: presetOf(s), ...s })));
  }

  /**
   * The dropdown picks an arrangement; a new arrangement keeps the shelf's
   * front row. Its last entry, "+ בקבוקים בחזית", adds that row instead
   * (then it has its own counter; down to 0 removes it).
   */
  function changeArrangement(index: number, value: string) {
    setShelves((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        if (value === ADD_FRONT) return { ...s, zones: [...s.zones, { kind: "row" as const, capacity: 2, label: FRONT_LABEL }] };
        const front = frontZone(s.zones);
        const shelf = makeShelf(value as PresetKey);
        return front ? { ...shelf, zones: [...shelf.zones, front] } : shelf;
      }),
    );
  }

  function changeCapacity(shelfIndex: number, zoneIndex: number, value: number) {
    setShelves((prev) =>
      prev.map((s, i) => {
        if (i !== shelfIndex) return s;
        // The front row counts down to 0, which removes it.
        if (value < 1 && s.zones[zoneIndex] === frontZone(s.zones)) return { ...s, zones: withoutFront(s.zones) };
        const capacity = clamp(value, LIMITS.capacity.min, LIMITS.capacity.max);
        return { ...s, zones: s.zones.map((z, j) => (j === zoneIndex ? { ...z, capacity } : z)) };
      }),
    );
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("צריך לתת למקרר שם.");
      return;
    }
    // Moving bottles out of the fridge needs a second, explicit tap.
    if (leaving > 0 && !confirmed) {
      setConfirmed(true);
      return;
    }
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: rpcError } = existing
      ? await supabase.rpc("update_fridge", {
          p_fridge_id: existing.id,
          p_name: name,
          p_brand: brand || undefined,
          p_model: model || undefined,
          p_shelves: shelves.map(({ id, zones }) => ({ ...(id && { id }), zones })),
        })
      : await supabase.rpc("create_fridge", {
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
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">יצרן</span>
            <select value={brandChoice} onChange={(e) => chooseBrand(e.target.value)} className={selectClass}>
              <option value="">בחרו (לא חובה)</option>
              {CATALOG.map((b) => (
                <option key={b.brand} value={b.brand}>
                  {b.brand}
                </option>
              ))}
              <option value={OTHER}>יצרן אחר</option>
            </select>
          </label>
          {groups.length > 0 && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">כמה בקבוקים?</span>
              <select value={capacity ?? ""} onChange={(e) => chooseCapacity(e.target.value)} className={selectClass}>
                <option value="">בחרו</option>
                {groups.map((g) => (
                  <option key={g.capacity} value={g.capacity}>
                    {g.capacity}{g.models.length > 1 ? ` (${g.models.length} דגמים)` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {sameCapacity.length > 1 && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">דגם</span>
            <select
              value={model}
              onChange={(e) => chooseModel(sameCapacity.find((m) => m.model === e.target.value) ?? null)}
              className={selectClass}
            >
              <option value="">בחרו דגם</option>
              {sameCapacity.map((m) => (
                <option key={m.model} value={m.model}>
                  {m.model}
                </option>
              ))}
            </select>
          </label>
        )}
        {sameCapacity.length === 1 && <p className="text-sm text-muted">הדגם: {model}</p>}
        {brandChoice === OTHER && (
          <div className="grid grid-cols-2 gap-3">
            <TextField label="שם היצרן" value={brand} onChange={setBrand} />
            <TextField label="דגם (לא חובה)" value={model} onChange={setModel} />
          </div>
        )}
        {spec && (
          <p className="rounded-lg bg-surface px-3 py-2 text-sm text-muted">
            <span className="inline-block">
              לפי היצרן: {spec.capacity} בקבוקים, {spec.shelves} מדפים{spec.bottom ? " ואזור תחתון" : ""}.
            </span>{" "}
            <span className="inline-block">כמה בקבוקים בכל מדף – זו הערכה שלנו.</span>{" "}
            <span className="inline-block">בדקו מול המקרר ושנו מה שצריך.</span>{" "}
            {spec.note && <span className="inline-block">({spec.note})</span>}{" "}
            <a href={spec.source} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              עמוד הדגם
            </a>
          </p>
        )}
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
                  onChange={(e) => changeArrangement(i, e.target.value)}
                  className="max-w-[60%] rounded-lg border border-muted/40 bg-background px-2 py-1 text-sm"
                >
                  {/* An existing stack shelf keeps its own entry, so the select shows the truth. */}
                  {[...new Set([...CHOOSABLE_PRESETS, shelf.preset])].map((key) => (
                    <option key={key} value={key}>
                      {SHELF_PRESETS[key].title}
                    </option>
                  ))}
                  {!frontZone(shelf.zones) && shelf.zones.length < LIMITS.zonesPerShelf.max && (
                    <option value={ADD_FRONT}>+ בקבוקים בחזית</option>
                  )}
                </select>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {shelf.zones.map((zone, j) => (
                  <label key={j} className="flex items-center gap-2 text-sm">
                    <span className="text-muted">{zone.label}</span>
                    <Stepper
                      value={zone.capacity}
                      onChange={(v) => changeCapacity(i, j, v)}
                      min={zone === frontZone(shelf.zones) ? 0 : LIMITS.capacity.min}
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
        <p className="text-sm text-muted">
          סך הכול מקום ל־{fridgeCapacity(shelves)} בקבוקים
          {spec && fridgeCapacity(shelves) !== spec.capacity ? ` (היצרן: ${spec.capacity})` : ""}.
        </p>
        <FridgePreview shelves={shelves} />
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      {leaving > 0 && (
        <p role="alert" className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <span className="inline-block">
            {leaving === 1 ? "בקבוק אחד יעבור" : `${leaving} בקבוקים יעברו`} ל״מחוץ למקרר״.
          </span>{" "}
          <span className="inline-block">שום בקבוק לא נמחק, ואפשר לשבץ אותם מחדש אחר כך.</span>
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-full bg-accent px-5 py-3 font-medium text-white disabled:opacity-60 dark:text-black"
      >
        {saving ? "שומר…" : leaving > 0 && confirmed ? "כן, לשמור ולהוציא אותם" : "שמירת המקרר"}
      </button>

      {existing && (
        <DeleteFridge id={existing.id} stored={existing.shelves.flatMap((s) => s.zones).reduce((n, z) => n + z.bottles.length, 0)} />
      )}
    </form>
  );
}

const selectClass = "rounded-lg border border-muted/40 bg-surface px-3 py-2 text-base";

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
