"use client";

import { useEffect } from "react";

export default function Hero() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCmdK = (e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K");
      if (isCmdK) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("open-proposed-trips"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section className="w-full pt-36 sm:pt-40 pb-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative">
          <div className="relative z-10 p-8 sm:p-12 text-center">
            <div className="space-y-4 sm:space-y-6">
              <h1 className="leading-none tracking-tight font-extrabold bg-clip-text text-transparent bg-[linear-gradient(180deg,#3c424a_0%,#5c616a_100%)] drop-shadow-sm">
                <span className="block text-4xl sm:text-6xl md:text-7xl">Plan Your Next</span>
                <span className="block text-5xl sm:text-7xl md:text-8xl">Escape</span>
              </h1>
              <div className="h-px bg-black/10 max-w-3xl mx-auto" />
              {/* AI notice moved into ProposedTripsModal; modal opens on load */}
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </section>
  );
}


