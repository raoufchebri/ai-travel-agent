import { db } from "@/db/client";
import { potentialTrips } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: potentialTrips.id,
        destination: potentialTrips.destination,
        startDate: potentialTrips.startDate,
        endDate: potentialTrips.endDate,
        createdAt: potentialTrips.createdAt,
      })
      .from(potentialTrips)
      .where(and(eq(potentialTrips.isBooked, false), eq(potentialTrips.source, "search")))
      .orderBy(desc(potentialTrips.createdAt))
      .limit(8);

    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Failed to load recent searches" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}


