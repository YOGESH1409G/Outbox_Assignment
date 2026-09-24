"use client";

import type { Session } from "next-auth";
import { DashboardProvider, useDashboard } from "@/components/DashboardContext";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { ComposeModal } from "@/components/ComposeModal";

function Shell({ user, children }: { user: Session["user"]; children: React.ReactNode }) {
  const { composeOpen, closeCompose } = useDashboard();

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={user} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      {composeOpen && <ComposeModal onClose={closeCompose} />}
    </div>
  );
}

export function DashboardShell({ user, children }: { user: Session["user"]; children: React.ReactNode }) {
  return (
    <DashboardProvider>
      <Shell user={user}>{children}</Shell>
    </DashboardProvider>
  );
}
