import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useLocation,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AnalyticsScripts } from "~/components/AnalyticsScripts";
import { BottomNav } from "~/components/BottomNav";
import { OfflineBanner } from "~/components/OfflineBanner";
import { InstallPrompt } from "~/components/InstallPrompt";
import { useState, useEffect } from "react";

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

// SVG icon paths keyed by name
const icons: Record<string, string> = {
  dashboard: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  estimates: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  templates: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
  analytics: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  invoices: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z",
  changeOrders: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  contracts: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  schedule: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  pipeline: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2",
  materials: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  priceLists: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
  customers: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  team: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  automations: "M13 10V3L4 14h7v7l9-11h-7z",
  settings: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  integrations: "M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z",
  admin: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4",
  import: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10",
  share: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z",
  signout: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
  portal: "M15 9a2 2 0 10-4 0v5a2 2 0 004 0V9zm-6 3a6 6 0 0012 0M9 12a6 6 0 11-12 0m6 0a6 6 0 0112 0m-6 3v2",
};

type NavSection = { label: string; items: { href: string; label: string; icon: string; adminOnly?: boolean }[] };

const navSections: NavSection[] = [
  {
    label: "Main",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/estimates", label: "Estimates", icon: "estimates" },
      { href: "/templates", label: "Templates", icon: "templates" },
    ],
  },
  {
    label: "Financial",
    items: [
      { href: "/invoices", label: "Invoices", icon: "invoices" },
      { href: "/change-orders", label: "Change Orders", icon: "changeOrders" },
      { href: "/contracts", label: "Contracts", icon: "contracts" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/schedule", label: "Schedule", icon: "schedule" },
      { href: "/pipeline", label: "Pipeline", icon: "pipeline" },
      { href: "/materials", label: "Materials", icon: "materials" },
      { href: "/price-lists", label: "Price Lists", icon: "priceLists" },
      { href: "/customers", label: "Customers", icon: "customers" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/analytics", label: "Analytics", icon: "analytics" },
      { href: "/team", label: "Team", icon: "team" },
      { href: "/automation", label: "Automations", icon: "automations" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/settings", label: "Settings", icon: "settings" },
      { href: "/integrations", label: "Integrations", icon: "integrations" },
      { href: "/admin", label: "Admin", icon: "admin", adminOnly: true },
      { href: "/import", label: "Import", icon: "import" },
      { href: "/portal-access", label: "Client Portal", icon: "portal" },
      { href: "/share", label: "Share", icon: "share" },
    ],
  },
];

function RootComponent() {
  const location = useLocation();
  const isAuthPage = ["/login", "/signup", "/forgot-password", "/reset-password"].includes(location.pathname);
  const isHome = location.pathname === "/";
  const isPortal = location.pathname.startsWith("/portal");
  const showNav = !isAuthPage && !isHome && !isPortal;

  return (
    <RootDocument>
      <OfflineBanner />
      {showNav && <DesktopNav />}
      <div className="flex min-h-dvh flex-col">
        <main className={`flex-1 pb-safe ${showNav ? "sm:ml-56" : ""}`}>
          <Outlet />
        </main>
        {showNav && <BottomNav />}
        <InstallPrompt />
      </div>
    </RootDocument>
  );
}

function DesktopNav() {
  const location = useLocation();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d?.user) setUser(d.user); })
      .catch(() => {});
  }, []);

  const isAdmin = user?.role === "admin";

  const activeClass = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/")
      ? "bg-indigo-50 text-indigo-600 border-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 dark:border-indigo-400"
      : "text-gray-600 hover:text-gray-900 border-transparent dark:text-gray-400 dark:hover:text-gray-100";

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await fetch("/api/logout", { method: "POST", credentials: "include" });
    window.location.href = "/";
  };

  return (
    <aside className="hidden sm:flex sm:flex-col sm:fixed sm:inset-y-0 sm:left-0 sm:w-56 sm:border-r sm:border-gray-200 sm:bg-white sm:dark:border-gray-800 sm:dark:bg-gray-950 sm:z-40">
      <div className="flex h-14 items-center border-b border-gray-200 px-4 dark:border-gray-800 shrink-0">
        <a href="/dashboard" className="text-lg font-bold tracking-tight text-indigo-600 dark:text-indigo-400">BuildBid</a>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {navSections.map((section) => {
          const sectionItems = section.items.filter(item => !item.adminOnly || isAdmin);
          if (sectionItems.length === 0) return null;
          return (
            <div key={section.label}>
              <h3 className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">{section.label}</h3>
              <div className="space-y-0.5">
                {sectionItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg border-l-2 px-3 py-1.5 text-sm font-medium transition-colors ${activeClass(item.href)}`}
                  >
                    <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d={icons[item.icon] || icons.dashboard} />
                    </svg>
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-gray-200 p-3 dark:border-gray-800 shrink-0">
        {user && (
          <div className="mb-2 px-3 text-xs text-gray-400 dark:text-gray-500 truncate">{user.email}</div>
        )}
        <a href="/api/logout" onClick={handleLogout} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d={icons.signout} />
          </svg>
          Sign Out
        </a>
      </div>
    </aside>
  );
}

function MobileNav() {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);

  const activeClass = (path: string) =>
    location.pathname.startsWith(path)
      ? "text-indigo-600 dark:text-indigo-400"
      : "text-gray-500 dark:text-gray-400";

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/95 sm:hidden">
        <div className="flex items-center justify-around overflow-x-auto py-2 px-1 gap-0">
          {[
            { href: "/dashboard", label: "Home", icon: "dashboard" },
            { href: "/estimates", label: "Bids", icon: "estimates" },
            { href: "/templates", label: "Templates", icon: "templates" },
            { href: "/invoices", label: "Invoices", icon: "invoices" },
            { href: "/analytics", label: "Stats", icon: "analytics" },
          ].map(item => (
            <a
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium shrink-0 ${activeClass(item.href)}`}
              style={{ minWidth: 44, minHeight: 44 }}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={icons[item.icon] || icons.dashboard} />
              </svg>
              <span>{item.label}</span>
            </a>
          ))}
          <button
            onClick={() => setShowMore(!showMore)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium shrink-0 ${showMore ? "text-indigo-600 dark:text-indigo-400" : "text-gray-500 dark:text-gray-400"}`}
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* More menu drawer */}
      {showMore && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 sm:hidden" onClick={() => setShowMore(false)} />
          <div className="fixed inset-x-0 bottom-16 z-50 mx-4 rounded-t-2xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 shadow-2xl sm:hidden max-h-[60vh] overflow-y-auto">
            <div className="p-4 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 px-3 mb-2">More Navigation</p>
              {[
                { href: "/schedule", label: "Schedule", icon: "schedule" },
                { href: "/pipeline", label: "Pipeline", icon: "pipeline" },
                { href: "/materials", label: "Materials", icon: "materials" },
                { href: "/price-lists", label: "Price Lists", icon: "priceLists" },
                { href: "/customers", label: "Customers", icon: "customers" },
                { href: "/invoices", label: "Invoices", icon: "invoices" },
                { href: "/change-orders", label: "Change Orders", icon: "changeOrders" },
                { href: "/contracts", label: "Contracts", icon: "contracts" },
                { href: "/team", label: "Team", icon: "team" },
                { href: "/automation", label: "Automations", icon: "automations" },
                { href: "/settings", label: "Settings", icon: "settings" },
                { href: "/integrations", label: "Integrations", icon: "integrations" },
                { href: "/import", label: "Import", icon: "import" },
                { href: "/share", label: "Share", icon: "share" },
              ].map(item => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setShowMore(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${activeClass(item.href)}`}
                >
                  <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={icons[item.icon] || icons.dashboard} />
                  </svg>
                  {item.label}
                </a>
              ))}
              <div className="border-t border-gray-200 dark:border-gray-800 mt-2 pt-2">
                <a href="/api/logout" onClick={async (e) => { e.preventDefault(); await fetch("/api/logout", { method: "POST", credentials: "include" }); window.location.href = "/"; }} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={icons.signout} />
                  </svg>
                  Sign Out
                </a>
              </div>
            </div>
          </div>
        </>
      )}
    </>
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
      </body>
    </html>
  );
}
