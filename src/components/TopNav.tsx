"use client";
import Link from "next/link";

export default function TopNav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <nav className="h-14 sm:h-16 px-4 sm:px-6 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-full px-1 -mx-1">
              <img src="/globe.svg" alt="" className="h-5 w-5 opacity-90" />
              <span className="text-lg sm:text-xl font-semibold tracking-wider">Travel Agent</span>
            </Link>
          </div>
          <ul className="hidden sm:flex items-center gap-8 text-base">
            <li><a className="hover:opacity-80" href="#destinations">Destinations</a></li>
            <li><a className="hover:opacity-80" href="#deals">Deals</a></li>
            <li><a className="hover:opacity-80" href="#about">About</a></li>
            <li><a className="hover:opacity-80" href="/settings">Settings</a></li>
          </ul>
          <a href="#deals" className="text-sm sm:text-base font-medium rounded-full px-4 py-2 bg-white text-black hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.35)]">Book now</a>
        </nav>
      </div>
    </header>
  );
}


