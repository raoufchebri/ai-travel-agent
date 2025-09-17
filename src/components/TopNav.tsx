"use client";

export default function TopNav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mt-5 rounded-full border-2 border-white/50 bg-white/30 backdrop-blur-2xl text-white shadow-[0_20px_60px_-20px_rgba(0,0,0,0.45)]">
          <nav className="h-14 sm:h-16 px-5 sm:px-8 flex items-center justify-between">
            <div className="text-lg sm:text-xl font-semibold tracking-wider">Travel Agent</div>
            <ul className="hidden sm:flex items-center gap-8 text-base">
              <li><a className="hover:opacity-80" href="#destinations">Destinations</a></li>
              <li><a className="hover:opacity-80" href="#deals">Deals</a></li>
              <li><a className="hover:opacity-80" href="#about">About</a></li>
              <li><a className="hover:opacity-80" href="/settings">Settings</a></li>
            </ul>
            <a href="#book" className="text-sm sm:text-base font-medium rounded-full px-4 py-2 bg-white text-black hover:opacity-90">Book now</a>
          </nav>
        </div>
      </div>
    </header>
  );
}


