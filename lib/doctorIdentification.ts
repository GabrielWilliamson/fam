import { eq, or } from "drizzle-orm";
import { db } from "../db/db";
import { Assistants, Doctors } from "../db/schemas";

// Retorna el ID del doctor para asistente o usuario
export default async function doctorIdentification(
  userId: string,
  role: string
): Promise<string | null> {
  let doctorId: string | null = null;

  try {
    const result = await db
      .select({ id: Doctors.id })
      .from(Doctors)
      .leftJoin(
        Assistants,
        or(eq(Doctors.userId, userId), eq(Assistants.userId, userId))
      )
      .where(or(eq(Doctors.userId, userId), eq(Assistants.userId, userId)))
      .limit(1);

    if (result.length > 0) {
      doctorId = result[0].id;
    }
  } catch (error) {
    console.error("Error fetching doctor identification:", error);
    doctorId = null;
  }

  return doctorId;
}
