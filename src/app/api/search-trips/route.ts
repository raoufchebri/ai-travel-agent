import { findCity, findAirportForCity, searchFlights, summarizeFlights } from "@/lib/amadeus";
import { generateText, Tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const data = await request.json().catch(() => ({}));
    const { name, destination, budget, startDate, endDate, origin, messages } = (data ?? {}) as {
      name?: string;
      destination?: string;
      budget?: number | null;
      startDate?: string; // YYYY-MM-DD
      endDate?: string; // YYYY-MM-DD
      origin?: string; // city or airport code (optional)
      messages?: Array<{ role: "user" | "assistant" | "system"; content: string }>;
    };

    // Define the tool that the model can call to actually run the search
    const runTripSearchParams = z.object({
      name: z.string().optional().describe("Trip name"),
      destination: z.string().describe("City or airport code for destination"),
      origin: z.string().describe("City or airport code for origin"),
      startDate: z.string().describe("Departure date YYYY-MM-DD"),
      endDate: z.string().optional().describe("Return date YYYY-MM-DD (optional)"),
      budget: z.number().optional().nullable().describe("Budget in USD (optional)"),
    });

    const runTripSearch: Tool = {
      description: "Run Amadeus searches and summarize flights. Requires origin, destination, and departure date.",
      inputSchema: runTripSearchParams,
      execute: async (args: any) => {
        const tripName = typeof args?.name === "string" ? args.name : undefined;
        const destText = String(args?.destination || "").trim();
        const originText = String(args?.origin || "").trim();
        const depart = String(args?.startDate || "").trim();
        const ret = typeof args?.endDate === "string" ? args.endDate : undefined;
        const budgetVal = typeof args?.budget === "number" ? args.budget : undefined;

        if (!destText || !originText || !depart) {
          return "Missing required fields to search (destination, origin, startDate).";
        }

        let cityCode: string | null = null;
        let destinationAirport: string | null = null;
        try {
          const city = await findCity(destText);
          cityCode = city?.cityCode ?? null;
        } catch {}
        try {
          destinationAirport = await findAirportForCity(destText);
        } catch {}

        let originCode: string | null = null;
        try {
          originCode = await findAirportForCity(originText);
        } catch {}

        let flightError: string | null = null;
        const destForFlights = destinationAirport || cityCode || null;

        const flights = originCode && destForFlights && depart
          ? await searchFlights({
              originLocationCode: originCode,
              destinationLocationCode: destForFlights,
              departureDate: depart,
              returnDate: ret,
              adults: 1,
            }).catch((e) => { flightError = String(e?.message || e); return []; })
          : [];

        const flightsSummary = summarizeFlights(flights);

        const parts = [
          tripName ? `Trip: ${tripName}` : null,
          `Destination: ${destText}${cityCode ? ` (${cityCode})` : ""}`,
          `Origin: ${originText}${originCode ? ` (${originCode})` : ""}`,
          depart ? `Dates: ${depart}${ret ? ` → ${ret}` : ""}` : null,
          typeof budgetVal === "number" ? `Budget: $${budgetVal}` : null,
          flightsSummary ? `Flights: ${flightsSummary}` : null,
          (!flights?.length)
            ? `Resolved codes — origin: ${originCode ?? "n/a"}, destinationAirport: ${destinationAirport ?? "n/a"}, city: ${cityCode ?? "n/a"}`
            : null,
          `Amadeus base: ${process.env.AMADEUS_BASE_URL?.trim() || (process.env.AMADEUS_ENV === "sandbox" ? "https://test.api.amadeus.com" : "https://api.amadeus.com")}`,
          flightError ? `Flights error: ${flightError}` : null,
          (!flights?.length)
            ? "Note: Amadeus sandbox data is limited. Try major origins (JFK/LHR) or closer dates."
            : null,
        ].filter(Boolean);

        return parts.join("\n");
      },
    };

    // Build the conversation for the model, seeding with any provided history
    const history = Array.isArray(messages)
      ? messages.filter((m) => m && typeof m.role === "string" && typeof m.content === "string")
      : [];

    const seedUser = [
      name ? `Trip name: ${name}` : null,
      destination ? `Destination: ${destination}` : null,
      typeof budget === "number" ? `Budget: $${budget}` : null,
      origin ? `Origin: ${origin}` : null,
      startDate ? `Start date: ${startDate}` : null,
      endDate ? `End date: ${endDate}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const systemPrompt =
      "You are a travel planning assistant. Use the provided history and current details. If you have enough information (destination, origin, and a departure date), call the runTripSearch tool to perform the search and then return a concise summary. If information is missing, ask up to 3 concise questions to fill the gaps. Keep replies short (<= 120 words).";

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        seedUser ? { role: "user", content: seedUser } : undefined,
      ].filter(Boolean) as Array<{ role: "system" | "user" | "assistant"; content: string }>,
      tools: { runTripSearch },
      toolChoice: "auto",
      temperature: 0.2,
      maxOutputTokens: 400,
      experimental_telemetry: { isEnabled: false },
    });

    return new Response(text || "No results.", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  } catch (e) {
    console.error("/api/search-trips error", e);
    return new Response("Failed to search trips", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}


