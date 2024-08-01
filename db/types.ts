import * as schema from "./schemas";

export type User = typeof schema.Users.$inferSelect;
export type tDates = typeof schema.Dates.$inferSelect;
