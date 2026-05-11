import PageLayoutComponent from "@/components/PageLayoutComponent";
import SettingsComponent from "@/components/SettingsComponent";

export const metadata = {
  title: "Settings — Portal",
};

export default function SettingsPage() {
  return (
    <PageLayoutComponent>
      <SettingsComponent />
    </PageLayoutComponent>
  );
}
