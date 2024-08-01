import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle";
import { Sessions, Users } from "../db/schemas";
import { db } from "../db/db";
import { Lucia } from "lucia";
import { TimeSpan } from "lucia";

export function initializeLucia() {
  const adapter = new DrizzlePostgreSQLAdapter(db, Sessions, Users);

  return new Lucia(adapter, {
    sessionExpiresIn: new TimeSpan(5000, "m"),
    sessionCookie: {
      expires: true,
    },
    getUserAttributes: (attributes) => {
      return {
        email: attributes.email,
        role: attributes.role,
        id: attributes.id,
      };
    },
  });
}

declare module "lucia" {
  interface Register {
    Lucia: ReturnType<typeof initializeLucia>;
    DatabaseUserAttributes: DatabaseUserAttributes;
  }
}

interface DatabaseUserAttributes {
  email: string;
  id: string;
  role: string;
}
