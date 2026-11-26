"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { inputClass } from "@/app/bottle/details";
import { useT } from "@/i18n/provider";
import {
  IMPORT_FIELDS,
  MAX_BOTTLES,
  MAX_FILE_BYTES,
  buildImport,
  guessMapping,
  parseCsv,
  summarize,
  type ImportField,
  type Mapping,
} from "@/lib/import-csv";
import { importBottles } from "./actions";

type Loaded = { name: string; hash: string | null; header: string[]; rows: string[][] };
const SHOWN_ERRORS = 8;

/**
 * Three steps: choose a file → preview (with the column matching) → import.
 * The file is read here in the browser and never uploaded; only the bottles
 * it turns into are sent, to a Server Action that checks them again.
 */
export function ImportFlow({
  bottlesInCellar,
  hasFridge,
  wineKeys,
  importedHashes,
}: {
  bottlesInCellar: number;
  hasFridge: boolean;
  wineKeys: string[];
  importedHashes: string[];
}) {
  const t = useT().importer;
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<Loaded | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "reading" | "busy" | { done: number } | { error: string }>("idle");

  const today = new Date().toISOString().slice(0, 10);
  const built = useMemo(() => (file ? buildImport(file.rows, mapping, today) : null), [file, mapping, today]);
  const sum = built ? summarize(built.bottles) : null;
  const existing = useMemo(() => {
    if (!built) return 0;
    const known = new Set(wineKeys);
    return new Set(built.bottles.map((b) => `${b.winery.toLowerCase()}\u0000${b.name.toLowerCase()}`).filter((k) => known.has(k))).size;
  }, [built, wineKeys]);

  async function choose(f: File | undefined) {
    if (!f) return;
    setProblem(null);
    setState("idle");
    if (f.size > MAX_FILE_BYTES) return setProblem(t.tooBig);
    if (!/\.(csv|txt)$/i.test(f.name) && !/csv|text\/plain/.test(f.type)) return setProblem(t.notCsv);
    setState("reading");
    const text = await f.text();
    const all = parseCsv(text);
    setState("idle");
    if (all.length < 2) return setProblem(t.empty);
    const [header, ...rows] = all;
    setFile({ name: f.name, hash: await sha256(text), header, rows });
    setMapping(guessMapping(header));
  }

  async function run() {
    if (!built || !file) return;
    setState("busy");
    const res = await importBottles({ source: "csv", fileHash: file.hash, bottles: built.bottles });
    if (res.ok) {
      setState({ done: res.bottles });
      router.refresh();
    } else setState({ error: t.errors[res.error] });
  }

  function reset() {
    setFile(null);
    setState("idle");
    if (input.current) input.current.value = "";
  }

  if (typeof state === "object" && "done" in state) {
    return (
      <section className="flex flex-col items-start gap-3 rounded-xl bg-surface p-4 shadow-sm">
        <p className="text-lg font-semibold" role="status">
          ✓ {t.done(state.done)}
        </p>
        <p className="text-sm text-muted">{hasFridge ? t.placeNow : t.noFridgeYet}</p>
        <Link href={hasFridge ? "/" : "/bottles"} className="rounded-full bg-accent px-5 py-2.5 font-medium text-white dark:text-black">
          {hasFridge ? t.toFridge : t.toList}
        </Link>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {!file && (
        <div className="flex flex-col items-start gap-2">
          <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" id="import-file" onChange={(e) => choose(e.target.files?.[0])} />
          <label htmlFor="import-file" className="cursor-pointer rounded-full bg-accent px-5 py-2.5 font-medium text-white dark:text-black">
            {state === "reading" ? t.reading : t.choose}
          </label>
          <p className="text-sm text-muted">{t.formats}</p>
          <p className="text-xs text-muted">{t.excelHint}</p>
          {problem && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {problem}
            </p>
          )}
        </div>
      )}

      {file && built && sum && (
        <>
          <div className="flex flex-col gap-2 rounded-xl bg-surface p-4 text-sm shadow-sm">
            <p className="text-xs text-muted" dir="auto">
              {file.name}
            </p>
            <p className="text-base font-semibold">{t.summary(sum.bottles, sum.toPlace, sum.consumed, sum.wines)}</p>
            {hasFridge && <p className="text-muted">{t.placeLater}</p>}
            {bottlesInCellar > 0 && <p>{t.notEmpty(bottlesInCellar)}</p>}
            {existing > 0 && <p>{t.existingWines(existing)}</p>}
            {file.hash && importedHashes.includes(file.hash) && <p className="font-medium text-red-700 dark:text-red-400">{t.sameFile}</p>}
            {sum.bottles > MAX_BOTTLES && <p className="font-medium text-red-700 dark:text-red-400">{t.tooManyBottles(MAX_BOTTLES)}</p>}
            {built.errors.length > 0 && (
              <details>
                <summary className="cursor-pointer">{t.skipped(built.errors.length)}</summary>
                <ul className="mt-1 flex flex-col gap-0.5 text-muted">
                  {built.errors.slice(0, SHOWN_ERRORS).map((e) => (
                    <li key={e.row}>{t.rowError(e.row, t.reasons[e.reason])}</li>
                  ))}
                  {built.errors.length > SHOWN_ERRORS && <li>{t.moreErrors(built.errors.length - SHOWN_ERRORS)}</li>}
                </ul>
              </details>
            )}
          </div>

          <details open={mapping.winery === undefined || mapping.name === undefined} className="rounded-xl border border-muted/30 p-3 text-sm">
            <summary className="cursor-pointer font-medium">{t.columns}</summary>
            <p className="mt-1 text-muted">{t.columnsHint}</p>
            <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5">
              {IMPORT_FIELDS.map((f) => (
                <FieldRow key={f} field={f} label={t.fields[f]} header={file.header} mapping={mapping} none={t.none} onChange={setMapping} />
              ))}
            </div>
          </details>

          {(mapping.winery === undefined || mapping.name === undefined) && <p className="text-sm text-red-700 dark:text-red-400">{t.needColumns}</p>}
          {typeof state === "object" && "error" in state && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {state.error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={run}
              disabled={state === "busy" || sum.bottles === 0 || sum.bottles > MAX_BOTTLES || mapping.winery === undefined || mapping.name === undefined}
              className="rounded-full bg-accent px-5 py-2.5 font-medium text-white disabled:opacity-50 dark:text-black"
            >
              {state === "busy" ? t.importing : t.importNow(sum.bottles)}
            </button>
            <button type="button" onClick={reset} className="rounded-full border border-muted/40 px-5 py-2.5">
              {t.otherFile}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function FieldRow({
  field,
  label,
  header,
  mapping,
  none,
  onChange,
}: {
  field: ImportField;
  label: string;
  header: string[];
  mapping: Mapping;
  none: string;
  onChange: (m: Mapping) => void;
}) {
  const value = mapping[field];
  return (
    <>
      <label htmlFor={`col-${field}`} className="text-muted">
        {label}
      </label>
      <select
        id={`col-${field}`}
        value={value ?? ""}
        onChange={(e) => {
          const next = { ...mapping };
          if (e.target.value === "") delete next[field];
          else next[field] = Number(e.target.value);
          onChange(next);
        }}
        className={`${inputClass} py-1`}
        dir="auto"
      >
        <option value="">{none}</option>
        {header.map((h, i) => (
          <option key={i} value={i}>
            {h || `#${i + 1}`}
          </option>
        ))}
      </select>
    </>
  );
}

/** SHA-256 of the file's text, to recognise a file that was already imported. */
async function sha256(text: string): Promise<string | null> {
  if (!crypto?.subtle) return null; // only on https or localhost
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
