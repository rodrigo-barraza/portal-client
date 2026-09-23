"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSettings } from "@/lib/settings";

/**
 * Root route — sends the user to their configured landing page
 * (Settings → Dashboard). The choice lives in localStorage, so the
 * redirect has to happen client-side. The settings store only ever
 * holds a page from LANDING_PAGES.
 */
export default function Page() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getSettings().defaultPage);
  }, [router]);

  return null;
}
