// ============================================================
// Web Analytics — admin route gate
// ============================================================
// Session analytics exposes visitor IPs, geolocation, device
// fingerprints, and per-user identity, so the whole /web-analytics
// subtree is gated to the "admin" role (or private-network hosts,
// matching the middleware's LAN bypass). The role is resolved from
// accounts-service and stamped into the session at sign-in.
// ============================================================

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_ENABLED, auth } from "@/auth";
import { canAccessAdminSide } from "@/utils/adminAccess";

export default async function WebAnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, headerList] = await Promise.all([auth(), headers()]);

  const allowed = canAccessAdminSide({
    roles: session?.user?.roles,
    host: headerList.get("host"),
  });

  if (!allowed) {
    // Signed out on a public host → send to sign-in and return here.
    // Signed in without the admin role (or auth disabled) → home.
    if (AUTH_ENABLED && !session?.user) {
      redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent("/web-analytics")}`);
    }
    redirect("/");
  }

  return <>{children}</>;
}
