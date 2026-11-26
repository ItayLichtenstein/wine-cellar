import { appIcon } from "@/lib/app-icon";

const SIZES = new Set([192, 512]);

/** Icons for the web app manifest (installing to the home screen). */
export async function GET(_request: Request, { params }: RouteContext<"/pwa-icon/[size]">) {
  const size = Number((await params).size);
  if (!SIZES.has(size)) return new Response(null, { status: 404 });
  return appIcon(size);
}
