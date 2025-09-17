import { pgTable, text, timestamp, boolean, serial, integer } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	createdAt: timestamp("created_at", { withTimezone: false })
		.defaultNow()
		.notNull(),
});

export type SelectUser = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;


export const emails = pgTable("emails", {
	id: serial("id").primaryKey(),
	subject: text("subject").notNull(),
	body: text("body").notNull(),
	senderEmail: text("sender_email").notNull(),
	recipientEmail: text("recipient_email").notNull(),
	isRead: boolean("is_read").notNull().default(false),
	folder: text("folder").notNull().default("inbox"),
	sentAt: timestamp("sent_at", { withTimezone: false })
		.defaultNow()
		.notNull(),
});

export const trips = pgTable("trips", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	destination: text("destination").notNull(),
	origin: text("origin"),
	budget: integer("budget"),
    source: text("source").notNull(),
	startDate: timestamp("start_date", { withTimezone: false }),
	endDate: timestamp("end_date", { withTimezone: false }),
	createdAt: timestamp("created_at", { withTimezone: false })
		.defaultNow()
		.notNull(),
});

export type SelectEmail = typeof emails.$inferSelect;
export type InsertEmail = typeof emails.$inferInsert;



// Potential trips table (mirrors migrations creating potential_trips)
export const potentialTrips = pgTable("potential_trips", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	destination: text("destination").notNull(),
	origin: text("origin"),
	budget: integer("budget"),
	source: text("source").notNull(),
	startDate: timestamp("start_date", { withTimezone: false }),
	endDate: timestamp("end_date", { withTimezone: false }),
	isBooked: boolean("is_booked").notNull().default(false),
	createdAt: timestamp("created_at", { withTimezone: false }).defaultNow().notNull(),
});

export type SelectPotentialTrip = typeof potentialTrips.$inferSelect;
export type InsertPotentialTrip = typeof potentialTrips.$inferInsert;

// Bookings table
export const bookings = pgTable("bookings", {
	id: serial("id").primaryKey(),
	tripId: integer("trip_id").notNull(),
	carrier: text("carrier").notNull(),
	flightNumber: text("flight_number").notNull(),
	originCity: text("origin_city").notNull(),
	originCode: text("origin_code").notNull(),
	originAirportName: text("origin_airport_name").notNull(),
	destinationCity: text("destination_city").notNull(),
	destinationCode: text("destination_code").notNull(),
	destinationAirportName: text("destination_airport_name").notNull(),
	departAt: timestamp("depart_at", { withTimezone: false }).notNull(),
	arriveAt: timestamp("arrive_at", { withTimezone: false }).notNull(),
	price: integer("price").notNull(),
	currency: text("currency").notNull().default("USD"),
	imageUrl: text("image_url"),
	createdAt: timestamp("created_at", { withTimezone: false }).defaultNow().notNull(),
});

export type SelectBooking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;

export const userProfiles = pgTable("user_profiles", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	location: text("location"),
	adultCompanions: integer("adult_companions").notNull().default(0),
	kidsCompanionAges: integer("kids_companion_ages").array(),
	budgetPerPerson: integer("budget_per_person"),
	createdAt: timestamp("created_at", { withTimezone: false })
		.defaultNow()
		.notNull(),
});

export type SelectUserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;
