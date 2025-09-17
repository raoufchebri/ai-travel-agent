"use client";

import { useMemo, useState } from "react";

type Trip = {
  destination: string;
  startDate: string; // ISO yyyy-mm-dd
  endDate: string; // ISO yyyy-mm-dd
  guests?: number;
};

type TravelWidgetProps = {
  onSearch?: (data: {
    destination: string;
    startDate: string;
    endDate: string;
    guests: number;
  }) => void;
  readOnly?: boolean;
  trip?: Trip;
  weatherLabel?: string; // Deprecated in favor of explicit weather props
  weatherTempF?: number;
  weatherSummary?: string;
  humidityPct?: number;
  windMph?: number;
  className?: string;
  transparent?: boolean;
};

export default function TravelWidget({ onSearch, readOnly, trip, weatherLabel, weatherTempF, weatherSummary, humidityPct, windMph, className, transparent }: TravelWidgetProps) {
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [guests, setGuests] = useState(1);
  const [animDelay] = useState(() => `${Math.floor(Math.random() * 10000)}ms`);
  const [directionClass] = useState(() => (Math.random() < 0.5 ? "animate-slide-pan-seq-right" : "animate-slide-pan-seq-left"));

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSearch?.({ destination, startDate, endDate, guests });
  }


  const formattedRangeCompact = useMemo(() => {
    if (!trip) return "";
    const s = new Date(trip.startDate);
    const e = new Date(trip.endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return "";
    const sMon = s.toLocaleString(undefined, { month: "short" }).toUpperCase();
    const eMon = e.toLocaleString(undefined, { month: "short" }).toUpperCase();
    const sd = s.getDate();
    const ed = e.getDate();
    return `${sMon} ${sd} - ${eMon} ${ed}`;
  }, [trip]);

  const daysUntilStart = useMemo(() => {
    if (!trip) return null;
    const start = new Date(trip.startDate);
    if (isNaN(start.getTime())) return null;
    const today = new Date();
    // normalize both to midnight local
    start.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const msPerDay = 24 * 60 * 60 * 1000;
    const diffDays = Math.round((start.getTime() - today.getTime()) / msPerDay);
    return diffDays;
  }, [trip]);

  const daysLeftLabel = useMemo(() => {
    if (typeof daysUntilStart !== "number") return "";
    if (daysUntilStart > 0) return `${daysUntilStart} DAYS LEFT`;
    if (daysUntilStart === 0) return "STARTS TODAY";
    return `STARTED ${Math.abs(daysUntilStart)} DAYS AGO`;
  }, [daysUntilStart]);

  if (readOnly && trip) {
    return (
      <div className={`w-full max-w-3xl ${className ?? ""}`}>
        <div className="relative h-full">
          <div className="relative h-full rounded-[26px] p-[2px] bg-transparent shadow-[0_25px_80px_-30px_rgba(0,0,0,0.2)]">
            <div className="relative h-full rounded-[24px] border-4 border-white/95 backdrop-blur-2xl text-white overflow-hidden">
              <div className="absolute inset-0 overflow-hidden">
                <div className={`w-[200%] h-full flex ${directionClass}`} style={{ animationDelay: animDelay }}>
                  <div className="w-1/2 h-full bg-[url('https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1800&q=80')] bg-cover bg-center" />
                  <div className="w-1/2 h-full" style={{ backgroundColor: "#DBE1ED" }} />
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/15 to-white/0" style={transparent ? { opacity: 0.1 } : undefined} />
              <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7 h-full">
                <div className="flex items-center justify-end mb-4">
                  <div className="text-lg" aria-hidden>🌴</div>
                </div>

                <div className="text-3xl sm:text-4xl font-extrabold tracking-wide text-white uppercase">{(trip.destination || "").toUpperCase()}</div>
                <div className="mt-2 text-sm sm:text-base tracking-wider text-white/80 uppercase">{formattedRangeCompact}</div>
                {daysLeftLabel && (
                  <div className="mt-2">
                    <span className="inline-block rounded-lg border border-white/30 bg-white/10 px-2 py-1 text-[11px] tracking-wider text-white/90 uppercase">
                      {daysLeftLabel}
                    </span>
                  </div>
                )}

                <div className="my-5 h-px bg-white/40" />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div className="flex items-center gap-3">
                    <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
                      <path d="M3 15c1.2-2.2 3.3-3 5-3 3.5 0 4.2 3 7 3 1.3 0 2.3-.5 3-.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <div className="flex flex-col">
                      <div className="text-3xl sm:text-4xl font-extrabold leading-none text-white">{Math.round(weatherTempF ?? (weatherLabel ? 80 : 78))}°F</div>
                      <div className="text-xs sm:text-sm text-white/80">{weatherSummary ?? (weatherLabel ? weatherLabel.replace(/.*·\s*/, "") : "Partly Sunny")}</div>
                    </div>
                  </div>
                  <div className="flex sm:justify-end gap-8 text-sm text-white/80">
                    <div className="flex flex-col gap-1">
                      <div>Humidity: {typeof humidityPct === "number" ? `${humidityPct}%` : "65%"}</div>
                      <div>Wind: {typeof windMph === "number" ? `${windMph} mph` : "10 mph"}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-8 -bottom-6 h-10 rounded-[18px] bg-gradient-to-b from-black/20 to-transparent blur-md opacity-25" />
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-3xl ${className ?? ""}`}>
      <div className="relative h-full rounded-2xl p-[1px] bg-gradient-to-br from-[#22d3ee] via-[#a78bfa] to-[#f472b6] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.25)] opacity-80">
        <div className="rounded-2xl bg-white/85 dark:bg-black/40 backdrop-blur-lg">
          <div className="p-5 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight mb-4 text-foreground">Plan your next escape</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:gap-4 items-end">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-black/70 dark:text-white/70">Destination</span>
                <input
                  type="text"
                  placeholder="Where to?"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="h-11 rounded-xl px-3.5 bg-white/80 dark:bg-white/5 border border-black/10 dark:border-white/10 outline-none focus:ring-2 focus:ring-violet-400/60 focus:border-transparent text-sm"
                  required
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-black/70 dark:text-white/70">Check-in</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-11 rounded-xl px-3.5 bg-white/80 dark:bg-white/5 border border-black/10 dark:border-white/10 outline-none focus:ring-2 focus:ring-violet-400/60 focus:border-transparent text-sm"
                  required
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-black/70 dark:text-white/70">Check-out</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-11 rounded-xl px-3.5 bg-white/80 dark:bg-white/5 border border-black/10 dark:border-white/10 outline-none focus:ring-2 focus:ring-violet-400/60 focus:border-transparent text-sm"
                  required
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-black/70 dark:text-white/70">Guests</span>
                <input
                  type="number"
                  min={1}
                  value={guests}
                  onChange={(e) => setGuests(Number(e.target.value))}
                  className="h-11 rounded-xl px-3.5 bg-white/80 dark:bg-white/5 border border-black/10 dark:border-white/10 outline-none focus:ring-2 focus:ring-violet-400/60 focus:border-transparent text-sm"
                />
              </label>

              <button
                type="submit"
                className="h-11 mt-1 rounded-xl bg-gradient-to-r from-violet-500 to-sky-400 text-white font-medium text-sm shadow-[0_10px_30px_-10px_rgba(56,189,248,0.7)] hover:opacity-90 transition"
              >
                Search trips
              </button>
            </form>
            <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] text-black/60 dark:text-white/60">
              <span className="inline-flex items-center gap-1">✈️ Flexible deals</span>
              <span className="inline-flex items-center gap-1">🏨 Handpicked stays</span>
              <span className="inline-flex items-center gap-1">🛡️ Free cancellation</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


