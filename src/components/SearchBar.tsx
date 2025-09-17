"use client";

import { useEffect, useRef, useState } from "react";

type SearchResult = {
  text: string;
  error?: string;
};

type FlightSpec = {
  type: "flight";
  id: string;
  carrier: string;
  carrierLogo: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departAt: string;
  arriveAt: string;
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

export default function SearchBar() {
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const [components, setComponents] = useState<Array<any>>([]);
  const [promptValues, setPromptValues] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant" | "system"; content: string }>>([]);
  const [tripId, setTripId] = useState<number | null>(null);
  const [emailCount, setEmailCount] = useState<number>(0);
  const autoOpenedEmailTripsRef = useRef<boolean>(false);

  type RecentTrip = {
    id: number;
    destination: string;
    startDate: string | null;
    endDate: string | null;
  };
  const [recent, setRecent] = useState<RecentTrip[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/recent-searches", { cache: "no-store" });
        if (!r.ok) return;
        const data = await r.json();
        if (!cancelled && Array.isArray(data)) setRecent(data);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch detected emails meta (count)
  useEffect(() => {
    let cancelled = false;
    let interval: any;
    const check = async () => {
      try {
        const r = await fetch("/api/emails?summary=false", { cache: "no-store" });
        if (!r.ok) return;
        const data = await r.json();
        const count = Number(data?.count ?? 0);
        if (!cancelled && Number.isFinite(count)) {
          setEmailCount(count > 0 ? count : 0);
          // Auto-open ProposedTrips modal once when emails are first detected
          if (count > 0 && !autoOpenedEmailTripsRef.current) {
            autoOpenedEmailTripsRef.current = true;
            try {
              const evt = new CustomEvent("open-proposed-trips", { detail: { autoStart: true }, bubbles: true, composed: true });
              window.dispatchEvent(evt);
            } catch {
              try { window.dispatchEvent(new Event("open-proposed-trips")); } catch {}
              try { (window as any).openProposedTripsModal?.({ autoStart: true }); } catch {}
            }
          }
        }
      } catch {}
    };
    // Run immediately, then poll every 10 seconds
    check();
    interval = setInterval(check, 10000);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, []);

  function openProposedTrips() {
    try {
      // Signal the ProposedTripsModal to open and jump straight to trips list
      const evt = new CustomEvent("open-proposed-trips", { detail: { autoStart: true }, bubbles: true, composed: true });
      window.dispatchEvent(evt);
      // Direct-call fallback if any
      try { (window as any).openProposedTripsModal?.({ autoStart: true }); } catch {}
    } catch {
      // Fallback in older browsers
      try { window.dispatchEvent(new Event("open-proposed-trips")); } catch {}
      try { (window as any).openProposedTripsModal?.({ autoStart: true }); } catch {}
    }
  }

  function toYMD(v: Date | string | null | undefined): string {
    if (!v) return "";
    const d = new Date(v as any);
    if (isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  async function startFromExistingTrip(trip: RecentTrip) {
    try {
      setModalOpen(true);
      setResult(null);
      setLoading(true);
      setComponents([]);
      setMessages([]);
      setPromptValues({});
      setTripId(null);
      setDestination(trip.destination || "");

      const resp = await fetch("/api/component?stream=1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: trip.id }),
      });

      const contentType = resp.headers.get("content-type") || "";
      if (!contentType.includes("text/event-stream")) {
        const data = await resp.json().catch(() => null);
        if (data && typeof data.tripId === "number") setTripId(data.tripId);
        if (data && Array.isArray(data.components)) setComponents(data.components);
      } else {
        setComponents([]);
        const reader = resp.body?.getReader();
        if (reader) {
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
                if (item && typeof item === "object") {
                  if (item.type === "context" && typeof item.tripId === "number") {
                    setTripId(item.tripId);
                  } else if (typeof item.type === "string") {
                    setComponents((prev) => [...prev, item]);
                  }
                }
              } catch {}
            }
          }
        }
      }
    } catch (e: any) {
      setResult({ text: "Failed to load trip components", error: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    const t = setTimeout(() => firstInputRef.current?.focus(), 0);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearTimeout(t);
    };
  }, [modalOpen]);

  // Open modal with Command (⌘) + K
  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && e.metaKey) {
        e.preventDefault();
        setModalOpen(true);
      }
    };
    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  }, []);

  // Listen for global events to open/prefill modal from other components (e.g., SearchDock)
  useEffect(() => {
    const onOpen = () => setModalOpen(true);
    const onPrefill = (ev: Event) => {
      try {
        const ce = ev as unknown as CustomEvent<{ destination?: string; startDate?: string; endDate?: string }>;
        const d = ce?.detail || {};
        if (typeof d.destination === "string") setDestination(d.destination);
        setPromptValues((prev) => ({
          ...prev,
          ...(typeof d.startDate === "string" ? { startDate: d.startDate } : {}),
          ...(typeof d.endDate === "string" ? { endDate: d.endDate } : {}),
        }));
        setModalOpen(true);
      } catch {
        setModalOpen(true);
      }
    };
    window.addEventListener("open-searchbar", onOpen as EventListener);
    window.addEventListener("prefill-searchbar", onPrefill as EventListener);
    return () => {
      window.removeEventListener("open-searchbar", onOpen as EventListener);
      window.removeEventListener("prefill-searchbar", onPrefill as EventListener);
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!destination.trim()) {
      setResult({ text: "Please enter a destination." });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      setComponents([]);
      setMessages([]);
      setPromptValues({});
      setTripId(null);
      const resp = await fetch("/api/component?stream=1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ destination }),
      });

      const contentType = resp.headers.get("content-type") || "";
      if (!contentType.includes("text/event-stream")) {
        const data = await resp.json().catch(() => null);
        if (data && typeof data.tripId === "number") setTripId(data.tripId);
        if (data && Array.isArray(data.components)) setComponents(data.components);
      } else {
        const reader = resp.body?.getReader();
        if (reader) {
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
                if (item && typeof item === "object") {
                  if (item.type === "context" && typeof item.tripId === "number") {
                    setTripId(item.tripId);
                  } else if (typeof item.type === "string") {
                    setComponents((prev) => [...prev, item]);
                  }
                }
              } catch {}
            }
          }
        }
      }
    } catch (e: any) {
      setResult({ text: "Failed to search trips", error: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <form
        className="grid grid-cols-1 items-end"
        onSubmit={onSubmit}
        onFocus={(e) => {
          const target = e.target as HTMLElement;
          if (!modalOpen && target && (target.tagName === "INPUT" || target.tagName === "BUTTON")) {
            target.blur();
            setModalOpen(true);
          }
        }}
      >
        <div className="w-full rounded-full border border-white/40 bg-white/25 hover:bg-white/30 backdrop-blur-xl text-white px-6 sm:px-8 py-4 sm:py-5 flex items-center gap-4 shadow-lg shadow-black/10">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="opacity-90">
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Where do you want to go?"
            enterKeyHint="search"
            className="flex-1 bg-transparent placeholder-white/80 text-lg sm:text-xl focus:outline-none"
          />
          <span className="text-xs sm:text-sm text-white/80 hidden sm:inline">Press ⌘K</span>
        </div>
      </form>

        {result && !modalOpen && (
          <div className="mt-4 rounded-xl border border-white/20 bg-white/5 p-3 text-white/90 whitespace-pre-wrap max-h-64 overflow-auto">
            {result.text}
          </div>
        )}

      {(recent.length > 0 || emailCount > 0) && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {recent.length > 0 && (
            <div>
              <div className="px-1 mb-2 text-xs tracking-[0.18em] font-bold text-white">
                recent searches
              </div>
              <div className="flex flex-wrap gap-2.5">
                {recent.map((r) => {
                  const start = toYMD(r.startDate);
                  const end = toYMD(r.endDate);
                  const label = start ? `${r.destination} — ${start}${end ? ` → ${end}` : ""}` : r.destination;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white/90 text-sm sm:text-base"
                      onClick={() => startFromExistingTrip(r)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {emailCount > 0 && (
            <div>
              <div className="px-1 mb-2 text-xs tracking-[0.18em] font-bold text-white">
                detected emails
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white/90 text-sm sm:text-base"
                  onClick={openProposedTrips}
                >
                  {emailCount} trip{emailCount > 1 ? "s" : ""} found — open
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md opacity-0 animate-[fadeIn_180ms_ease-out_forwards]" onClick={() => setModalOpen(false)} />
          <div className="relative z-10 flex items-center justify-center min-h-full p-4 opacity-0 animate-[fadeIn_220ms_ease-out_forwards]">
            <div className="w-full max-w-4xl">
              <div className="rounded-2xl border border-white/30 bg-white/5 backdrop-blur-xl text-white p-4 sm:p-5 opacity-0 animate-[itemIn_260ms_ease-out_forwards]">
                <div className="px-1 mb-3 text-xs tracking-[0.18em] font-semibold bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
                  FIND YOUR TRIP
                </div>
                <form className="grid grid-cols-1 gap-3 items-end" onSubmit={onSubmit}>
                  <div className="w-full rounded-full border border-white/40 bg-white/25 hover:bg-white/30 backdrop-blur-xl text-white px-6 sm:px-8 py-4 sm:py-5 flex items-center gap-4 shadow-lg shadow-black/10">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="opacity-90">
                      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                    <input
                      ref={firstInputRef}
                      type="text"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="Where do you want to go?"
                      enterKeyHint="search"
                      className="flex-1 bg-transparent placeholder-white/80 text-lg sm:text-xl focus:outline-none"
                    />
                    <span className="text-xs sm:text-sm text-white/80 hidden sm:inline">Press ⌘K</span>
                  </div>
                </form>
                {(recent.length > 0 || emailCount > 0) && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {recent.length > 0 && (
                      <div>
                        <div className="px-1 mb-2 text-xs tracking-[0.18em] font-semibold bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
                          recent searches
                        </div>
                        <div className="flex flex-wrap gap-2.5">
                          {recent.map((r) => {
                            const start = toYMD(r.startDate);
                            const end = toYMD(r.endDate);
                            const label = start ? `${r.destination} — ${start}${end ? ` → ${end}` : ""}` : r.destination;
                            return (
                              <button
                                key={r.id}
                                type="button"
                                className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white/90 text-sm sm:text-base"
                                onClick={() => startFromExistingTrip(r)}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {emailCount > 0 && (
                      <div>
                        <div className="px-1 mb-2 text-xs tracking-[0.18em] font-semibold bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
                          detected emails
                        </div>
                        <div className="flex flex-wrap gap-2.5">
                          <button
                            type="button"
                            className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white/90 text-sm sm:text-base"
                            onClick={openProposedTrips}
                          >
                            {emailCount} trip{emailCount > 1 ? "s" : ""} found — open
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {loading && (
                  <div className="py-8 flex items-center justify-center">
                    <div className="inline-flex items-center gap-2">
                      <span className="ai-dot ai-dot-lg" style={{ animationDelay: "0ms" }} />
                      <span className="ai-dot ai-dot-lg" style={{ animationDelay: "150ms" }} />
                      <span className="ai-dot ai-dot-lg" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
                {(components.filter((c) => c.type === "prompt").length > 0 || components.filter((c) => c.type === "button").length > 0) && (
                  <div className="mt-4 opacity-0 animate-[itemIn_320ms_ease-out_forwards]">
                    {components.filter((c) => c.type === "prompt").length > 0 && (
                      <div className="space-y-4">
                        {(() => {
                          const prompts = components.filter((c) => c.type === "prompt") as Array<{ field: string; label: string; inputType: string; suggestions?: string[] }>;
                          const start = prompts.find((p) => p.field === "startDate");
                          const end = prompts.find((p) => p.field === "endDate");
                          const others = prompts.filter((p) => p.field !== "startDate" && p.field !== "endDate");
                          return (
                            <>
                              {(start || end) && (
                                <div className="rounded-xl border border-white/20 bg-white/5 p-4 sm:p-5 opacity-0 animate-[itemIn_300ms_ease-out_forwards]" style={{ animationDelay: `0ms` }}>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {start && (
                                      <div>
                                        <div className="text-white/90 mb-2 text-base sm:text-lg">{start.label}</div>
                                        {Array.isArray(start.suggestions) && start.suggestions.length > 0 && (
                                          <div className="mb-3 flex flex-wrap gap-2.5">
                                            {start.suggestions.map((sug, i) => (
                                              <button
                                                key={`startDate-sug-${i}`}
                                                type="button"
                                                className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-white/90 text-base"
                                                onClick={() => setPromptValues((prev) => ({ ...prev, startDate: sug }))}
                                              >
                                                {sug}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                        <input
                                          type={start.inputType as any}
                                          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 text-base"
                                          placeholder={start.label}
                                          value={promptValues.startDate || ""}
                                          onChange={(e) => setPromptValues((prev) => ({ ...prev, startDate: e.target.value }))}
                                        />
                                      </div>
                                    )}
                                    {end && (
                                      <div>
                                        <div className="text-white/90 mb-2 text-base sm:text-lg">{end.label}</div>
                                        {Array.isArray(end.suggestions) && end.suggestions.length > 0 && (
                                          <div className="mb-3 flex flex-wrap gap-2.5">
                                            {end.suggestions.map((sug, i) => (
                                              <button
                                                key={`endDate-sug-${i}`}
                                                type="button"
                                                className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-white/90 text-base"
                                                onClick={() => setPromptValues((prev) => ({ ...prev, endDate: sug }))}
                                              >
                                                {sug}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                        <input
                                          type={end.inputType as any}
                                          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 text-base"
                                          placeholder={end.label}
                                          value={promptValues.endDate || ""}
                                          onChange={(e) => setPromptValues((prev) => ({ ...prev, endDate: e.target.value }))}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              {others.map((p, idx) => (
                                <div key={p.field} className="rounded-xl border border-white/20 bg-white/5 p-4 sm:p-5 opacity-0 animate-[itemIn_300ms_ease-out_forwards]" style={{ animationDelay: `${(idx + 1) * 90}ms` }}>
                                  <div className="text-white/90 mb-2 text-base sm:text-lg">{p.label}</div>
                                  {Array.isArray(p.suggestions) && p.suggestions.length > 0 && (
                                    <div className="mb-3 flex flex-wrap gap-2.5">
                                      {p.suggestions.map((sug, i) => (
                                        <button
                                          key={`${p.field}-sug-${i}`}
                                          type="button"
                                          className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-white/90 text-base"
                                          onClick={() => setPromptValues((prev) => ({ ...prev, [p.field]: sug }))}
                                        >
                                          {sug}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  <input
                                    type={p.inputType as any}
                                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 w-full text-base"
                                    placeholder={p.label}
                                    value={promptValues[p.field] || ""}
                                    onChange={(e) => setPromptValues((prev) => ({ ...prev, [p.field]: e.target.value }))}
                                  />
                                </div>
                              ))}
                            </>
                          );
                        })()}
                        <form
                          className="flex items-center gap-3"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const pending = components.filter((c) => c.type === "prompt") as Array<{ field: string; label: string }>;
                            const entries = pending
                              .map((p) => [p.field, (promptValues[p.field] || "").trim()] as const)
                              .filter(([, v]) => v.length > 0);
                            if (entries.length === 0) return;
                            const stitched = entries.map(([k, v]) => `${k}: ${v}`).join("\n");
                            const newHistory = [...messages, { role: "user" as const, content: stitched }];
                            setMessages(newHistory);
                            setLoading(true);
                            try {
                              const resp2 = await fetch("/api/component?stream=1", {
                                method: "POST",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({ id: tripId || undefined, destination, messages: newHistory }),
                              });
                              const contentType2 = resp2.headers.get("content-type") || "";
                              if (!contentType2.includes("text/event-stream")) {
                                const data2 = await resp2.json().catch(() => null);
                                if (data2 && Array.isArray(data2.components)) setComponents(data2.components);
                              } else {
                                setComponents([]);
                                const reader2 = resp2.body?.getReader();
                                if (reader2) {
                                  const decoder2 = new TextDecoder();
                                  let buffer2 = "";
                                  while (true) {
                                    const { done, value } = await reader2.read();
                                    if (done) break;
                                    buffer2 += decoder2.decode(value, { stream: true });
                                    let idx2;
                                    while ((idx2 = buffer2.indexOf("\n\n")) !== -1) {
                                      const rawEvent2 = buffer2.slice(0, idx2);
                                      buffer2 = buffer2.slice(idx2 + 2);
                                      const lines2 = rawEvent2.split("\n");
                                      const dataLines2 = lines2.filter((l) => l.startsWith("data: ")).map((l) => l.slice(6)).join("");
                                      if (!dataLines2) continue;
                                      try {
                                        const item2 = JSON.parse(dataLines2);
                                        if (item2 && typeof item2 === "object") {
                                          if (item2.type === "context" && typeof item2.tripId === "number") {
                                            setTripId(item2.tripId);
                                          } else if (typeof item2.type === "string") {
                                            setComponents((prev) => [...prev, item2]);
                                          }
                                        }
                                      } catch {}
                                    }
                                  }
                                }
                              }
                              setPromptValues((prev) => {
                                const next = { ...prev } as Record<string, string>;
                                entries.forEach(([k]) => { next[k] = ""; });
                                return next;
                              });
                            } finally {
                              setLoading(false);
                            }
                          }}
                        >
                          <button type="submit" className="px-5 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 border border-white/30 text-white text-base sm:text-lg disabled:opacity-50" disabled={loading}>
                            Send
                          </button>
                        </form>
                      </div>
                    )}
                    {components.filter((c) => c.type === "button").length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-3">
                        {(components.filter((c) => c.type === "button") as Array<any>).map((b, i) => (
                          <a key={`btn-${i}`} href={b.href} aria-label={b.ariaLabel || b.label} className={b.classes + " text-base sm:text-lg px-5 py-2.5 rounded-xl opacity-0 animate-[itemIn_300ms_ease-out_forwards]"} style={{ animationDelay: `${i * 80}ms` }}>
                            {b.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {components.filter((c) => c.type === "flight").length > 0 && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                    {(components.filter((c) => c.type === "flight") as FlightSpec[]).map((f, i) => (
                      <div
                        key={f.id}
                        className="rounded-2xl border border-white/20 bg-white/5 p-5 opacity-0 animate-[itemIn_320ms_ease-out_forwards]"
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
                            className="px-4 py-2 rounded-md bg-white/20 hover:bg-white/30 border border-white/30 text-white text-base disabled:opacity-50"
                            onClick={async () => {
                              if (!tripId) return;
                              const parseLabel = (label: string) => {
                                const raw = String(label || "").trim();
                                // Case 1: CODE (City)
                                let m = raw.match(/^([A-Za-z0-9]{3})\s*\(([^)]+)\)/);
                                if (m) return { code: m[1].toUpperCase(), city: m[2].trim() };
                                // Case 2: City (CODE)
                                m = raw.match(/^(.+?)\s*\(([A-Za-z0-9]{3})\)/);
                                if (m) return { code: m[2].toUpperCase(), city: m[1].trim() };
                                // Case 3: Any standalone 3-letter token
                                const anyCode = /\b([A-Za-z0-9]{3})\b/.exec(raw)?.[1];
                                if (anyCode) return { code: anyCode.toUpperCase(), city: raw };
                                // Fallback: synthesize a pseudo-code and use label as city
                                const synth = raw.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "XXX";
                                return { code: synth, city: raw || "Unknown" };
                              };
                              const o = parseLabel(f.origin);
                              const d = parseLabel(f.destination);
                              const body = {
                                tripId,
                                carrier: f.carrier,
                                flightNumber: f.flightNumber,
                                originCity: f.originCity || o.city,
                                originCode: f.originCode || o.code,
                                originAirportName: f.originAirportName || o.city,
                                destinationCity: f.destinationCity || d.city,
                                destinationCode: f.destinationCode || d.code,
                                destinationAirportName: f.destinationAirportName || d.city,
                                departAt: f.departAt,
                                arriveAt: f.arriveAt,
                                price: f.price,
                                currency: f.currency,
                              } as any;
                              try {
                                const r = await fetch("/api/bookings", {
                                  method: "POST",
                                  headers: { "content-type": "application/json" },
                                  body: JSON.stringify(body),
                                });
                                if (!r.ok) {
                                  let msg = "Failed to book flight.";
                                  try {
                                    const j = await r.json();
                                    if (Array.isArray(j?.errors)) msg = `Failed: ${j.errors.join(", ")}`;
                                  } catch {}
                                  setResult({ text: msg, error: "booking" });
                                  return;
                                }
                                const msg = `${f.carrier} ${f.flightNumber} — ${f.origin} → ${f.destination}`;
                                setResult({ text: `Booked ${msg}` });
                                setTimeout(() => setModalOpen(false), 3000);
                              } catch (e: any) {
                                setResult({ text: `Failed to book flight. ${String(e?.message || e)}`, error: "booking" });
                              }
                            }}
                            aria-label={`Select flight ${f.flightNumber}`}
                            disabled={!tripId}
                          >
                            Select
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {result && (
                  <div className="mt-4 rounded-xl border border-white/20 bg-white/5 p-3 text-white/90 whitespace-pre-wrap max-h-64 overflow-auto">
                    {result.text}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes itemIn { from { opacity: 0; transform: translateY(6px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .ai-dot { display:inline-block; width:6px; height:6px; border-radius:9999px; background:rgba(255,255,255,0.9); opacity:0.2; animation: aiDots 900ms infinite ease-in-out; }
        .ai-dot-lg { width:10px; height:10px; }
        @keyframes aiDots { 0% { opacity:0.2; transform: translateY(0); } 30% { opacity:1; transform: translateY(-2px); } 60% { opacity:0.6; transform: translateY(0); } 100% { opacity:0.2; transform: translateY(0); } }
      `}</style>
    </div>
  );
}


