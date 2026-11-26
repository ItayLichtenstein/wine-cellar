import { redirect } from "next/navigation";

/** The old long "More" page is now split into its own pages; saved links land in settings. */
export default function MorePage() {
  redirect("/settings");
}
