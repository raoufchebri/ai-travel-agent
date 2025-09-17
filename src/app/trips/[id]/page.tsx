import { db } from "@/db/client";
import { trips } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

type PageProps = {
  params: { id: string };
};

export default async function TripPage({ params }: PageProps) {
  const idNum = Number(params.id);
  if (!Number.isFinite(idNum)) notFound();

  const [trip] = await db
    .select({ id: trips.id, name: trips.name, destination: trips.destination, budget: trips.budget, source: trips.source, createdAt: trips.createdAt })
    .from(trips)
    .where(eq(trips.id, idNum))
    .limit(1);

  if (!trip) notFound();

  return (
    <div className="min-h-screen w-full">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[#DBE1ED]" />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
        <div className="rounded-[26px] p-[2px] bg-transparent shadow-[0_25px_80px_-30px_rgba(0,0,0,0.2)]">
          <div className="relative rounded-[24px] border-4 border-white/95 backdrop-blur-2xl text-white overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/10 to-white/0 pointer-events-none" />
            <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs tracking-[0.18em] font-semibold bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
                  TRIP DETAILS
                </div>
                <div className="text-lg" aria-hidden>🛫</div>
              </div>

              <h1 className="text-2xl font-semibold tracking-wide uppercase">{trip.destination.toUpperCase()}</h1>
              <div className="mt-2 text-sm text-white/80">{trip.name}</div>
              <div className="mt-4 text-sm text-white/80">
                {typeof trip.budget === "number" ? `Budget: $${trip.budget}` : "Flexible budget"}
              </div>
              <div className="mt-1 text-xs text-white/70">Source: {trip.source}</div>

              <div className="mt-6 flex gap-3">
                <button className="rounded-xl border border-white/40 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">Start Booking</button>
                <Link href="/" className="rounded-xl border border-white/40 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">Back</Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}


