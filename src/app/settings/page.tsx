export default function SettingsPage() {
  return (
    <div className="font-sans min-h-screen relative">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[#DBE1ED]" />
      <div className="w-full mx-auto max-w-3xl px-4 sm:px-6">
        <h1 className="mt-4 sm:mt-6 px-1 mb-4 text-xs tracking-[0.18em] font-semibold bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
          SETTINGS
        </h1>

        <section className="mb-6 sm:mb-8">
          <div className="rounded-2xl border-2 border-white/90 bg-white/10 backdrop-blur-2xl text-black/80 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.25)]">
            <div className="p-5 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight mb-3 text-foreground">Address</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-black/70">Street</span>
                  <input className="h-11 rounded-xl px-3.5 bg-white/80 border border-black/10 outline-none text-sm" defaultValue="123 Main St" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-black/70">City</span>
                  <input className="h-11 rounded-xl px-3.5 bg-white/80 border border-black/10 outline-none text-sm" defaultValue="San Francisco" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-black/70">State/Province</span>
                  <input className="h-11 rounded-xl px-3.5 bg-white/80 border border-black/10 outline-none text-sm" defaultValue="CA" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-black/70">Postal Code</span>
                  <input className="h-11 rounded-xl px-3.5 bg-white/80 border border-black/10 outline-none text-sm" defaultValue="94105" />
                </div>
                <div className="flex flex-col sm:col-span-2">
                  <span className="text-xs font-medium text-black/70">Country</span>
                  <input className="h-11 rounded-xl px-3.5 bg-white/80 border border-black/10 outline-none text-sm" defaultValue="United States" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6 sm:mb-8">
          <div className="rounded-2xl border-2 border-white/90 bg-white/10 backdrop-blur-2xl text-black/80 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.25)]">
            <div className="p-5 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight mb-3 text-foreground">Frequent Travelers</h2>
              <div className="space-y-4">
                <div className="rounded-xl border border-white/70 bg-white/60 px-4 py-3">
                  <div className="text-sm font-medium">Wife</div>
                  <div className="text-xs text-black/70">Adult</div>
                </div>
                <div className="rounded-xl border border-white/70 bg-white/60 px-4 py-3">
                  <div className="text-sm font-medium">Child 1</div>
                  <div className="text-xs text-black/70">Age 5</div>
                </div>
                <div className="rounded-xl border border-white/70 bg-white/60 px-4 py-3">
                  <div className="text-sm font-medium">Child 2</div>
                  <div className="text-xs text-black/70">Age 2</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mb-12">
          <button className="h-11 rounded-xl bg-gradient-to-r from-violet-500 to-sky-400 text-white font-medium text-sm px-5 shadow-[0_10px_30px_-10px_rgba(56,189,248,0.7)] hover:opacity-90 transition">
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}


