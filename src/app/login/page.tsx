import { pageTitle } from "@/i18n/metadata";
import Link from "next/link";
import { Suspense } from "react";
import { getT } from "@/i18n/server";
import { AuthError } from "./auth-error";
import { GoogleSignInButton } from "./google-sign-in-button";

export const generateMetadata = pageTitle((t) => t.titles.login);

export default async function LoginPage() {
  const t = (await getT()).login;
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <div className="text-5xl" aria-hidden="true">🍷</div>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">{t.title}</h1>
          {/* Each span is one unit of meaning; lines break only between them. */}
          <p className="text-muted">
            {t.tagline.map((line, i) => (
              <span key={line}>
                {i > 0 && " "}
                <span className="inline-block">{line}</span>
              </span>
            ))}
          </p>
        </div>

        {/* Reads the URL, so it must sit behind a Suspense boundary. */}
        <Suspense fallback={null}>
          <AuthError />
        </Suspense>

        <GoogleSignInButton />

        <p className="text-sm text-muted">
          <span className="inline-block">{t.keep}</span>{" "}
          <span className="inline-block">
            {t.notShown}{" "}
            <Link href="/privacy" className="underline underline-offset-2">
              {t.privacy}
            </Link>
          </span>
        </p>
      </div>
    </main>
  );
}
