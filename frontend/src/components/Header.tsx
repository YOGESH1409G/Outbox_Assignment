"use client";

import { signOut } from "next-auth/react";
import type { Session } from "next-auth";

export function Header({ user }: { user: Session["user"] }) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-100 bg-white px-6">
      <div />
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-800">{user?.name}</p>
          <p className="text-xs text-gray-400">{user?.email}</p>
        </div>
        {user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt={user.name ?? "User avatar"} className="h-9 w-9 rounded-full" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            {user?.name?.charAt(0) ?? "U"}
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="ml-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
