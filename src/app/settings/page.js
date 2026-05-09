import NavigationSidebarComponent from "@/components/NavigationSidebarComponent";
import SettingsComponent from "@/components/SettingsComponent";

export const metadata = {
  title: "Settings — Portal",
};

export default function SettingsPage() {
  return (
    <div className="page-wrapper">
      <NavigationSidebarComponent />
      <main className="page-content">
        <SettingsComponent />
      </main>
    </div>
  );
}
