import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useLocation,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AnalyticsScripts } from "~/components/AnalyticsScripts";

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
  const isHome = location.pathname === "/";
  const showNav = !isAuthPage && !isHome;

  return (
    <RootDocument>
      {showNav && <DesktopNav />}
      <div className="flex min-h-dvh flex-col">
        <main className={`flex-1 pb-safe ${showNav ? "sm:ml-56" : ""}`}>
          <Outlet />
        </main>
        {showNav && <MobileNav />}
      </div>
    </RootDocument>
  );
}

function DesktopNav() {
  const location = useLocation();
  const active = (path: string) =>
    location.pathname.startsWith(path)
      ? "bg-indigo-50 text-indigo-600 border-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 dark:border-indigo-400"
      : "text-gray-600 hover:text-gray-900 border-transparent dark:text-gray-400 dark:hover:text-gray-100";

  return (
    <aside className="hidden sm:flex sm:flex-col sm:fixed sm:inset-y-0 sm:left-0 sm:w-56 sm:border-r sm:border-gray-200 sm:bg-white sm:dark:border-gray-800 sm:dark:bg-gray-950 sm:z-40">
      <div className="flex h-14 items-center border-b border-gray-200 px-4 dark:border-gray-800">
        <a href="/dashboard" className="text-lg font-bold tracking-tight text-indigo-600 dark:text-indigo-400">BuildBid</a>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {[
          { href: "/dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
          { href: "/estimates", label: "Estimates", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
          { href: "/templates", label: "Templates", icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" },
          { href: "/analytics", label: "Analytics", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
          { href: "/settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm font-medium transition-colors ${active(item.href)}`}
          >
            <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d={item.icon}/></svg>
            {item.label}
          </a>
        ))}
      </nav>
      <div className="border-t border-gray-200 p-3 dark:border-gray-800">
        <a href="/api/logout" onClick={async (e) => { e.preventDefault(); await fetch("/api/logout", { method: "POST", credentials: "include" }); window.location.href = "/"; }} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          Sign Out
        </a>
      </div>
    </aside>
  );
}

function MobileNav() {
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