"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useDashboard } from "@/components/DashboardContext";
import { Button } from "@/components/ui/Button";

export function Sidebar() {
  const pathname = usePathname();
  const { openCompose, refreshSignal } = useDashboard();
  const [counts, setCounts] = useState({ scheduled: 0, sent: 0 });

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getScheduled(), api.getSent()])
      .then(([scheduled, sent]) => {
        if (!cancelled) setCounts({ scheduled: scheduled.total, sent: sent.total });
      })
      .catch(() => {
        // sidebar counts are non-critical; leave last-known values on error
      });
    return () => {
      cancelled = true;
    };
  }, [refreshSignal]);

  const navItems = [
    { href: "/dashboard/scheduled", label: "Scheduled", count: counts.scheduled },
    { href: "/dashboard/sent", label: "Sent", count: counts.sent },
  ];

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-100 bg-white px-4 py-5">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">
          O
        </div>
        <span className="text-sm font-semibold text-gray-800">Outbox Labs</span>
      </div>

      <Button onClick={openCompose} className="mb-6 w-full">
        Compose
      </Button>

      <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Core</p>
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
                active ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span>{item.label}</span>
              <span className={`text-xs ${active ? "text-brand-600" : "text-gray-400"}`}>{item.count}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
