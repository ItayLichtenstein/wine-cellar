import Link from "next/link";

/** Shown for any unknown address – and for a wine or fridge of another cellar (RLS hides it). */
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="text-5xl" aria-hidden="true">🍷</div>
      <h1 className="text-2xl font-bold">העמוד לא נמצא</h1>
      <p className="text-muted">
        <span className="inline-block">אולי הקישור ישן,</span>{" "}
        <span className="inline-block">או שהיין כבר לא במרתף</span>
      </p>
      <Link href="/" className="rounded-full bg-accent px-5 py-3 font-medium text-white dark:text-black">
        חזרה למרתף
      </Link>
    </main>
  );
}
