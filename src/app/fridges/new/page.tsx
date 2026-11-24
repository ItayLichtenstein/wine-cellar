import type { Metadata } from "next";
import Link from "next/link";
import { NewFridgeForm } from "./new-fridge-form";

export const metadata: Metadata = { title: "מקרר חדש · מרתף יין" };

export default function NewFridgePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <Link href="/" className="text-sm text-muted underline-offset-2 hover:underline">
          → חזרה
        </Link>
        <h1 className="text-2xl font-bold">הגדרת מקרר</h1>
        <p className="text-muted">ספרו לנו איך המקרר שלכם בנוי. תמיד אפשר לשנות אחר כך.</p>
      </header>
      <NewFridgeForm />
    </main>
  );
}
