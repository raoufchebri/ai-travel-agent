"use client";

import { useEffect, useRef, useState } from "react";

type SearchResult = {
  text: string;
  error?: string;
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
      <div className="rounded-2xl border border-white/30 bg-white/10 backdrop-blur-xl text-white p-4 sm:p-5">
        <form
          className="grid grid-cols-1 gap-3 items-end"
          onSubmit={onSubmit}
          onFocus={(e) => {
            const target = e.target as HTMLElement;
            if (!modalOpen && target && (target.tagName === "INPUT" || target.tagName === "BUTTON")) {
              target.blur();
              setModalOpen(true);
            }
          }}
        >
          <div>
            <label className="block text-xs text-white/80 mb-1">Destination</label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Where do you want to go?"
              enterKeyHint="search"
              className="w-full h-14 sm:h-16 bg-white/10 border border-white/30 rounded-xl px-4 sm:px-5 py-3 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40 text-lg sm:text-xl"
            />
          </div>
        </form>

        {result && !modalOpen && (
          <div className="mt-4 rounded-xl border border-white/20 bg-white/5 p-3 text-white/90 whitespace-pre-wrap max-h-64 overflow-auto">
            {result.text}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md opacity-0 animate-[fadeIn_180ms_ease-out_forwards]" onClick={() => setModalOpen(false)} />
          <div className="relative z-10 flex items-center justify-center min-h-full p-4 opacity-0 animate-[fadeIn_220ms_ease-out_forwards]">
            <div className="w-full max-w-4xl">
              <div className="rounded-2xl border border-white/30 bg-white/10 backdrop-blur-xl text-white p-4 sm:p-5 opacity-0 animate-[itemIn_260ms_ease-out_forwards]">
                <div className="px-1 mb-3 text-xs tracking-[0.18em] font-semibold bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
                  FIND YOUR TRIP
                </div>
                <form className="grid grid-cols-1 gap-3 items-end" onSubmit={onSubmit}>
                  <div>
                    <label className="block text-xs text-white/80 mb-1">Destination</label>
                    <input
                      ref={firstInputRef}
                      type="text"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="Where do you want to go?"
                      enterKeyHint="search"
                      className="w-full h-14 sm:h-16 bg-white/10 border border-white/30 rounded-xl px-4 sm:px-5 py-3 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40 text-lg sm:text-xl"
                    />
                  </div>
                </form>
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


