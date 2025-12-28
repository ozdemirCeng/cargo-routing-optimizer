"use client";

interface VehicleCardProps {
  vehicle: {
    id: string;
    name: string;
    plateNumber: string;
    cargoCount: number;
    totalWeightKg: number;
    capacityKg: number;
    totalDistanceKm: number;
    totalDurationMinutes?: number;
    totalCost: number;
  };
  color: string;
  onHover?: (hovered: boolean) => void;
  onClick?: () => void;
  isSelected?: boolean;
  compact?: boolean;
}

export default function VehicleCard({
  vehicle,
  color,
  onHover,
  onClick,
  isSelected,
  compact = false,
}: VehicleCardProps) {
  const capacity = Number(vehicle.capacityKg) || 0;
  const weight = Number(vehicle.totalWeightKg) || 0;
  const loadPercentage = capacity ? Math.round((weight / capacity) * 100) : 0;
  const km = Number(vehicle.totalDistanceKm) || 0;
  const cost = Number(vehicle.totalCost) || 0;
  const durationMin =
    vehicle.totalDurationMinutes === undefined ||
    vehicle.totalDurationMinutes === null
      ? null
      : Number(vehicle.totalDurationMinutes) || 0;

  return (
    <div
      className={`
        ${compact ? "min-w-[320px]" : "min-w-[360px]"} h-full bg-[#0f172a]/55 rounded-2xl p-4 flex flex-col gap-3
        cursor-pointer relative overflow-hidden transition-all duration-200
        border border-white/10
        ${isSelected ? "ring-2 ring-primary shadow-lg shadow-primary/20" : ""}
        hover:border-primary/50
      `}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      onClick={onClick}
    >
      {/* Left accent bar */}
      <div
        className="absolute top-0 left-0 w-1 h-full"
        style={{ backgroundColor: color }}
      />

      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
            <span className="material-symbols-rounded text-white">
              local_shipping
            </span>
          </div>
          <div>
            <p className="font-bold leading-tight text-white">{vehicle.name}</p>
            <p className="text-slate-300 text-xs font-mono">
              {vehicle.plateNumber}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-300">Maliyet</div>
          <div className="text-white font-extrabold tabular-nums">
            ₺{cost.toFixed(0)}
          </div>
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-3 gap-3 mt-1">
        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
          <div className="text-[11px] text-slate-300">Kargo</div>
          <div className="text-white font-bold tabular-nums">
            {vehicle.cargoCount}
            <span className="text-slate-300 font-semibold ml-1">adet</span>
          </div>
        </div>
        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
          <div className="text-[11px] text-slate-300">Yük</div>
          <div className="text-white font-bold tabular-nums">
            {weight.toFixed(0)}
            <span className="text-slate-300 font-semibold ml-1">kg</span>
          </div>
        </div>
        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
          <div className="text-[11px] text-slate-300">Mesafe</div>
          <div className="text-white font-bold tabular-nums">
            {km.toFixed(1)}
            <span className="text-slate-300 font-semibold ml-1">km</span>
          </div>
        </div>
      </div>

      {/* Extra stats - only shown in expanded mode */}
      {!compact && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <div className="text-[11px] text-slate-300">Kapasite</div>
              <div className="text-white font-bold tabular-nums">
                {capacity.toFixed(0)}
                <span className="text-slate-300 font-semibold ml-1">kg</span>
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <div className="text-[11px] text-slate-300">Süre</div>
              <div className="text-white font-bold tabular-nums">
                {durationMin === null ? "-" : durationMin.toFixed(0)}
                <span className="text-slate-300 font-semibold ml-1">dk</span>
              </div>
            </div>
          </div>

          {/* Load Capacity Bar */}
          <div className="mt-auto">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-300">Doluluk</span>
              <span
                className={`font-bold ${
                  loadPercentage >= 90
                    ? "text-rose-300"
                    : loadPercentage >= 75
                      ? "text-white"
                      : "text-emerald-300"
                }`}
              >
                {loadPercentage}%
              </span>
            </div>
            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.max(0, loadPercentage))}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
