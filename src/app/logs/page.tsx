import { Suspense } from "react";
import PageLayoutComponent from "@/components/PageLayoutComponent";
import LogsComponent from "@/components/LogsComponent";

export const metadata = {
  title: "Logs — Portal",
};

export default function LogsPage() {
  return (
    <PageLayoutComponent>
      <Suspense>
        <LogsComponent />
      </Suspense>
    </PageLayoutComponent>
  );
}
