"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";

const userMenuItems = [
  { text: "Kargolarım", icon: "inventory_2", path: "/user" },
  { text: "Yeni Kargo", icon: "add_box", path: "/user/new-cargo" },
  { text: "Kargo Takip", icon: "location_searching", path: "/user/track" },
];

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, logout, checkAuth } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    // Wait for loading to complete before checking auth
    if (isLoading) return;

    if (user && user.role === "admin") {
      router.push("/admin");
    } else if (!user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Show loading while checking auth
  if (isLoading || !user || user.role === "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isActive = (path: string) => {
    if (path === "/user") return pathname === "/user";
    return pathname.startsWith(path);
  };

  return (
    <div className="user-scope bg-background-light dark:bg-background-dark text-slate-100 h-screen w-full overflow-hidden relative">
      {/* Background Map Image */}
      <div className="absolute inset-0 z-0">
        <img
          alt="Kocaeli Üniversitesi Kampüs"
          className="w-full h-full object-cover filter brightness-110 dark:brightness-[0.6] grayscale-[20%]"
          src="/banner1.webp"
        />
        <div className="absolute inset-0 bg-slate-200/20 dark:bg-slate-900/30 pointer-events-none"></div>
      </div>

      <div className="relative z-10 flex h-full p-4 gap-4">
        {/* Sidebar */}
        <aside className="w-72 flex-shrink-0 flex flex-col justify-between rounded-2xl glass-dark shadow-2xl transition-all duration-300">
          <div>
            {/* Logo */}
            <div className="h-20 flex items-center px-6 border-b border-slate-200/30 dark:border-slate-700/50">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <span className="material-symbols-rounded text-white text-xl">
                  package_2
                </span>
              </div>
              <span className="ml-3 font-bold text-lg tracking-wide text-white">
                Kargo Paneli
              </span>
            </div>

            {/* Navigation */}
            <nav className="flex flex-col gap-2 p-4 mt-2">
              {userMenuItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 group ${
                    isActive(item.path)
                      ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/20 relative overflow-hidden"
                      : "text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  {isActive(item.path) && (
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  )}
                  <span
                    className={`material-symbols-rounded text-xl ${!isActive(item.path) && "group-hover:text-emerald-500 transition-colors"}`}
                  >
                    {item.icon}
                  </span>
                  <span className="ml-3 font-medium">{item.text}</span>
                </Link>
              ))}
            </nav>
          </div>

          {/* User Profile */}
          <div className="p-4 border-t border-slate-200/30 dark:border-slate-700/50 relative">
            <div
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col flex-1">
                <span className="text-sm font-semibold text-white">
                  {user.fullName}
                </span>
                <span className="text-xs text-slate-300">Kullanıcı</span>
              </div>
              <span className="material-symbols-rounded text-slate-300">
                expand_more
              </span>
            </div>

            {/* User Menu Dropdown */}
            {showUserMenu && (
              <div className="absolute bottom-full left-4 right-4 mb-2 glass-dark rounded-xl shadow-xl border border-slate-700/50 overflow-hidden z-50">
                <div className="p-3 border-b border-slate-200/30 dark:border-slate-700/50">
                  <p className="text-sm font-medium text-white">
                    {user.fullName}
                  </p>
                  <p className="text-xs text-slate-300">{user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  <span className="material-symbols-rounded text-xl">
                    logout
                  </span>
                  <span className="font-medium">Çıkış Yap</span>
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col gap-4 relative overflow-hidden">
          {/* Header */}
          <header className="h-16 flex-shrink-0 rounded-2xl glass-dark flex items-center justify-between px-6 shadow-lg">
            <div className="flex items-center text-slate-300 text-sm">
              <Link
                href="/user"
                className="hover:text-emerald-500 transition-colors"
              >
                <span className="material-symbols-rounded text-lg">home</span>
              </Link>
              <span className="mx-2 opacity-50">/</span>
              <span className="text-slate-100 font-medium">
                {userMenuItems.find((item) => isActive(item.path))?.text ||
                  "Kargolarım"}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/user/new-cargo"
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/20 transition-all font-medium text-sm"
              >
                <span className="material-symbols-rounded text-lg">add</span>
                Yeni Kargo
              </Link>
            </div>
          </header>

          {/* Page Content */}
          <div className="flex-1 overflow-hidden">{children}</div>
        </main>
      </div>
    </div>
  );
}
