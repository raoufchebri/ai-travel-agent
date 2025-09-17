"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  variant?: "dark" | "light";
  className?: string;
  firstName?: string;
  plain?: boolean;
  textClassName?: string;
  onReady?: () => void;
  onCount?: (count: number) => void;
};

export default function ProposedTripsNotice({ variant = "dark", className, firstName, plain = false, textClassName, onReady, onCount }: Props) {
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const abortRef = useRef<AbortController | null>(null);
  const readyFiredRef = useRef<boolean>(false);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    let isActive = true;

    const run = async () => {
      try {
        // First, get count quickly (non-streaming)
        try {
          const quick = await fetch("/api/emails?summary=false", { cache: "no-store", signal: controller.signal });
          if (quick.ok) {
            const meta = (await quick.json()) as { hasNew: boolean; count: number };
            if (isActive && meta && typeof meta.count === "number" && meta.count > 0) {
              onCount?.(meta.count);
            }
          }
        } catch (_) {
          // ignore meta fetch failures
        }

        const search = new URLSearchParams();
        search.set("intent", "proposedTrips");
        search.set("stream", "true");
        search.set("summary", "false");
        if (firstName && firstName.trim().length > 0) search.set("firstName", firstName.trim());
        const resp = await fetch(`/api/emails?${search.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!resp.ok || !resp.body) {
          setLoading(false);
          return;
        }
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          acc += chunk;
          if (!isActive) break;
          // Do not update UI mid-stream; wait until full text is received
        }
        if (isActive) {
          setMessage(acc);
          if (!readyFiredRef.current && acc.trim().length > 0) {
            readyFiredRef.current = true;
            onReady?.();
          }
        }
      } catch (_) {
        // ignore streaming failures; leave message empty
      } finally {
        if (isActive) setLoading(false);
      }
    };

    run();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  const base = "rounded-xl px-3 py-2";
  const lightBox = "border border-black/10 bg-white text-black/80";
  const lightFinal = "border border-black/15 bg-white shadow-sm text-black/90";
  const darkBox = "border border-white/30 bg-white/5 text-white/80";
  const darkFinal = "border border-white/30 bg-white/5 backdrop-blur-xl text-white/90";

  if (loading && !message) {
    if (plain) {
      return (
        <>
          <div className={`${textClassName ?? ""} flex items-center justify-center min-h-[50vh]`}>
            <div className="inline-flex items-center gap-2">
              <span className="ai-dot ai-dot-lg" style={{ animationDelay: "0ms" }} />
              <span className="ai-dot ai-dot-lg" style={{ animationDelay: "150ms" }} />
              <span className="ai-dot ai-dot-lg" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
          <style jsx>{`
            .ai-dot { display:inline-block; width:6px; height:6px; border-radius:9999px; background:rgba(255,255,255,0.9); opacity:0.2; animation: aiDots 900ms infinite ease-in-out; }
            .ai-dot-lg { width:10px; height:10px; }
            @keyframes aiDots { 0% { opacity:0.2; transform: translateY(0); } 30% { opacity:1; transform: translateY(-2px); } 60% { opacity:0.6; transform: translateY(0); } 100% { opacity:0.2; transform: translateY(0); } }
          `}</style>
        </>
      );
    }
    return (
      <>
        <div className={`min-h-[50vh] flex items-center justify-center`}>
          <div className={`${base} ${variant === "light" ? lightBox : darkBox} ${className ?? ""} flex items-center justify-center`}>
            <div className="inline-flex items-center gap-2">
              <span className="ai-dot ai-dot-lg" style={{ animationDelay: "0ms" }} />
              <span className="ai-dot ai-dot-lg" style={{ animationDelay: "150ms" }} />
              <span className="ai-dot ai-dot-lg" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        </div>
        <style jsx>{`
          .ai-dot { display:inline-block; width:6px; height:6px; border-radius:9999px; background:rgba(255,255,255,0.9); opacity:0.2; animation: aiDots 900ms infinite ease-in-out; }
          .ai-dot-lg { width:10px; height:10px; }
          @keyframes aiDots { 0% { opacity:0.2; transform: translateY(0); } 30% { opacity:1; transform: translateY(-2px); } 60% { opacity:0.6; transform: translateY(0); } 100% { opacity:0.2; transform: translateY(0); } }
        `}</style>
      </>
    );
  }

  if (!message) return null;

  if (plain) {
    return (
      <>
        <p className={`${textClassName ?? ""} notice-fade`}>{message}</p>
        <style jsx>{`
          .notice-fade { opacity: 0; animation: noticeFadeIn 360ms ease-out forwards; }
          @keyframes noticeFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
      </>
    );
  }

  return (
    <>
      <div className={`${base} ${variant === "light" ? lightFinal : darkFinal} ${className ?? ""} notice-fade`}>
        {message}
      </div>
      <style jsx>{`
        .notice-fade { opacity: 0; animation: noticeFadeIn 360ms ease-out forwards; }
        @keyframes noticeFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </>
  );
}


