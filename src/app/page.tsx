"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSettings, LANDING_PAGES } from "@/lib/settings";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    const { defaultPage } = getSettings();
    const isKnownPage = LANDING_PAGES.some((page) => page.value === defaultPage);
    router.replace(isKnownPage ? defaultPage : "/containers");
  }, [router]);

  return null;
}
