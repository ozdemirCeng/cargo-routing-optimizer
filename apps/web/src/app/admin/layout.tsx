"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";

const adminMenuItems = [
  { text: "Dashboard", icon: "dashboard", path: "/admin" },
  { text: "Geospatial Hub", icon: "map", path: "/admin/stations" },
  { text: "Araçlar", icon: "directions_car", path: "/admin/vehicles" },
  { text: "Kargo Siparişleri", icon: "inventory_2", path: "/admin/cargos" },
  { text: "Rota Planlama", icon: "alt_route", path: "/admin/plans" },
  { text: "Seferler", icon: "local_shipping", path: "/admin/trips" },
  { text: "Parametreler", icon: "tune", path: "/admin/parameters" },
];

export default function AdminLayout({
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

    if (user && user.role !== "admin") {
      router.push("/user");
    } else if (!user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Show loading while checking auth
  if (isLoading || !user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isActive = (path: string) => {
    if (path === "/admin") return pathname === "/admin";
    return pathname.startsWith(path);
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-800 dark:text-slate-100 h-screen w-full overflow-hidden relative">
      {/* Background Map Image */}
      <div className="absolute inset-0 z-0">
        <img
          alt="Map Background"
          className="w-full h-full object-cover filter brightness-110 dark:brightness-[0.6] grayscale-[20%]"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCJyUdu69Dg4bk25yMvfCZW5p6t7oO4xH_lrZkwzUM2LMNJM2P72eR-q5tjwJT_SbgukVZmXdgDrUZi7PJHX7VHlnp1wXx73OC5zcNFkinKppuJ5R2nTQiqJsNACk1QsPRWu5KD7wYgWujbAMXpYZITT0KWewlfFdq_Ftzj_eQ4jCYTJ4UDVGTxRJuuj0qbNcNdBIXpf3vY9nGhWK_pfISGLV4sX_SOtzPmXGCc0vH6gOW-sE7gtZLQxhZ0R5no1-w_vVPNJUeWMOk"
        />
        <div className="absolute inset-0 bg-slate-200/20 dark:bg-slate-900/30 pointer-events-none"></div>
      </div>

      <div className="relative z-10 flex h-full p-4 gap-4">
        {/* Sidebar */}
        <aside className="w-72 flex-shrink-0 flex flex-col justify-between rounded-2xl glass shadow-2xl transition-all duration-300">
          <div>
            {/* Logo */}
            <div className="h-20 flex items-center px-6 border-b border-slate-200/30 dark:border-slate-700/50">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <span className="material-symbols-rounded text-white text-xl">
                  local_shipping
                </span>
              </div>
              <span className="ml-3 font-bold text-lg tracking-wide text-slate-800 dark:text-white">
                Kargo Sistemi
              </span>
            </div>

            {/* Navigation */}
            <nav className="flex flex-col gap-2 p-4 mt-2">
              {adminMenuItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 group ${
                    isActive(item.path)
                      ? "bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg shadow-blue-900/20 relative overflow-hidden"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  {isActive(item.path) && (
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  )}
                  <span
                    className={`material-symbols-rounded text-xl ${!isActive(item.path) && "group-hover:text-primary transition-colors"}`}
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
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col flex-1">
                <span className="text-sm font-semibold text-slate-800 dark:text-white">
                  {user.fullName}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Admin
                </span>
              </div>
              <span className="material-symbols-rounded text-slate-400">
                expand_more
              </span>
            </div>

            {/* User Menu Dropdown */}
            {showUserMenu && (
              <div className="absolute bottom-full left-4 right-4 mb-2 glass rounded-xl shadow-xl border border-slate-200/30 dark:border-slate-700/50 overflow-hidden z-50">
                <div className="p-3 border-b border-slate-200/30 dark:border-slate-700/50">
                  <p className="text-sm font-medium text-slate-800 dark:text-white">
                    {user.fullName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {user.email}
                  </p>
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
          <header className="h-16 flex-shrink-0 rounded-2xl glass flex items-center justify-between px-6 shadow-lg">
            <div className="flex items-center text-slate-500 dark:text-slate-400 text-sm">
              <Link
                href="/admin"
                className="hover:text-primary transition-colors"
              >
                <span className="material-symbols-rounded text-lg">home</span>
              </Link>
              <span className="mx-2 opacity-50">/</span>
              <span className="text-slate-800 dark:text-slate-200 font-medium">
                {adminMenuItems.find((item) => isActive(item.path))?.text ||
                  "Dashboard"}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-200/50 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300 transition-colors relative">
                <span className="material-symbols-rounded text-xl">
                  notifications
                </span>
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
              </button>
              <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-200/50 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300 transition-colors">
                <span className="material-symbols-rounded text-xl">
                  settings
                </span>
              </button>
            </div>
          </header>

          {/* Page Content */}
          <div className="flex-1 overflow-auto rounded-2xl glass">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
