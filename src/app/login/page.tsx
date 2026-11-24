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
          {/* Each span is one unit of meaning; lines break only between them. */}
          <p className="text-muted">
            <span className="inline-block">כל הבקבוקים שלכם במקום אחד:</span>{" "}
            <span className="inline-block">מה יש במקרר, מה בשל לשתייה,</span>{" "}
            <span className="inline-block">ומה כדאי לפתוח הערב.</span>
          </p>
        </div>

        {/* Reads the URL, so it must sit behind a Suspense boundary. */}
        <Suspense fallback={null}>
          <AuthError />
        </Suspense>

        <GoogleSignInButton />

        <p className="text-sm text-muted">
          <span className="inline-block">אנחנו שומרים רק את השם והמייל מחשבון הגוגל,</span>{" "}
          <span className="inline-block">
            והמייל לא מוצג לאף אחד.{" "}
            <Link href="/privacy" className="underline underline-offset-2">
              מדיניות הפרטיות
            </Link>
          </span>
        </p>
      </div>
    </main>
  );
}
