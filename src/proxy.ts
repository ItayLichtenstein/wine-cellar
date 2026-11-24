import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 calls this file "proxy" (it used to be "middleware").
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on pages only – not on static files, images or the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
