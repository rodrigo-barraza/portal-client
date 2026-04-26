import NavigationSidebarComponent from "@/components/NavigationSidebarComponent";
import PortfolioComponent from "@/components/PortfolioComponent";

export const metadata = {
  title: "Portfolio — Portal",
};

export default function PortfolioPage() {
  return (
    <div className="page-wrapper">
      <NavigationSidebarComponent />
      <main className="page-content">
        <PortfolioComponent />
      </main>
    </div>
  );
}
