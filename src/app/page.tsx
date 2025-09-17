import TravelWidget from "../components/TravelWidget";
import SearchBar from "../components/SearchBar";
import ProposedTrips from "../components/ProposedTrips";
import ProposedTripsModal from "../components/ProposedTripsModal";
import { db } from "@/db/client";
import { trips } from "@/db/schema";
import { desc } from "drizzle-orm";

export default async function Home() {
  const proposedTrips = await db
    .select({ id: trips.id, name: trips.name, destination: trips.destination, budget: trips.budget })
    .from(trips)
    .orderBy(desc(trips.createdAt))
    .limit(3);
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
        {/* Proposed Trips section is hidden; shown via modal (Cmd+K or button) */}
        {/* <section className="mb-6 sm:mb-8">
          <h2 className="px-1 mb-3 text-xs tracking-[0.18em] font-semibold bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
            PROPOSED TRIPS
          </h2>
          <ProposedTrips trips={proposedTrips} />
        </section> */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-7">
          <div className="flex flex-col gap-4 sm:gap-6">
            <div className="aspect-square">
              <div className="w-full max-w-[420px]">
                <TravelWidget
                  className="h-full"
                  readOnly
                  transparent
                  weatherTempF={64}
                  weatherSummary="Clear Skies"
                  humidityPct={55}
                  windMph={6}
                  trip={{
                    destination: "Lisbon, Portugal",
                    startDate: "2026-05-10",
                    endDate: "2026-05-16",
                    guests: 2,
                  }}
                />
              </div>
            </div>
            <div className="aspect-square">
              <div className="w-full max-w-[420px]">
                <TravelWidget
                  readOnly
                  transparent
                  weatherTempF={72}
                  weatherSummary="Sunny"
                  humidityPct={40}
                  windMph={8}
                  trip={{
                    destination: "Kyoto, Japan",
                    startDate: "2026-10-02",
                    endDate: "2026-10-09",
                    guests: 2,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="lg:row-span-2">
            <div className="w-full h-full max-w-[420px] lg:h-[540px]">
              <h2 className="px-1 mb-3 text-xs tracking-[0.18em] font-semibold bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
                NEXT ADVENTURE
              </h2>
              <TravelWidget
                className="h-full"
                readOnly
                transparent
                weatherTempF={78}
                weatherSummary="Partly Sunny"
                humidityPct={65}
                windMph={10}
                trip={{
                  destination: "Miami, Florida",
                  startDate: "2026-04-20",
                  endDate: "2026-04-26",
                  guests: 2,
                }}
              />
            </div>
          </div>
        </div>
      </main>
      {/* Modal overlay for Proposed Trips */}
      <ProposedTripsModal trips={proposedTrips} />
      <footer />
    </div>
  );
}
