"use client";

import { useEffect, useRef, useState } from "react";
import ProposedTrips from "./ProposedTrips";
import ProposedTripsNotice from "./ProposedTripsNotice";

type Trip = {
  id: number;
  name: string;
  destination: string;
  budget: number | null;
  isBooked?: boolean;
};

type ButtonSpec = {
  type: "button";
  label: string;
  href: string;
  classes: string;
  ariaLabel?: string;
};

type PromptSpec = {
  type: "prompt";
  field: "name" | "origin" | "startDate" | "endDate" | "budget" | "destination";
  label: string;
  inputType: "text" | "date" | "number";
  suggestions?: string[];
};

type FlightSpec = {
  type: "flight";
  id: string;
  carrier: string;
  carrierLogo: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departAt: string; // ISO string
  arriveAt: string; // ISO string
  durationMinutes: number;
  price: number;
  currency: string;
  originCity?: string;
  originCode?: string;
  originAirportName?: string;
  destinationCity?: string;
  destinationCode?: string;
  destinationAirportName?: string;
};

type ComponentSpec = ButtonSpec | PromptSpec | FlightSpec;

type Props = {
  trips: Trip[];
};

export default function ProposedTripsModal({ trips }: Props) {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant" | "system"; content: string }>>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [components, setComponents] = useState<ComponentSpec[]>([]);
  const [promptValues, setPromptValues] = useState<Record<string, string>>({});
  const streamAbortRef = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<"intro" | "trips">("intro");
  const [introReady, setIntroReady] = useState<boolean>(false);

  async function fetchAndStreamComponents(payload: any) {
    try {
      // Cancel previous stream
      if (streamAbortRef.current) {
        streamAbortRef.current.abort();
      }
      const controller = new AbortController();
      streamAbortRef.current = controller;

      const resp = await fetch("/api/component?stream=1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      // If server didn't stream, fall back to JSON
      const contentType = resp.headers.get("content-type") || "";
      if (!contentType.includes("text/event-stream")) {
        const data = await resp.json().catch(() => null);
        if (data && Array.isArray(data.components)) {
          setComponents(data.components as ComponentSpec[]);
        } else if (data && typeof data === "object" && typeof (data as any).type === "string") {
          setComponents([data as ComponentSpec]);
        }
        return;
      }

      // Stream SSE events
      setComponents([]);
      const reader = resp.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const lines = rawEvent.split("\n");
          const dataLines = lines.filter((l) => l.startsWith("data: ")).map((l) => l.slice(6)).join("");
          if (!dataLines) continue;
          try {
            const item = JSON.parse(dataLines);
            if (item && typeof item === "object" && typeof (item as any).type === "string") {
              setComponents((prev) => [...prev, item as ComponentSpec]);
            }
          } catch {
            // ignore malformed event
          }
        }
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("open-proposed-trips", onOpen as EventListener);
    return () => window.removeEventListener("open-proposed-trips", onOpen as EventListener);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
      if (phase === "intro" && introReady && (e.key === "Enter" || e.key === "Return")) {
        e.preventDefault();
        setPhase("trips");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, phase, introReady]);

  useEffect(() => {
    if (!open) return;
    // Reset to intro each time it's opened
    setPhase("intro");
    setIntroReady(false);
  }, [open]);

  const availableTrips = Array.isArray(trips) ? trips.filter((t) => !t.isBooked) : [];
  if (!availableTrips || availableTrips.length === 0) return null;
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={
          "absolute inset-0 bg-black/40 backdrop-blur-md " +
          (closing ? "animate-[fadeOut_300ms_ease-in_forwards]" : "")
        }
        onClick={() => {
          setClosing(true);
          setTimeout(() => setOpen(false), 300);
        }}
      />
      <div
        className={
          "relative z-10 flex items-center justify-center min-h-full p-4 " +
          (closing
            ? "animate-[fadeOut_300ms_ease-in_forwards]"
            : "animate-[fadeIn_200ms_ease-out_forwards] opacity-0")
        }
      >
        <div className="w-full max-w-4xl">
          {notice && (
            <div className="mb-3 opacity-0 animate-[itemIn_240ms_ease-out_forwards]">
              <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-white flex items-center gap-3 backdrop-blur-xl">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">✓</div>
                <div>
                  <div className="font-semibold">Trip booked</div>
                  <div className="text-white/80 text-sm">{notice}</div>
                </div>
              </div>
            </div>
          )}
          {/* Streaming AI notice above trips, styled with page.tsx gradient colors */}
          {phase === "intro" ? (
          <div className="mb-4">
            <ProposedTripsNotice
              variant="light"
              plain
              textClassName="text-white text-2xl sm:text-3xl md:text-4xl text-center"
              onReady={() => setIntroReady(true)}
            />
          </div>
          ) : (
            <div className="opacity-0 animate-[itemIn_320ms_ease-out_forwards]">
              <ProposedTrips
                trips={availableTrips}
                selectedId={activeTrip?.id}
                onTripClick={async (trip) => {
                  setResponse(null);
                  setLoading(true);
                  setMessages([]);
                  setActiveTrip(trip);
                  setComponents([]);
                  try {
                    await fetchAndStreamComponents({ ...trip, messages: [] });
                  } catch (_) {
                    setResponse("Something went wrong.");
                  } finally {
                    setLoading(false);
                  }
                }}
              />
            </div>
          )}

          <div className="mt-4">
            {loading && (
              <div className="py-8 flex items-center justify-center">
                <div className="inline-flex items-center gap-2">
                  <span className="ai-dot ai-dot-lg" style={{ animationDelay: "0ms" }} />
                  <span className="ai-dot ai-dot-lg" style={{ animationDelay: "150ms" }} />
                  <span className="ai-dot ai-dot-lg" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            {(messages.length > 0 || components.length > 0) && (
              <div className="rounded-xl border border-white/30 bg-white/5 backdrop-blur-xl text-white/90 p-3">
                <div className="space-y-2 max-h-64 overflow-auto pr-1">
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={(m.role === "assistant" ? "text-white/90" : "text-white/80") + " opacity-0 animate-[itemIn_260ms_ease-out_forwards]"}
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <div className={
                        m.role === "assistant"
                          ? "bg-white/10 border border-white/20 rounded-lg px-3 py-2"
                          : "bg-white/5 border border-white/10 rounded-lg px-3 py-2"
                      }>
                        {m.content}
                      </div>
                    </div>
                  ))}
                </div>
                {components.filter((c) => c.type === "flight").length > 0 && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                    {(components.filter((c) => c.type === "flight") as FlightSpec[]).map((f, i) => (
                      <div
                        key={f.id}
                        className="rounded-xl border border-white/20 bg-white/5 p-5 opacity-0 animate-[itemIn_320ms_ease-out_forwards]"
                        style={{ animationDelay: `${i * 80}ms` }}
                      >
                        <div className="mb-4 flex items-center justify-center">
                          <img src={f.carrierLogo} alt={f.carrier} className="w-2/3 max-h-28 sm:max-h-32 object-contain" />
                        </div>
                        <div className="flex items-center justify-between mb-4">
                          <div className="font-semibold text-white text-lg">{f.carrier}</div>
                          <div className="text-white/80 text-base">{f.flightNumber}</div>
                        </div>
                        <div className="mb-4">
                          <div className="text-white text-xl">
                            {f.origin} → {f.destination}
                          </div>
                          <div className="text-white/80 text-base">
                            {new Date(f.departAt).toLocaleString()} - {new Date(f.arriveAt).toLocaleString()}
                          </div>
                          <div className="text-white/70 text-sm">Duration: {Math.round(f.durationMinutes / 60)}h {f.durationMinutes % 60}m</div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-white text-2xl font-semibold">
                            {f.currency} {f.price}
                          </div>
                          <button
                            type="button"
                            className="px-4 py-2 rounded-md bg-white/20 hover:bg-white/30 border border-white/30 text-white text-base"
                            onClick={() => {
                              const body = {
                                tripId: activeTrip?.id ?? availableTrips[0]?.id,
                                carrier: f.carrier,
                                flightNumber: f.flightNumber,
                                originCity: f.originCity || (f.origin.split("(")[1]?.replace(")","")) || undefined,
                                originCode: f.originCode || (f.origin.split(" ")[0]) || undefined,
                                originAirportName: f.originAirportName || undefined,
                                destinationCity: f.destinationCity || (f.destination.split("(")[1]?.replace(")","")) || undefined,
                                destinationCode: f.destinationCode || (f.destination.split(" ")[0]) || undefined,
                                destinationAirportName: f.destinationAirportName || undefined,
                                departAt: f.departAt,
                                arriveAt: f.arriveAt,
                                price: f.price,
                                currency: f.currency,
                              };
                              fetch("/api/bookings", {
                                method: "POST",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify(body),
                              })
                                .then(async (r) => {
                                  if (!r.ok) throw new Error(await r.text());
                                  return r.json();
                                })
                                .then(() => {
                                  const msg = `${f.carrier} ${f.flightNumber} — ${f.origin} → ${f.destination}`;
                                  setResponse(`Booked ${msg}`);
                                  setNotice(msg);
                                  setTimeout(() => {
                                    setClosing(true);
                                    setTimeout(() => setOpen(false), 300);
                                  }, 3000);
                                })
                                .catch(() => setResponse("Failed to book flight."));
                            }}
                            aria-label={`Select flight ${f.flightNumber}`}
                          >
                            Select
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {components.filter((c) => c.type === "prompt").length > 0 && (
                  <div className="mt-3 space-y-3">
                    {(() => {
                      const prompts = (components.filter((c) => c.type === "prompt") as PromptSpec[]);
                      const start = prompts.find((p) => p.field === "startDate");
                      const end = prompts.find((p) => p.field === "endDate");
                      const others = prompts.filter((p) => p.field !== "startDate" && p.field !== "endDate");
                      return (
                        <>
                          {(start || end) && (
                            <div
                              className="rounded-lg border border-white/20 bg-white/5 p-3 opacity-0 animate-[itemIn_300ms_ease-out_forwards]"
                              style={{ animationDelay: `0ms` }}
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {start && (
                                  <div>
                                    <div className="text-white/90 mb-2">{start.label}</div>
                                    {Array.isArray(start.suggestions) && start.suggestions.length > 0 && (
                                      <div className="mb-2 flex flex-wrap gap-2">
                                        {start.suggestions.map((sug, i) => (
                                          <button
                                            key={`startDate-sug-${i}`}
                                            type="button"
                                            className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-white/90 text-sm"
                                            onClick={() => {
                                              if (loading) return;
                                              setPromptValues((prev) => ({ ...prev, startDate: sug }));
                                            }}
                                          >
                                            {sug}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                    <input
                                      type={start.inputType}
                                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                                      placeholder={start.label}
                                      value={promptValues.startDate || ""}
                                      onChange={(e) => setPromptValues((prev) => ({ ...prev, startDate: e.target.value }))}
                                      disabled={loading}
                                    />
                                  </div>
                                )}
                                {end && (
                                  <div>
                                    <div className="text-white/90 mb-2">{end.label}</div>
                                    {Array.isArray(end.suggestions) && end.suggestions.length > 0 && (
                                      <div className="mb-2 flex flex-wrap gap-2">
                                        {end.suggestions.map((sug, i) => (
                                          <button
                                            key={`endDate-sug-${i}`}
                                            type="button"
                                            className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-white/90 text-sm"
                                            onClick={() => {
                                              if (loading) return;
                                              setPromptValues((prev) => ({ ...prev, endDate: sug }));
                                            }}
                                          >
                                            {sug}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                    <input
                                      type={end.inputType}
                                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                                      placeholder={end.label}
                                      value={promptValues.endDate || ""}
                                      onChange={(e) => setPromptValues((prev) => ({ ...prev, endDate: e.target.value }))}
                                      disabled={loading}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {others.map((p, idx) => (
                            <div
                              key={p.field}
                              className="rounded-lg border border-white/20 bg-white/5 p-3 opacity-0 animate-[itemIn_300ms_ease-out_forwards]"
                              style={{ animationDelay: `${(idx + 1) * 90}ms` }}
                            >
                              <div className="text-white/90 mb-2">{p.label}</div>
                              {Array.isArray(p.suggestions) && p.suggestions.length > 0 && (
                                <div className="mb-2 flex flex-wrap gap-2">
                                  {p.suggestions.map((sug, i) => (
                                    <button
                                      key={`${p.field}-sug-${i}`}
                                      type="button"
                                      className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-white/90 text-sm"
                                      onClick={() => {
                                        if (loading) return;
                                        setPromptValues((prev) => ({ ...prev, [p.field]: sug }));
                                      }}
                                    >
                                      {sug}
                                    </button>
                                  ))}
                                </div>
                              )}
                              <input
                                type={p.inputType}
                                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 w-full"
                                placeholder={p.label}
                                value={promptValues[p.field] || ""}
                                onChange={(e) => setPromptValues((prev) => ({ ...prev, [p.field]: e.target.value }))}
                                disabled={loading}
                              />
                            </div>
                          ))}
                        </>
                      );
                    })()}
                    <form
                      className="flex items-center gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (loading) return;
                        const lastTrip = activeTrip ?? availableTrips[0];
                        if (!lastTrip) return;
                        const pending = (components.filter((c) => c.type === "prompt") as PromptSpec[]);
                        const entries = pending
                          .map((p) => [p.field, (promptValues[p.field] || "").trim()] as const)
                          .filter(([, v]) => v.length > 0);
                        if (entries.length === 0) return;
                        const stitched = entries.map(([k, v]) => `${k}: ${v}`).join("\n");
                        const newHistory = [...messages, { role: "user" as const, content: stitched }];
                        setMessages(newHistory);
                        setLoading(true);
                        try {
                          await fetchAndStreamComponents({ ...lastTrip, messages: newHistory });
                          setPromptValues((prev) => {
                            const next = { ...prev } as Record<string, string>;
                            entries.forEach(([k]) => {
                              next[k] = "";
                            });
                            return next;
                          });
                        } catch {
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 border border-white/30 text-white disabled:opacity-50"
                        disabled={loading || !(components.filter((c) => c.type === "prompt") as PromptSpec[]).some((p) => (promptValues[p.field] || "").trim().length > 0)}
                      >
                        Send
                      </button>
                    </form>
                  </div>
                )}
                {components.filter((c) => c.type === "button").length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(components.filter((c) => c.type === "button") as ButtonSpec[]).map((b, i) => (
                      <a
                        key={`btn-${i}`}
                        href={b.href}
                        aria-label={b.ariaLabel || b.label}
                        className={b.classes + " opacity-0 animate-[itemIn_300ms_ease-out_forwards]"}
                        style={{ animationDelay: `${i * 80}ms` }}
                      >
                        {b.label}
                      </a>
                    ))}
                  </div>
                )}
                {/* Removed redundant static input and send button */}
              </div>
            )}
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(6px); } }
        @keyframes itemIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .ai-dot { display:inline-block; width:6px; height:6px; border-radius:9999px; background:rgba(255,255,255,0.9); opacity:0.2; animation: aiDots 900ms infinite ease-in-out; }
        .ai-dot-lg { width:10px; height:10px; }
        @keyframes aiDots { 0% { opacity:0.2; transform: translateY(0); } 30% { opacity:1; transform: translateY(-2px); } 60% { opacity:0.6; transform: translateY(0); } 100% { opacity:0.2; transform: translateY(0); } }
      `}</style>
    </div>
  );
}


