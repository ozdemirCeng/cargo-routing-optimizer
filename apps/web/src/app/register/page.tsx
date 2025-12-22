"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
  });
  const [error, setError] = useState("");

  type RegisterPayload = {
    email: string;
    password: string;
    fullName: string;
  };

  const registerMutation = useMutation({
    mutationFn: (data: RegisterPayload) =>
      authApi.register(data.email, data.password, data.fullName),
    onSuccess: () => {
      router.push("/login?registered=true");
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || "Kayıt sırasında hata oluştu");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Şifreler eşleşmiyor");
      return;
    }

    if (formData.password.length < 6) {
      setError("Şifre en az 6 karakter olmalıdır");
      return;
    }

    registerMutation.mutate({
      email: formData.email,
      password: formData.password,
      fullName: formData.fullName,
    });
  };

  const loading = registerMutation.isPending;

  return (
    <div className="font-display min-h-screen flex items-center justify-center p-4 bg-gradient-tranquil">
      <div className="relative w-full max-w-md">
        {/* Glassmorphism Card */}
        <div className="bg-white/10 rounded-4xl shadow-xl overflow-hidden border border-white/20 backdrop-blur-lg">
          {/* Header */}
          <div className="px-8 pt-10 pb-6 text-center">
            {/* Icon */}
            <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/20 mb-6 overflow-hidden">
              <span className="material-symbols-rounded text-[48px] text-white/90">
                person_add
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
              Kayıt Ol
            </h1>
            <p className="text-white/80 text-sm">
              Kargo İşletme Sistemine Katıl
            </p>
          </div>

          {/* Form */}
          <div className="px-8 pb-8">
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              {/* Error Alert */}
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-xl px-4 py-3 text-red-200 text-sm flex items-center gap-2">
                  <span className="material-symbols-rounded text-[20px]">
                    error
                  </span>
                  {error}
                </div>
              )}

              {/* Full Name Field */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-white/80 text-xs font-semibold tracking-wider uppercase"
                  htmlFor="fullName"
                >
                  Ad Soyad
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/60 group-focus-within:text-primary transition-colors">
                    <span className="material-symbols-rounded text-[20px]">
                      person
                    </span>
                  </div>
                  <input
                    className="block w-full pl-10 pr-3 py-3 rounded-full border border-white/30 bg-black/10 text-white placeholder:text-white/50 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all text-sm"
                    id="fullName"
                    type="text"
                    placeholder="Adınız Soyadınız"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Email Field */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-white/80 text-xs font-semibold tracking-wider uppercase"
                  htmlFor="email"
                >
                  E-Posta Adresi
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/60 group-focus-within:text-primary transition-colors">
                    <span className="material-symbols-rounded text-[20px]">
                      mail
                    </span>
                  </div>
                  <input
                    className="block w-full pl-10 pr-3 py-3 rounded-full border border-white/30 bg-black/10 text-white placeholder:text-white/50 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all text-sm"
                    id="email"
                    type="email"
                    placeholder="ornek@firma.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-white/80 text-xs font-semibold tracking-wider uppercase"
                  htmlFor="password"
                >
                  Şifre
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/60 group-focus-within:text-primary transition-colors">
                    <span className="material-symbols-rounded text-[20px]">
                      lock
                    </span>
                  </div>
                  <input
                    className="block w-full pl-10 pr-10 py-3 rounded-full border border-white/30 bg-black/10 text-white placeholder:text-white/50 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all text-sm"
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/60 hover:text-white/80 cursor-pointer transition-colors focus:outline-none"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="material-symbols-rounded text-[20px]">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
                <p className="text-white/50 text-xs ml-3">En az 6 karakter</p>
              </div>

              {/* Confirm Password Field */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-white/80 text-xs font-semibold tracking-wider uppercase"
                  htmlFor="confirmPassword"
                >
                  Şifre Tekrar
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/60 group-focus-within:text-primary transition-colors">
                    <span className="material-symbols-rounded text-[20px]">
                      lock
                    </span>
                  </div>
                  <input
                    className="block w-full pl-10 pr-10 py-3 rounded-full border border-white/30 bg-black/10 text-white placeholder:text-white/50 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all text-sm"
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        confirmPassword: e.target.value,
                      })
                    }
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/60 hover:text-white/80 cursor-pointer transition-colors focus:outline-none"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <span className="material-symbols-rounded text-[20px]">
                      {showConfirmPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 flex items-center justify-center h-12 rounded-full bg-primary hover:bg-blue-700 text-white font-semibold text-sm transition-all shadow-md shadow-primary/30 hover:shadow-lg hover:shadow-primary/40 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Kayıt yapılıyor...</span>
                  </div>
                ) : (
                  <>
                    <span className="material-symbols-rounded text-[20px] mr-2">
                      how_to_reg
                    </span>
                    Kayıt Ol
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-black/10 border-t border-white/20 text-center">
            <p className="text-sm text-white/80">
              Zaten hesabın var mı?
              <Link
                href="/login"
                className="text-white font-semibold ml-1 transition-colors underline decoration-transparent hover:decoration-current hover:text-white"
              >
                Giriş Yap
              </Link>
            </p>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
      </div>
    </div>
  );
}
