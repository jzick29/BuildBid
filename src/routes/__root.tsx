import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useLocation,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AnalyticsScripts } from "~/components/AnalyticsScripts";
import { UpgradeBanner } from "~/components/UpgradeBanner";
import { useSubscription } from "~/lib/useSubscription";

import appCss from "~/styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "BuildBid — Win More Profitable Work" },
      {
        name: "description",
        content:
          "Estimating platform for trade contractors. Replace spreadsheets with line-item assemblies, professional proposals, and job tracking.",
      },
      { name: "theme-color", content: "#4f46e5" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "format-detection", content: "telephone=no" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", href: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/icon-192.svg" },
    ],
  }),
  notFoundComponent: () => <div>Page not found</div>,
  component: RootComponent,
});

function RootComponent() {
  const location = useLocation();
  const isAuthPage = ["/login", "/signup", "/forgot-password", "/reset-password"].includes(location.pathname);
  const showBottomNav = !isAuthPage && location.pathname !== "/";

  return (
    <RootDocument>
      <AppBanner />
      <div className="flex min-h-dvh flex-col">
        <main className="flex-1 pb-safe">
          <Outlet />
        </main>
        {showBottomNav && <BottomNav />}
      </div>
    </RootDocument>
  );
}

function AppBanner() {
  const sub = useSubscription();
  if (!sub.loaded) return null;
  return <UpgradeBanner subscriptionTier={sub.tier} trialEndsAt={sub.trialEndsAt} />;
}

function BottomNav() {
  const location = useLocation();
  const activeClass = (path: string) =>
    location.pathname.startsWith(path)
      ? "text-indigo-600 dark:text-indigo-400"
      : "text-gray-500 dark:text-gray-400";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/95 sm:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
        <a
          href="/dashboard"
          className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium ${activeClass("/dashboard")}`}
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
          <span>Dashboard</span>
        </a>
        <a
          href="/estimates"
          className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium ${activeClass("/estimates")}`}
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <span>Estimates</span>
        </a>
        <a
          href="/templates"
          className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium ${activeClass("/templates")}`}
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>
          <span>Templates</span>
        </a>
        <a
          href="/analytics"
          className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium ${activeClass("/analytics")}`}
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          <span>Analytics</span>
        </a>
      </div>
    </nav>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <AnalyticsScripts />
      </head>
      <body className="pb-16 sm:pb-0">
        {children}
        <Scripts />
        <script
          dangerouslySetInnerHTML={{
            __html: `
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}`,
          }}
        />
      </body>
    </html>
  );
}