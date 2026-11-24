// The two values every Supabase client needs.
// Both are public by design: they end up in the browser. Security comes
// from Row Level Security in the database, not from hiding these.
// (Next.js inlines NEXT_PUBLIC_ variables only when written out in full,
// so they can't be read through a helper like process.env[name].)

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
      "Copy .env.example to .env.local and fill it in.",
  );
}

export const supabaseUrl: string = url;
export const supabaseKey: string = key;
