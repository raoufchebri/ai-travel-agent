import { db } from "@/db/client";
import { potentialTrips } from "@/db/schema";
import { and, desc, eq, like } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const limit = Math.max(1, Math.min(20, Number(limitParam) || 6));

    const rows = await db
      .select({ id: potentialTrips.id, name: potentialTrips.name, destination: potentialTrips.destination, budget: potentialTrips.budget })
      .from(potentialTrips)
      .where(and(eq(potentialTrips.isBooked, false), like(potentialTrips.source, "email:%")))
      .orderBy(desc(potentialTrips.createdAt))
      .limit(limit);

    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Failed to load email trips" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}


