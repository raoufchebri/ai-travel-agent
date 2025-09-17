import TravelWidget from "../components/TravelWidget";
import SearchBar from "../components/SearchBar";
import ProposedTrips from "../components/ProposedTrips";
import ProposedTripsModal from "../components/ProposedTripsModal";
import { db } from "@/db/client";
import { bookings, potentialTrips } from "@/db/schema";
import { and, desc, eq, like } from "drizzle-orm";

export default async function Home() {
  const proposedTrips = await db
    .select({ id: potentialTrips.id, name: potentialTrips.name, destination: potentialTrips.destination, budget: potentialTrips.budget })
    .from(potentialTrips)
    .where(and(eq(potentialTrips.isBooked, false), like(potentialTrips.source, "email:%")))
    .orderBy(desc(potentialTrips.createdAt))
    .limit(3);

  const allBookings = await db
    .select({
      id: bookings.id,
      destinationCity: bookings.destinationCity,
      destinationCode: bookings.destinationCode,
      departAt: bookings.departAt,
      arriveAt: bookings.arriveAt,
      imageUrl: bookings.imageUrl,
    })
    .from(bookings)
    .orderBy(desc(bookings.createdAt))
    ;

  function toDateOnly(value: Date | string): string {
    const d = new Date(value);
    if (isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return (
    <div className="font-sans min-h-screen relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#DBE1ED_0%,#E9EFF9_100%)]" />
        <div className="absolute top-0 left-0 right-0 h-[60vh] bg-center bg-no-repeat bg-[length:100%]" style={{ backgroundImage: "url('https://plus.unsplash.com/premium_photo-1661962432490-6188a6420a81?q=80&w=1740&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')" }} />
        <div className="absolute top-0 left-0 right-0 h-[60vh] bg-[linear-gradient(180deg,rgba(255,255,255,0)_70%,#E9EFF9_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(1000px_600px_at_20%_15%,rgba(255,255,255,0.65),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_520px_at_85%_85%,rgba(99,102,241,0.12),transparent_60%)]" />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px)", backgroundSize: "3px 3px" }} />
      </div>
      <section className="relative min-h-[50vh] mb-6 sm:mb-8" id="destinations">
        <div className="absolute inset-0 z-10 pointer-events-none bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.06)_12%,rgba(255,255,255,0.02)_70%,rgba(255,255,255,0)_100%)]" />
        <div className="w-full mx-auto max-w-6xl px-4 sm:px-6 pt-6 sm:pt-8 flex flex-col justify-end h-full relative z-20">
          
          <div className="mt-12 sm:mt-16 md:mt-60">
            <h1 className="px-1 mb-3 text-xs tracking-[0.18em] font-bold text-white">
              FIND YOUR TRIP
            </h1>
            <SearchBar />
          </div>
        </div>
      </section>
      <main className="w-full mx-auto max-w-6xl px-4 sm:px-6 -mt-30">
        <section className="mb-6 sm:mb-8" id="deals">
          <h2 className="px-1 mb-3 text-xs tracking-[0.18em] font-bold text-white">
            TRIPS FOR YOU AND YOUR FAMILY
          </h2>
          <div className="w-full max-w-[420px]">
            <TravelWidget
              className="h-full"
              readOnly
              transparent
              backgroundImageUrl="https://images.unsplash.com/photo-1590144662036-33bf0ebd2c7f?q=80&w=1548&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
              weatherTempF={78}
              weatherSummary="Sunny"
              humidityPct={45}
              windMph={6}
              trip={{
                destination: "Disneyland, Anaheim",
                startDate: "2025-10-12",
                endDate: "2025-10-19",
                guests: 4,
              }}
            />
          </div>
        </section>
        {/* Proposed Trips section is hidden; shown via modal (Cmd+K or button) */}
        {/* <section className="mb-6 sm:mb-8">
          <h2 className="px-1 mb-3 text-xs tracking-[0.18em] font-semibold bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
            PROPOSED TRIPS
          </h2>
          <ProposedTrips trips={proposedTrips} />
        </section> */}
        <section className="mb-6 sm:mb-8" id="about">
          <h2 className="px-1 mb-3 text-xs tracking-[0.18em] font-semibold bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
            YOUR TRIPS
          </h2>
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
            {allBookings.map((b) => (
              <div key={b.id} className="mb-4 break-inside-avoid transition-transform duration-200 ease-out hover:-translate-y-0.5" style={{ breakInside: "avoid" }}>
                <div className="w-full max-w-[420px]">
                  <TravelWidget
                    className="h-full"
                    readOnly
                    transparent
                    backgroundImageUrl={b.imageUrl || undefined}
                    weatherTempF={72}
                    weatherSummary="Sunny"
                    humidityPct={50}
                    windMph={8}
                    trip={{
                      destination: `${b.destinationCity}`,
                      startDate: toDateOnly(b.departAt),
                      endDate: toDateOnly(b.arriveAt),
                      guests: 2,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      {/* Modal overlay for Proposed Trips */}
      <ProposedTripsModal trips={proposedTrips} />
      <footer />
    </div>
  );
}
