import Link from "next/link";
// Streaming notice moved to Hero

type DbTrip = {
  id: number;
  name: string;
  destination: string;
  budget: number | null;
};

type ProposedTripsProps = {
  trips?: DbTrip[];
  className?: string;
  onTripClick?: (trip: DbTrip) => void;
  selectedId?: number;
};

export default function ProposedTrips({ trips, className, onTripClick, selectedId }: ProposedTripsProps) {
  const displayedTrips = (trips ?? []).slice(0, 3);

  return (
    <div className={`w-full ${className ?? ""}`}>
      <div className="relative rounded-[26px] p-[2px] bg-transparent shadow-[0_25px_80px_-30px_rgba(0,0,0,0.2)]">
        <div className="relative rounded-[24px] border-4 border-white/95 backdrop-blur-2xl text-white overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/10 to-white/0 pointer-events-none" />
          <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
            

            {displayedTrips.length === 0 ? (
              <div className="rounded-2xl border border-white/30 bg-white/5 backdrop-blur-xl px-4 py-3 text-sm text-white/80">
                No proposed trips yet. New trips from emails will appear here.
              </div>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                {displayedTrips.map((t) => {
                  const isActive = typeof selectedId === "number" && selectedId === t.id;
                  const itemClass =
                    "rounded-2xl border bg-white/5 backdrop-blur-xl p-0 overflow-hidden " +
                    (isActive ? "border-white/70 ring-2 ring-white/60" : "border-white/30");
                  return (
                  <li key={t.id} className={itemClass}>
                    {onTripClick ? (
                      <button
                        type="button"
                        onClick={() => onTripClick?.(t)}
                        className={"block w-full text-left px-4 py-3 focus:outline-none " + (isActive ? "" : "focus-visible:ring-2 focus-visible:ring-white/60")}
                      >
                        <div className="text-[11px] tracking-[0.14em] text-white/70 uppercase">{t.name}</div>
                        <div className="mt-1 text-sm font-semibold tracking-wide uppercase">{t.destination.toUpperCase()}</div>
                        <div className="mt-1 text-xs tracking-wider text-white/80 uppercase">
                          {typeof t.budget === "number" ? `Budget: $${t.budget}` : "Flexible budget"}
                        </div>
                      </button>
                    ) : (
                      <Link href={`/trips/${t.id}`} className="block px-4 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
                        <div className="text-[11px] tracking-[0.14em] text-white/70 uppercase">{t.name}</div>
                        <div className="mt-1 text-sm font-semibold tracking-wide uppercase">{t.destination.toUpperCase()}</div>
                        <div className="mt-1 text-xs tracking-wider text-white/80 uppercase">
                          {typeof t.budget === "number" ? `Budget: $${t.budget}` : "Flexible budget"}
                        </div>
                      </Link>
                    )}
                  </li>
                );})}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


