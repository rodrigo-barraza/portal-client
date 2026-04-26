import { Suspense } from "react";
import NavigationSidebarComponent from "@/components/NavigationSidebarComponent";
import LogsComponent from "@/components/LogsComponent";

export const metadata = {
  title: "Logs — Portal",
};

export default function LogsPage() {
  return (
    <div className="page-wrapper">
      <NavigationSidebarComponent />
      <main className="page-content">
        <Suspense>
          <LogsComponent />
        </Suspense>
      </main>
    </div>
  );
}
