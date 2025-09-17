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
