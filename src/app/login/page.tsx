import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthError } from "./auth-error";
import { GoogleSignInButton } from "./google-sign-in-button";

export const metadata: Metadata = { title: "התחברות · מרתף יין" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <div className="text-5xl" aria-hidden="true">🍷</div>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">מרתף יין</h1>
          <p className="text-muted">
            כל הבקבוקים שלכם במקום אחד: מה יש במקרר, מה בשל לשתייה, ומה כדאי לפתוח הערב.
          </p>
        </div>

        {/* Reads the URL, so it must sit behind a Suspense boundary. */}
        <Suspense fallback={null}>
          <AuthError />
        </Suspense>

        <GoogleSignInButton />

        <p className="text-sm text-muted">
          אנחנו שומרים רק את השם והמייל מחשבון הגוגל, והמייל לא מוצג לאף אחד.{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            מדיניות הפרטיות
          </Link>
        </p>
      </div>
    </main>
  );
}
