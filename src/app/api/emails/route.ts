import { db } from "@/db/client";
import { emails, potentialTrips } from "@/db/schema";
import { and, count, desc, gt, eq, like } from "drizzle-orm";
import { streamText, generateText, Tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { z } from "zod";

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

const createTripParams = z.object({
	name: z.string().describe("Short human-friendly name of the trip"),
	destination: z.string().describe("City and/or country destination"),
	budget: z.number().int().optional().describe("Estimated budget in whole currency units"),
	startDate: z
		.string()
		.optional()
		.describe("Trip start date in ISO 8601 format (YYYY-MM-DD) if known"),
	endDate: z
		.string()
		.optional()
		.describe("Trip end date in ISO 8601 format (YYYY-MM-DD) if known"),
	source: z.string().describe("Source of the trip record, e.g., email:<id>"),
});
type CreateTripArgs = z.infer<typeof createTripParams>;

const createTripTool: Tool = {
	description: "Create a trip if the email discusses travel",
	inputSchema: createTripParams,
	execute: async ({ name, destination, budget, source, startDate, endDate }: CreateTripArgs) => {
		const parsedStartDate = typeof startDate === "string" ? new Date(startDate) : undefined;
		const parsedEndDate = typeof endDate === "string" ? new Date(endDate) : undefined;

    const [trip] = await db
      .insert(potentialTrips)
			.values({
				name,
				destination,
				budget: typeof budget === "number" ? Math.trunc(budget) : undefined,
				source,
				startDate: parsedStartDate,
				endDate: parsedEndDate,
			})
      .returning({ id: potentialTrips.id });
		return {
			id: trip.id,
			startDate: typeof startDate === "string" ? startDate : undefined,
			endDate: typeof endDate === "string" ? endDate : undefined,
		};
	},
};

export async function GET(request: Request) {
	try {
		const url = new URL(request.url);
		const searchParams = url.searchParams;

		// Optional intent to adjust summarization prompt
		const intentParam = searchParams.get("intent");
		// Optional personalization
		const firstNameRaw = searchParams.get("firstName");
		const firstName = firstNameRaw && firstNameRaw.trim().length > 0 ? firstNameRaw.trim() : null;

		const sinceParam = searchParams.get("since");
		const afterIdParam = searchParams.get("afterId");

		const streamParam = searchParams.get("stream");
		const enableStream = streamParam === "1" || streamParam === "true";
		const summaryParam = searchParams.get("summary");
		const shouldSummarizeNonStream = summaryParam !== "false";

		const whereClauses = [] as Array<ReturnType<typeof and>> | any[];

		// Only consider potential trips that are unbooked and originated from emails
		whereClauses.push(eq(potentialTrips.isBooked, false));
		whereClauses.push(like(potentialTrips.source, "email:%"));

		if (sinceParam) {
			const sinceDate = new Date(sinceParam);
			if (Number.isNaN(sinceDate.getTime())) {
				return new Response(
					JSON.stringify({ error: "Invalid 'since' timestamp" }),
					{ status: 400, headers: { "content-type": "application/json" } }
				);
			}
      whereClauses.push(gt(potentialTrips.createdAt, sinceDate));
		}

		if (afterIdParam) {
			const afterId = Number(afterIdParam);
			if (!Number.isFinite(afterId)) {
				return new Response(
					JSON.stringify({ error: "Invalid 'afterId' number" }),
					{ status: 400, headers: { "content-type": "application/json" } }
				);
			}
      whereClauses.push(gt(potentialTrips.id, afterId));
		}

		const compoundWhere =
			whereClauses.length === 0
				? undefined
				: whereClauses.length === 1
					? whereClauses[0]
					: and(...whereClauses);

    let countQuery = db.select({ value: count() }).from(potentialTrips);
		if (compoundWhere) {
			// @ts-expect-error drizzle types don't like undefined in where
			countQuery = countQuery.where(compoundWhere);
		}
		const result = await countQuery;

		const total = result[0]?.value ?? 0;

		let summary: string | null = null;
		if (total > 0) {
			try {
        const latest = await db
          .select({ id: potentialTrips.id, destination: potentialTrips.destination, name: potentialTrips.name, budget: potentialTrips.budget })
          .from(potentialTrips)
					.where(compoundWhere)
          .orderBy(desc(potentialTrips.createdAt))
					.limit(1);

				const trip = latest[0];
				if (trip) {
					const isProposedTripsIntent = intentParam === "proposedTrips";
					const instruction = isProposedTripsIntent
						? "You write one short, friendly CTA (<= 20 words) about detected trips from emails. If a first name is provided, address the user by that first name. Tell the user they can press Enter (↩) to see the trips."
						: "You summarize trips for brief user notifications. Answer in one short sentence (<= 20 words).";
					const userPrefix = firstName ? `${firstName}, ` : "";
					const prompt = isProposedTripsIntent
						? `${instruction}\n${userPrefix}we detected ${total} trip(s) from recent emails, e.g. ${trip.destination}. Ask if they want to book them.`
						: `${instruction}\nTrip: ${trip.name}\nDestination: ${trip.destination}\nBudget: ${trip.budget ?? "n/a"}`;

					if (enableStream) {
						const result = await streamText({
							model: openai("gpt-4o-mini"),
							temperature: 0.2,
							prompt,
						});
						return result.toTextStreamResponse();
					}

					if (shouldSummarizeNonStream) {
						const { text } = await generateText({
							model: openai("gpt-4o-mini"),
							temperature: 0.2,
							prompt,
						});
						summary = text;
					}
				}
			} catch (e) {
				// Ignore summarization errors; still return count
			}
		}

		return new Response(
			JSON.stringify({ hasNew: total > 0, count: Number(total), summary }),
			{ status: 200, headers: { "content-type": "application/json" } }
		);
	} catch (error) {
		console.error("/api/emails GET error", error);
		return new Response(
			JSON.stringify({ error: "Internal Server Error" }),
			{ status: 500, headers: { "content-type": "application/json" } }
		);
	}
}

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const {
			subject,
			body: content,
			senderEmail,
			recipientEmail,
			folder,
			isRead,
			sentAt,
		} = body ?? {};

		const errors: string[] = [];
		if (!subject || typeof subject !== "string") errors.push("subject is required");
		if (!content || typeof content !== "string") errors.push("body is required");
		if (!senderEmail || typeof senderEmail !== "string") errors.push("senderEmail is required");
		if (!recipientEmail || typeof recipientEmail !== "string") errors.push("recipientEmail is required");

		if (errors.length > 0) {
			return NextResponse.json({ errors }, { status: 400 });
		}

		const [inserted] = await db
			.insert(emails)
			.values({
				subject,
				body: content,
				senderEmail,
				recipientEmail,
				folder: typeof folder === "string" && folder.length > 0 ? folder : "inbox",
				isRead: typeof isRead === "boolean" ? isRead : false,
				sentAt: sentAt ? new Date(sentAt) : undefined,
			})
			.returning();

		// Use AI to detect travel intent and optionally create a trip
		try {
			await generateText({
				model: openai("gpt-4o-mini"),
				messages: [
					{
						role: "system",
						content:
							"You extract structured travel plans from emails. If and only if the email clearly involves travel (trip, flight, hotel, conference travel, vacation, business trip), call the tool with best-guess values. If date(s) are present, include startDate and endDate in ISO 8601 (YYYY-MM-DD). If not, omit them. If not travel, do not call the tool.",
					},
					{
						role: "user",
						content: `Subject: ${subject}\nFrom: ${senderEmail}\nTo: ${recipientEmail}\nBody: ${content}`,
					},
				],
				tools: {
					createTrip: createTripTool,
				},
				// Provide reasonable defaults if the model chooses to call the tool
				toolChoice: "auto",
				experimental_telemetry: { isEnabled: false },
				// Seed fields for the tool in case the model needs context
				maxOutputTokens: 300,
				temperature: 0.2,
				// Supply a default source to help the tool populate it accurately
				// The model should overwrite this on call, but we provide it for clarity
			});
		} catch (e) {
			// AI is best-effort; ignore errors to not block email creation
		}

		return NextResponse.json(inserted, { status: 201 });
	} catch (error) {
		return NextResponse.json({ error: "Failed to insert email" }, { status: 500 });
	}
}