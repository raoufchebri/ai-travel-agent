"use client";

import { useEffect, useState } from "react";

type EmailsCheckResponse = {
  hasNew: boolean;
  count: number;
  summary?: string | null;
};

export default function EmailNotifier() {
  const [show, setShow] = useState(false);
  const [count, setCount] = useState<number>(0);
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    const check = async () => {
      try {
        const res = await fetch("/api/emails?summary=false", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as EmailsCheckResponse;
        if (!isActive) return;
        if (data.hasNew) {
          setCount(data.count);
          // Show modal immediately
          setShow(true);

          // If server already gave a summary, use it; otherwise stream
          if (data.summary && data.summary.length > 0) {
            setSummary(data.summary);
            return;
          }

          // Stream summary (switch to trips streaming)
          try {
            const resp = await fetch("/api/emails?stream=true", {
              cache: "no-store",
              signal: controller.signal,
            });
            if (!resp.ok || !resp.body) return;
            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let aggregated = "";
            const timeoutMs = 8000;
            const timeout = setTimeout(() => controller.abort(), timeoutMs);
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                aggregated += chunk;
                if (!isActive) break;
                setSummary(aggregated);
              }
            } finally {
              clearTimeout(timeout);
            }
          } catch (_) {
            // ignore stream errors
            if (!summary) setSummary("(AI summary unavailable right now.)");
          }
        }
      } catch (_) {
        // silently ignore
      }
    };

    void check();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => setShow(false)} />
      <div className="relative z-10 w-[90%] max-w-sm rounded-2xl border border-white/70 bg-white/80 p-6 shadow-xl backdrop-blur-md">
        <h2 className="text-lg font-semibold text-gray-900">New Emails</h2>
        <p className="mt-2 text-sm text-gray-700">
          You have {count} new {count === 1 ? "email" : "emails"}.
        </p>
        <p className="mt-2 text-sm text-gray-800 min-h-[1.5rem]">
          {summary && summary.length > 0 ? summary : "Generating summary..."}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
            onClick={() => setShow(false)}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}


