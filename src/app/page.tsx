import TravelWidget from "../components/TravelWidget";
import SearchBar from "../components/SearchBar";
import ProposedTrips from "../components/ProposedTrips";
import ProposedTripsModal from "../components/ProposedTripsModal";
import { db } from "@/db/client";
import { bookings, potentialTrips } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

export default async function Home() {
  const proposedTrips = await db
    .select({ id: potentialTrips.id, name: potentialTrips.name, destination: potentialTrips.destination, budget: potentialTrips.budget })
    .from(potentialTrips)
    .where(and(eq(potentialTrips.isBooked, false), eq(potentialTrips.source, "email")))
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
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[#DBE1ED]" />
      <div className="w-full mx-auto max-w-6xl px-4 sm:px-6 mt-4 sm:mt-6 mb-6 sm:mb-8">
        <h1 className="px-1 mb-3 text-xs tracking-[0.18em] font-semibold bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
          FIND YOUR TRIP
        </h1>
        <SearchBar />
      </div>
      <main className="w-full mx-auto max-w-6xl px-4 sm:px-6">
        <section className="mb-6 sm:mb-8">
          <h2 className="px-1 mb-3 text-xs tracking-[0.18em] font-semibold bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
            TRIPS FOR YOU AND YOUR FAMILY
          </h2>
          <div className="w-full max-w-[420px]">
            <TravelWidget
              className="h-full"
              readOnly
              transparent
              backgroundImageUrl="https://images.unsplash.com/photo-1553210262-46d1cd74fa5c?auto=format&fit=crop&w=1800&q=80"
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
        <section className="mb-6 sm:mb-8">
          <h2 className="px-1 mb-3 text-xs tracking-[0.18em] font-semibold bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
            YOUR TRIPS
          </h2>
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
            {allBookings.map((b) => (
              <div key={b.id} className="mb-4 break-inside-avoid" style={{ breakInside: "avoid" }}>
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
