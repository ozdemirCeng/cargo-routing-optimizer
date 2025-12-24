"use client";

import { useState } from "react";

interface SettingsState {
  // Optimizasyon Motoru
  routeStrategy: string;
  osrmEndpoint: string;
  trafficEnabled: boolean;
  mlEnabled: boolean;
  // Harita Ayarları
  defaultRegion: string;
  refreshInterval: number;
  darkMapLayer: boolean;
  // Bildirim Kuralları
  delayAlertEnabled: boolean;
  delayThreshold: number;
  breakdownAlertEnabled: boolean;
  deliveryAlertEnabled: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>({
    routeStrategy: "fastest",
    osrmEndpoint: "http://localhost:5000/route/v1",
    trafficEnabled: true,
    mlEnabled: false,
    defaultRegion: "kocaeli",
    refreshInterval: 15,
    darkMapLayer: true,
    delayAlertEnabled: true,
    delayThreshold: 15,
    breakdownAlertEnabled: true,
    deliveryAlertEnabled: false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate save
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const Toggle = ({
    checked,
    onChange,
    id,
  }: {
    checked: boolean;
    onChange: (value: boolean) => void;
    id: string;
  }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
        checked ? "bg-blue-600" : "bg-slate-700"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );

  return (
    <div className="h-full flex flex-col relative p-4 overflow-auto">
      {/* Decorative blurs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full mix-blend-screen filter blur-3xl opacity-30"></div>
        <div className="absolute top-60 -left-20 w-80 h-80 bg-emerald-600/10 rounded-full mix-blend-screen filter blur-3xl opacity-20"></div>
        <div className="absolute bottom-20 right-20 w-72 h-72 bg-amber-600/10 rounded-full mix-blend-screen filter blur-3xl opacity-20"></div>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 relative z-10">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">
            Ayarlar ve Sistem Konfigürasyonu
          </h1>
          <p className="text-slate-400 text-sm">
            Kargo optimizasyon sistemi ve araç takip parametrelerini
            yapılandırın.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-[0_0_20px_-5px_rgba(59,130,246,0.5)] hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.7)] transition-all duration-300 transform hover:scale-105 active:scale-95 border border-blue-400/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none group"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Kaydediliyor...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-rounded text-[18px] group-hover:rotate-12 transition-transform">
                save
              </span>
              <span>Değişiklikleri Kaydet</span>
            </>
          )}
        </button>
      </div>

      {/* Success Alert */}
      {saveSuccess && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 relative z-10 animate-pulse">
          <span className="material-symbols-rounded text-[18px]">
            check_circle
          </span>
          <span className="text-sm font-medium">
            Ayarlar başarıyla kaydedildi
          </span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative z-10 pb-4">
        {/* Optimizasyon Motoru - Full Width */}
        <div className="glass-panel rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center gap-3 mb-5 border-b border-white/10 pb-4">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <span className="material-symbols-rounded text-[22px]">
                memory
              </span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Optimizasyon Motoru
              </h3>
              <p className="text-xs text-slate-400">
                Rota hesaplama ve yük dağıtım algoritmaları
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Rota Stratejisi
                </label>
                <div className="relative">
                  <select
                    value={settings.routeStrategy}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        routeStrategy: e.target.value,
                      })
                    }
                    className="w-full glass-input rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer appearance-none pr-10"
                  >
                    <option value="shortest" className="bg-slate-800">
                      En Kısa Mesafe (Shortest Path)
                    </option>
                    <option value="fastest" className="bg-slate-800">
                      En Hızlı Rota (Fastest Route)
                    </option>
                    <option value="balanced" className="bg-slate-800">
                      Dengeli Yük Dağılımı (Balanced Load)
                    </option>
                    <option value="eco" className="bg-slate-800">
                      Yakıt Tasarrufu (Eco Mode)
                    </option>
                  </select>
                  <span className="material-symbols-rounded absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    expand_more
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  Algoritmanın rota oluştururken önceliklendireceği kriter.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  OSRM Sunucu Uç Noktası
                </label>
                <div className="relative">
                  <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    dns
                  </span>
                  <input
                    type="text"
                    value={settings.osrmEndpoint}
                    onChange={(e) =>
                      setSettings({ ...settings, osrmEndpoint: e.target.value })
                    }
                    className="w-full glass-input rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 glass-input rounded-xl border border-white/5 hover:border-emerald-500/30 transition-colors">
                <div>
                  <h4 className="text-sm font-medium text-white">
                    Trafik Verisini Dahil Et
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Anlık trafik yoğunluğuna göre dinamik rota güncellemesi.
                  </p>
                </div>
                <Toggle
                  id="traffic"
                  checked={settings.trafficEnabled}
                  onChange={(value) =>
                    setSettings({ ...settings, trafficEnabled: value })
                  }
                />
              </div>

              <div className="flex items-center justify-between p-4 glass-input rounded-xl border border-white/5 hover:border-purple-500/30 transition-colors">
                <div>
                  <h4 className="text-sm font-medium text-white">
                    Öğrenen Algoritma (ML)
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Geçmiş teslimat verilerini kullanarak tahmini süreleri
                    iyileştir.
                  </p>
                </div>
                <Toggle
                  id="ml"
                  checked={settings.mlEnabled}
                  onChange={(value) =>
                    setSettings({ ...settings, mlEnabled: value })
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* Harita Ayarları */}
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-5 border-b border-white/10 pb-4">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
              <span className="material-symbols-rounded text-[22px]">map</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Harita Ayarları
              </h3>
              <p className="text-xs text-slate-400">
                Görünüm ve bölge yapılandırması
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Varsayılan Bölge (Merkez)
              </label>
              <div className="relative">
                <select
                  value={settings.defaultRegion}
                  onChange={(e) =>
                    setSettings({ ...settings, defaultRegion: e.target.value })
                  }
                  className="w-full glass-input rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer appearance-none pr-10"
                >
                  <option value="kocaeli" className="bg-slate-800">
                    Kocaeli (Merkez Kampüs)
                  </option>
                  <option value="izmit" className="bg-slate-800">
                    İzmit İlçe Merkezi
                  </option>
                  <option value="gebze" className="bg-slate-800">
                    Gebze Teknopark
                  </option>
                  <option value="all" className="bg-slate-800">
                    Tüm Marmara Bölgesi
                  </option>
                </select>
                <span className="material-symbols-rounded absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  expand_more
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Otomatik Yenileme Aralığı
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="5"
                  max="60"
                  value={settings.refreshInterval}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      refreshInterval: parseInt(e.target.value),
                    })
                  }
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="glass-input px-3 py-1.5 rounded-lg text-sm font-mono w-16 text-center">
                  {settings.refreshInterval} sn
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <span className="text-sm font-medium text-slate-300">
                  Gece Modu Harita Katmanı
                </span>
                <p className="text-xs text-slate-500 mt-1">
                  Harita altlığını koyu tema olarak yükle.
                </p>
              </div>
              <Toggle
                id="darkmap"
                checked={settings.darkMapLayer}
                onChange={(value) =>
                  setSettings({ ...settings, darkMapLayer: value })
                }
              />
            </div>
          </div>
        </div>

        {/* Bildirim Kuralları */}
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-5 border-b border-white/10 pb-4">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <span className="material-symbols-rounded text-[22px]">
                notifications_active
              </span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Bildirim Kuralları
              </h3>
              <p className="text-xs text-slate-400">
                Alarm ve uyarı tetikleyicileri
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Gecikme Uyarıları */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-amber-500/30 transition-colors group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-rounded text-amber-500 text-[18px]">
                    warning
                  </span>
                  <h4 className="text-sm font-medium text-white">
                    Gecikme Uyarıları
                  </h4>
                </div>
                <Toggle
                  id="delay"
                  checked={settings.delayAlertEnabled}
                  onChange={(value) =>
                    setSettings({ ...settings, delayAlertEnabled: value })
                  }
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Tetikleyici:</span>
                <input
                  type="number"
                  value={settings.delayThreshold}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      delayThreshold: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-14 glass-input text-center rounded-lg border-none py-1 px-2 text-xs focus:ring-1 focus:ring-blue-500"
                />
                <span>dakika üzeri sapma</span>
              </div>
            </div>

            {/* Araç Arıza */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-red-500/30 transition-colors group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-rounded text-red-500 text-[18px]">
                    car_crash
                  </span>
                  <h4 className="text-sm font-medium text-white">
                    Araç Arıza Bildirimleri
                  </h4>
                </div>
                <Toggle
                  id="breakdown"
                  checked={settings.breakdownAlertEnabled}
                  onChange={(value) =>
                    setSettings({ ...settings, breakdownAlertEnabled: value })
                  }
                />
              </div>
              <p className="text-xs text-slate-400">
                OBD cihazından hata kodu geldiğinde anında yöneticiye bildir.
              </p>
            </div>

            {/* Teslimat Onayı */}
            <div
              className={`p-4 rounded-xl bg-white/5 border border-white/5 hover:border-blue-500/30 transition-colors group ${
                !settings.deliveryAlertEnabled ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-rounded text-blue-400 text-[18px]">
                    check_circle
                  </span>
                  <h4 className="text-sm font-medium text-white">
                    Teslimat Onayı
                  </h4>
                </div>
                <Toggle
                  id="delivery"
                  checked={settings.deliveryAlertEnabled}
                  onChange={(value) =>
                    setSettings({ ...settings, deliveryAlertEnabled: value })
                  }
                />
              </div>
              <p className="text-xs text-slate-400">
                Her başarılı teslimatta e-posta özeti gönder.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-slate-500 text-xs py-4 relative z-10">
        © 2024 Kocaeli Üniversitesi Lojistik Yönetim Birimi v2.4.1
      </div>
    </div>
  );
}
