"use client";

import { useEffect, useState } from "react";
import { loadBottleDetails, type BottleDetails } from "./bottle/details";
import { DetailsView } from "./bottle/details-view";
import { DrinkForm } from "./bottle/drink-form";
import { EditForm } from "./bottle/edit-form";

type Props = {
  bottleId: string;
  onClose: () => void;
  onMove: () => void;
  /** Called after a change, so the page reloads its data. */
  onChanged: () => void;
};

/** The card that opens from the bottom when you tap a bottle. */
export function BottleSheet({ bottleId, onClose, onMove, onChanged }: Props) {
  const [details, setDetails] = useState<BottleDetails | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [step, setStep] = useState<"details" | "drink" | "edit">("details");

  useEffect(() => {
    let cancelled = false;
    loadBottleDetails(bottleId).then(
      (d) => !cancelled && setDetails(d),
      () => !cancelled && setLoadError(true),
    );
    return () => {
      cancelled = true;
    };
  }, [bottleId]);

  // Close with Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="פרטי בקבוק"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-t-3xl bg-background p-5 pb-8 shadow-2xl"
      >
        <div className="mx-auto h-1.5 w-10 rounded-full bg-muted/40" aria-hidden="true" />
        {loadError && <p role="alert">לא הצלחנו לטעון את הבקבוק.</p>}
        {!details && !loadError && <p className="text-muted">טוען…</p>}
        {details && step === "details" && (
          <DetailsView
            details={details}
            onDrink={() => setStep("drink")}
            onMove={onMove}
            onEdit={() => setStep("edit")}
            onClose={onClose}
          />
        )}
        {details && step === "drink" && <DrinkForm details={details} onCancel={() => setStep("details")} onDone={onChanged} />}
        {details && step === "edit" && <EditForm details={details} onCancel={() => setStep("details")} onDone={onChanged} />}
      </div>
    </div>
  );
}
