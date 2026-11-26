"use client";

import { markAiHintSeen, readAiHintSeen, shouldShowAiHint, writeAiHintSeen } from "@/lib/ai-hint";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FridgePreview, type Place } from "@/components/fridge-preview";
import { clamp } from "@/lib/fridge-layout";
import type { FridgeView } from "@/lib/fridges";
import { useT } from "@/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { EMPTY_EXTRA, validateExtra, type WineExtra } from "@/lib/wine-extra";
import { saveExtra } from "@/app/bottle/details";
import { ExtraFields } from "@/app/bottle/extra-fields";

type WineType = "red" | "white" | "rose" | "orange" | "sparkling" | "dessert" | "fortified" | "other";
type Destination = "fridge" | "unplaced" | "in_transit";

// The common three first, the rest under "other". Names come from the dictionary.
const MAIN_TYPES: WineType[] = ["red", "white", "rose"];
const OTHER_TYPES: WineType[] = ["orange", "sparkling", "dessert", "fortified", "other"];

const THIS_YEAR = new Date().getFullYear();

export type Prefill = {
  winery: string;
  name: string;
  type: WineType;
  year: number | null;
  quantity?: number;
  price?: number | null;
  drinkFrom?: number | null;
  drinkTo?: number | null;
  extra?: Partial<WineExtra>;
  wishId?: string;
  draftId?: string;
  /** Places to start with picked (an AI draft that says where the bottles are). */
  places?: Place[];
};

