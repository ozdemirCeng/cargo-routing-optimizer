"use client";

interface VehicleCardProps {
  vehicle: {
    id: string;
    name: string;
    plateNumber: string;
    status: "active" | "warning" | "idle";
    route?: {
      from: string;
      to: string;
    };
    cost?: number;
    loadPercentage: number;
  };
  color: string;
  onHover?: (hovered: boolean) => void;
  onClick?: () => void;
  isSelected?: boolean;
}

const statusConfig = {
  active: {
    label: "ON ROUTE",
    textColor: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    borderColor: "border-emerald-400/20",
    barColor: "bg-primary",
    accentColor: "border-primary",
  },
  warning: {
    label: "WARNING",
    textColor: "text-orange-400",
    bgColor: "bg-orange-400/10",
    borderColor: "border-orange-400/20",
    barColor: "bg-orange-500",
    accentColor: "border-orange-500",
  },
  idle: {
    label: "IDLE",
    textColor: "text-slate-400",
    bgColor: "bg-slate-700/50",
    borderColor: "border-slate-600",
    barColor: "bg-slate-600",
    accentColor: "border-slate-600",
  },
};

export default function VehicleCard({
  vehicle,
  color,
  onHover,
  onClick,
  isSelected,
}: VehicleCardProps) {
  const config = statusConfig[vehicle.status];
  const isIdle = vehicle.status === "idle";

  return (
    <div
      className={`
        min-w-[340px] h-full bg-[#1e293b]/60 rounded-xl p-4 flex flex-col gap-3 
        cursor-pointer relative overflow-hidden transition-all duration-200
        ${isIdle ? "border border-dashed border-slate-600 opacity-70 hover:opacity-100 hover:bg-white/5" : "border border-white/5"}
        ${isSelected ? "ring-2 ring-primary shadow-lg shadow-primary/20" : ""}
        hover:border-primary/50
      `}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      onClick={onClick}
    >
      {/* Left accent bar */}
      {!isIdle && (
        <div
          className="absolute top-0 left-0 w-1 h-full"
          style={{ backgroundColor: color }}
        />
      )}

      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center border border-white/10">
            <span
              className={`material-symbols-rounded ${isIdle ? "text-slate-500" : "text-white"}`}
            >
              {isIdle ? "add_circle" : "local_shipping"}
            </span>
          </div>
          <div>
            <p
              className={`font-bold leading-tight ${isIdle ? "text-slate-300" : "text-white"}`}
            >
              {vehicle.name}
            </p>
            <p className="text-slate-400 text-xs font-mono">
              {vehicle.plateNumber}
            </p>
          </div>
        </div>
        <span
          className={`text-xs font-bold px-2 py-1 rounded ${config.textColor} ${config.bgColor} ${!isIdle ? `border ${config.borderColor}` : ""}`}
        >
          {config.label}
        </span>
      </div>

      {/* Route Info or Idle State */}
      {isIdle ? (
        <div className="flex flex-col gap-1 mt-1 flex-1 justify-center items-center text-center">
          <p className="text-sm text-slate-400">Atama bekleniyor</p>
          <button className="mt-2 text-primary text-xs font-bold uppercase tracking-wider hover:underline">
            Rota Ata
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1 mt-1">
          {vehicle.route && (
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Rota</span>
              <span className="text-white">
                {vehicle.route.from}{" "}
                <span className="text-slate-500 mx-1">&gt;</span>{" "}
                {vehicle.route.to}
              </span>
            </div>
          )}
          {vehicle.cost !== undefined && vehicle.cost !== null && (
            <div className="flex justify-between text-xs text-slate-400">
              <span>Maliyet</span>
              <span className="text-white font-mono">
                ₺{Number(vehicle.cost).toFixed(0)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Load Capacity Bar */}
      <div className={`mt-auto ${isIdle ? "opacity-50" : ""}`}>
        <div className="flex justify-between text-xs mb-1.5">
          <span className={isIdle ? "text-slate-500" : "text-slate-400"}>
            Kapasite
          </span>
          <span
            className={`font-bold ${
              vehicle.loadPercentage > 80
                ? "text-white"
                : vehicle.loadPercentage < 50
                  ? config.textColor
                  : "text-white"
            }`}
          >
            {vehicle.loadPercentage}%
          </span>
        </div>
        <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${config.barColor}`}
            style={{ width: `${vehicle.loadPercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// Add New Vehicle Card Component
export function AddVehicleCard({ onClick }: { onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className="min-w-[340px] h-full bg-[#1e293b]/40 border border-dashed border-slate-600 rounded-xl p-4 flex flex-col items-center justify-center gap-3 cursor-pointer opacity-60 hover:opacity-100 hover:bg-white/5 hover:border-primary/50 transition-all group"
    >
      <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center border border-white/10 group-hover:border-primary/30 transition-colors">
        <span className="material-symbols-rounded text-slate-500 group-hover:text-primary text-3xl transition-colors">
          add
        </span>
      </div>
      <div className="text-center">
        <p className="text-slate-400 group-hover:text-slate-300 font-medium">
          Araç Ekle
        </p>
        <p className="text-xs text-slate-500">Yeni rota oluştur</p>
      </div>
    </div>
  );
}
