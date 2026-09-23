import type { ReactNode } from "react";
import PageLayoutComponent from "@/components/PageLayoutComponent";

/**
 * Shared chrome for every portal page. Living in a layout (not in each
 * page) keeps the sidebar mounted across navigations — it used to remount
 * per page, re-reading its collapsed state and jumping open→closed on every
 * click for users who keep it collapsed.
 */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return <PageLayoutComponent>{children}</PageLayoutComponent>;
}