export function AddBottlesForm({
  fridges,
  wines,
  initialPlace,
  prefill,
  aiConnected = true,
}: {
  fridges: FridgeView[];
  wines: { winery: string; name: string }[];
  /** No AI yet: after saving, say what a connected AI adds (instead of going straight home). */
  aiConnected?: boolean;
  /** An empty slot tapped on the home page: start with it already picked. */
  initialPlace?: Place;
  /**
   * Pre-filled form: "קניתי" on the wishlist (the wish is removed after
   * saving) or an AI draft (marked approved after saving). This form IS the
   * approval screen for AI drafts: the person checks and fixes every field.
   */
  prefill?: Prefill;
}) {
  const router = useRouter();
  const t = useT();

  const [winery, setWinery] = useState(prefill?.winery ?? "");
  const [name, setName] = useState(prefill?.name ?? "");
  const [type, setType] = useState<WineType>(prefill?.type ?? "red");
  const [year, setYear] = useState(prefill?.year ? String(prefill.year) : "");
  const [quantity, setQuantity] = useState(prefill?.quantity ?? 1);
  const [paid, setPaid] = useState(prefill?.price ? String(prefill.price) : "");
  const [morePrice, setMorePrice] = useState(false);
  const [regular, setRegular] = useState("");
  const [isGift, setIsGift] = useState(false);
  const [drinkFrom, setDrinkFrom] = useState(prefill?.drinkFrom ? String(prefill.drinkFrom) : "");
  const [drinkTo, setDrinkTo] = useState(prefill?.drinkTo ? String(prefill.drinkTo) : "");
  const [destination, setDestination] = useState<Destination>(fridges.length ? "fridge" : "unplaced");
  const [picked, setPicked] = useState<Place[]>(prefill?.places?.length ? prefill.places : initialPlace ? [initialPlace] : []);
  const [extra, setExtra] = useState({ ...EMPTY_EXTRA, ...prefill?.extra });
  const [saving, setSaving] = useState(false);
  const [savedNoAi, setSavedNoAi] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Autocomplete: wineries in the cellar, and names for the chosen winery.
  const wineries = useMemo(() => [...new Set(wines.map((w) => w.winery))], [wines]);
  const namesForWinery = useMemo(
    () => wines.filter((w) => w.winery.toLowerCase() === winery.trim().toLowerCase()).map((w) => w.name),
    [wines, winery],
  );
  const isExistingWine = namesForWinery.some((n) => n.toLowerCase() === name.trim().toLowerCase());

  function pick(place: Place) {
    setPicked((prev) => {
      const i = prev.findIndex((p) => p.zoneId === place.zoneId && p.slot === place.slot && p.slot !== null);
      if (i >= 0) return prev.filter((_, k) => k !== i); // tap a picked slot again to un-pick it
      if (prev.length >= quantity) return prev; // can't place more bottles than we have
      return [...prev, place];
    });
  }

  /** A pile place has no number: un-picking takes back one pick from that layer. */
  function unpick(place: Place) {
    setPicked((prev) => {
      const i = prev.findLastIndex((p) => p.zoneId === place.zoneId && p.slot === null);
      return i < 0 ? prev : prev.filter((_, k) => k !== i);
    });
  }

  function changeQuantity(n: number) {
    const q = clamp(n, 1, 48);
    setQuantity(q);
    setPicked((prev) => prev.slice(0, q));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!winery.trim() || !name.trim()) {
      setError(t.bottleForm.needWineryName);
      return;
    }
    // An empty year means a non-vintage wine (NV); only a typed, wrong year is an error.
    const yearNum = year.trim() ? Number(year) : null;
    if (yearNum !== null && !(Number.isInteger(yearNum) && yearNum >= 1900 && yearNum <= THIS_YEAR + 1)) {
      setError(t.bottleForm.yearRange(THIS_YEAR + 1));
      return;
    }

    const extraProblem = validateExtra(extra, t);
    if (extraProblem) {
      setError(extraProblem);
      return;
    }

    setSaving(true);
    const places = destination === "fridge" ? picked : [];
    const supabase = createClient();
    const { data: ids, error: rpcError } = await supabase.rpc("add_bottles", {
      p_winery: winery,
      p_name: name,
      p_quantity: quantity,
      p_type: type,
      p_year: yearNum ?? undefined,
      p_places: places.map((p) => (p.slot === null ? { zone_id: p.zoneId } : { zone_id: p.zoneId, slot: p.slot })),
      p_rest_status: destination === "in_transit" ? "in_transit" : "unplaced",
      p_paid: paid ? Number(paid) : isGift ? 0 : undefined,
      p_regular: morePrice && regular ? Number(regular) : undefined,
      p_is_gift: isGift,
      p_drink_from: Number(drinkFrom) || undefined,
      p_drink_to: Number(drinkTo) || undefined,
    });

    if (rpcError) {
      setSaving(false);
      setError(
        rpcError.code === "23505"
          ? t.bottleForm.placeTaken
          : t.bottleForm.saveFailed,
      );
      return;
    }
    // Extra details only if something was filled in (same wine + vintage for all new bottles).
    if (JSON.stringify(extra) !== JSON.stringify(EMPTY_EXTRA) && ids?.length) {
      const { data: v } = await supabase.from("bottles").select("vintage_id, wine_vintages(wine_id)").eq("id", ids[0]).single();
      const ok = v?.wine_vintages && (await saveExtra(v.wine_vintages.wine_id, v.vintage_id, ids, extra));
      if (!ok) {
        setSaving(false);
        setError(t.bottleForm.addExtraFailed);
        return;
      }
    }
    // Bought it: the wish is done. (If this fails the wish just stays.)
    if (prefill?.wishId) await supabase.from("wishlist_items").delete().eq("id", prefill.wishId);
    // Approved: the draft leaves the waiting list.
    if (prefill?.draftId) {
      await supabase.from("drafts").update({ status: "approved", decided_at: new Date().toISOString() }).eq("id", prefill.draftId);
    }
    if (!aiConnected) {
      const seen = readAiHintSeen();
      const now = Date.now();
      if (shouldShowAiHint(seen, now)) {
        writeAiHintSeen(markAiHintSeen(seen, now));
        setSavedNoAi(true);
        return;
      }
    }
    router.push("/");
    router.refresh();
  }

  if (savedNoAi) {
    return (
      <section className="flex flex-col items-center gap-4 py-8 text-center">
        <h2 className="text-2xl font-bold">{t.bottleForm.savedTitle} 🍷</h2>
        <p className="text-muted">{t.bottleForm.savedAiHint}</p>
        <div className="flex w-full flex-col gap-2">
          <Link href="/ai" className="rounded-full bg-accent px-4 py-3 font-medium text-white dark:text-black">
            {t.bottleForm.savedConnect}
          </Link>
          <Link href="/" onClick={() => router.refresh()} className="rounded-full border border-muted/40 px-4 py-3">
            {t.bottleForm.savedToFridge}
          </Link>
        </div>
      </section>
    );
  }

  const leftOver = destination === "fridge" ? quantity - picked.length : 0;

  return (
    <form onSubmit={save} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-lg font-semibold">{t.bottleForm.whichWine}</legend>
        <Field label={t.bottleForm.winery}>
          <input value={winery} onChange={(e) => setWinery(e.target.value)} dir="auto" list="wineries" maxLength={120} required className={inputClass} />
          <datalist id="wineries">
            {wineries.map((w) => (
              <option key={w} value={w} />
            ))}
          </datalist>
        </Field>
        <Field label={t.bottleForm.wineName}>
          <input value={name} onChange={(e) => setName(e.target.value)} dir="auto" list="wine-names" maxLength={120} required className={inputClass} />
          <datalist id="wine-names">
            {namesForWinery.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </Field>
        {isExistingWine ? (
          <p className="text-sm text-muted">{t.bottleForm.existingWine}</p>
        ) : (
          <Field label={t.bottleForm.type}>
            <select value={type} onChange={(e) => setType(e.target.value as WineType)} className={inputClass}>
              {MAIN_TYPES.map((v) => (
                <option key={v} value={v}>
                  {t.wineType[v]}
                </option>
              ))}
              <optgroup label={t.bottleForm.other}>
                {OTHER_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {t.wineType[v]}
                  </option>
                ))}
              </optgroup>
            </select>
          </Field>
        )}
        <div className="flex items-end gap-3">
          <Field label={t.bottleForm.vintage}>
            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              inputMode="numeric"
              maxLength={4}
              className={`${inputClass} w-24`}
            />
          </Field>
          <span className="pb-2 text-sm text-muted">{year.trim() ? "" : t.bottleForm.noVintage}</span>
        </div>
        <ExtraFields value={extra} onChange={setExtra} />
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-lg font-semibold">{t.bottleForm.howMany}</legend>
        <div className="flex items-center gap-3">
          <span>{t.bottleForm.quantity}</span>
          <Stepper value={quantity} onChange={changeQuantity} min={1} max={48} />
        </div>
        <Field label={t.bottleForm.paidOptional}>
          <input value={paid} onChange={(e) => setPaid(e.target.value)} inputMode="decimal" className={`${inputClass} w-32`} />
        </Field>
        {!morePrice ? (
          <button type="button" onClick={() => setMorePrice(true)} className="self-start text-sm underline underline-offset-2">
            {t.bottleForm.dealOrGift}
          </button>
        ) : (
          <div className="flex flex-wrap items-end gap-4">
            <Field label={t.bottleForm.regular}>
              <input value={regular} onChange={(e) => setRegular(e.target.value)} inputMode="decimal" className={`${inputClass} w-32`} />
            </Field>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" checked={isGift} onChange={(e) => setIsGift(e.target.checked)} />
              {t.bottleForm.gotAsGift}
            </label>
          </div>
        )}
        <div className="flex items-end gap-3">
          <Field label={t.bottleForm.windowFromOptional}>
            <input value={drinkFrom} onChange={(e) => setDrinkFrom(e.target.value)} inputMode="numeric" maxLength={4} className={`${inputClass} w-24`} />
          </Field>
          <Field label={t.bottleForm.toYear}>
            <input value={drinkTo} onChange={(e) => setDrinkTo(e.target.value)} inputMode="numeric" maxLength={4} className={`${inputClass} w-24`} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-lg font-semibold">{t.bottleForm.where(quantity)}</legend>
        {/* A choice, not an action: radio options in one row. Saving is only the button at the bottom. */}
        <div role="radiogroup" aria-label={t.bottleForm.location} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-surface p-1 text-sm shadow-sm">
          {fridges.length > 0 && <Choice value="fridge" current={destination} onChange={setDestination} label={t.bottleForm.inFridge} />}
          <Choice value="unplaced" current={destination} onChange={setDestination} label={t.bottleForm.outside} />
          <Choice value="in_transit" current={destination} onChange={setDestination} label={t.bottleForm.inTransit} />
        </div>

        {destination === "fridge" && (
          <>
            <p className="text-sm text-muted">
              <span className="inline-block">{t.bottleForm.pickPlaces(picked.length, quantity)}</span>{" "}
              <span className="inline-block">{t.bottleForm.tapAgain}</span>
              {leftOver > 0 && (
                <>
                  {" "}
                  <span className="inline-block">{t.bottleForm.leftOver(leftOver)}</span>
                </>
              )}
            </p>
            {picked.length > 0 && (
              <button type="button" onClick={() => setPicked([])} className="self-start text-sm underline underline-offset-2">
                {t.bottleForm.clearPicks}
              </button>
            )}
            {fridges.map((f) => (
              <div key={f.id} className="flex flex-col gap-1">
                {fridges.length > 1 && <h3 className="font-medium">{f.name}</h3>}
                <FridgePreview shelves={f.shelves} onPick={pick} onUnpick={unpick} picked={picked} />
              </div>
            ))}
          </>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      {/* Always in view, just above the tab bar: nothing is saved until this is pressed. */}
      <div className="sticky bottom-[calc(57px+env(safe-area-inset-bottom))] z-30 -mx-4 bg-gradient-to-t from-background from-70% to-transparent px-4 pt-4 pb-3">
        <button type="submit" disabled={saving} className="w-full rounded-full bg-accent px-5 py-3 font-medium text-white shadow-md disabled:opacity-60 dark:text-black">
          {saving ? t.bottleForm.saving : t.bottleForm.saveLabel(quantity, destination)}
        </button>
      </div>
    </form>
  );
}

const inputClass = "rounded-lg border border-muted/40 bg-surface px-3 py-2 text-base";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}


function Choice({
  value,
  current,
  onChange,
  label,
}: {
  value: Destination;
  current: Destination;
  onChange: (d: Destination) => void;
  label: string;
}) {
  const on = value === current;
  return (
    <label
      className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-center has-[:focus-visible]:outline-2 ${
        on ? "bg-background font-medium text-foreground shadow-sm" : "text-muted"
      }`}
    >
      <input type="radio" name="destination" checked={on} onChange={() => onChange(value)} className="size-3.5 shrink-0 accent-[var(--accent)]" />
      {label}
    </label>
  );
}

function Stepper({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min: number; max: number }) {
  const t = useT();
  const button = "size-9 rounded-full border border-muted/40 text-lg leading-none disabled:opacity-40";
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className={button} onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={t.bottleForm.less}>
        −
      </button>
      <span className="w-6 text-center tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" className={button} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={t.bottleForm.more}>
        +
      </button>
    </span>
  );
}
