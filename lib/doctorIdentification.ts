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
    if (role === "DOCTOR") {
      const res = await db
        .select({ id: Doctors.id })
        .from(Doctors)
        .where(eq(Doctors.userId, userId))
        .limit(1);
      if (res.length > 0) {
        doctorId = res[0].id;
        return doctorId;
      }
    }

    const assistant = await db
      .select()
      .from(Assistants)
      .where(eq(Assistants.userId, userId))
      .limit(1);
    if (assistant.length <= 0) {
      doctorId = null;
      return doctorId;
    }

    const doctor = await db
      .select()
      .from(Doctors)
      .where(eq(Doctors.assistantId, assistant[0].id))
      .limit(1);

    if (doctor.length > 0) {
      doctorId = doctor[0].id;
    }
  } catch (error) {
    console.error("Error fetching doctor identification:", error);
    doctorId = null;
  }

  return doctorId;
}
