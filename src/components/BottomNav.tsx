import { useState, useEffect, useRef } from "react";

const tabs = [
  { label: "Dashboard", href: "/dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" },
  { label: "Estimates", href: "/estimates", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
  { label: "Schedule", href: "/schedule", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { label: "Invoices", href: "/invoices", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
  { label: "More", href: "/templates", icon: "M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" },
];

export function BottomNav() {
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY < 10) { setVisible(true); }
      else if (currentY > lastScrollY.current + 20) { setVisible(false); }
      else if (currentY < lastScrollY.current - 10) { setVisible(true); }
      lastScrollY.current = currentY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const currentPath = typeof window !== "undefined" ? window.location.pathname : "/";

  return (
    <nav className={`fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white transition-transform duration-300 dark:border-gray-800 dark:bg-gray-950 sm:hidden ${visible ? "translate-y-0" : "translate-y-full"}`} style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="flex h-14 items-center justify-around">
        {tabs.map((tab) => {
          const active = tab.href === "/dashboard" ? currentPath === "/dashboard" || currentPath === "/" : currentPath.startsWith(tab.href);
          return (
            <a key={tab.label} href={tab.href} className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-xs font-medium transition-colors min-h-[44px] min-w-[44px] ${active ? "text-indigo-600 dark:text-indigo-400" : "text-gray-500 dark:text-gray-400"}`}>
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} /></svg>
              <span>{tab.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
