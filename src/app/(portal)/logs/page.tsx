import type { Metadata } from "next";
import { Suspense } from "react";
import LogsComponent from "@/components/LogsComponent";

export const metadata: Metadata = {
  title: "Logs — Portal",
};

export default function LogsPage() {
  // LogsComponent reads ?container= via useSearchParams, which needs a
  // Suspense boundary to prerender.
  return (
    <Suspense>
      <LogsComponent />
    </Suspense>
  );
}
