import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { authVariables } from "../types/auth";
import { db } from "../db/db";
import { eq } from "drizzle-orm";
import { changeSchema, userSchema } from "../schemas/usersSchema";
import hashPassword from "../lib/hash";
import { sendVerificationEmail } from "../lib/email";
import { Users, Doctors, Assistants } from "../db/schemas";
import type { usersTable } from "../types/users";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { generateEmailVerificationToken } from "../lib/hash";

const name = z.object({ name: userSchema.shape.name });
const email = z.object({ email: userSchema.shape.email });
const password = z
  .object({
    old: userSchema.shape.password,
    new: userSchema.shape.password,
    confirmPass: userSchema.shape.password,
  })
  .refine((data) => data.new === data.confirmPass, {
    message: "Las claves no coinciden",
    path: ["confirmPass"],
  })
  .refine((data) => data.old != data.new, {
    message: "La clave nueva no puede ser igual a la actual",
    path: ["new"],
  });

export const usersRoute = new Hono<{ Variables: authVariables }>()

  .post("/register", zValidator("json", userSchema), async (c) => {
    const myuser = c.get("user");
    if (!myuser) return c.json({ success: false, error: "No autorizado" }, 401);
    if (myuser.role !== "ADMIN")
      return c.json({ success: false, error: "No autorizado" }, 401);

    const data = c.req.valid("json");

    try {
      const isEmailExists = await db
        .select()
        .from(Users)
        .where(eq(Users.email, data.email));

      if (isEmailExists.length > 0)
        return c.json({ success: false, error: "Este email ya existe" });

      const hashed = await hashPassword(data.password);
      const verificationToken = generateEmailVerificationToken();

      const user = await db
        .insert(Users)
        .values({
          name: data.name,
          role: data.rol,
          email: data.email,
          password: hashed,
          emailVerifToken: verificationToken,
        })
        .returning({ role: Users.role, id: Users.id, email: Users.email });

      if (user[0].role === "DOCTOR") {
        const re = await db
          .insert(Doctors)
          .values({
            userId: user[0].id,
          })
          .returning({ id: Doctors.id });
      }

      //create bucket

      if (user[0].role === "ASSISTANT") {
        await db.insert(Assistants).values({
          userId: user[0].id,
        });
      }

      try {
        await sendVerificationEmail(user[0].email, verificationToken);
      } catch (e) {
        console.log("Error al enviar el email");
        return c.json({
          success: false,
          error:
            "Ocurrió un error al enviar el email, solicite ayuda al administrador",
        });
      }

      return c.json({ success: true, error: "Usuario Creado Correctamente" });
    } catch (error) {
      console.log("Error al registrar el usuario");
      return c.json({ success: false, error: "Error al registrar el usuario" });
    }
  })

  .get("/", async (c) => {
    const myuser = c.get("user");
    if (!myuser) return c.json({ list: null }, 401);
    if (myuser.role !== "ADMIN") return c.json({ list: null }, 401);

    const list = await db.query.Users.findMany({
      columns: {
        id: true,
        name: true,
        email: true,
        status: true,
        emailVerifiedAt: true,
        role: true,
        image: true,
      },
    });

    return c.json({ list: list as usersTable[] });
  })

  .patch("/change", zValidator("json", changeSchema), async (c) => {
    const myuser = c.get("user");
    if (!myuser) return c.json({ success: false, error: "No autorizado" }, 401);
    if (myuser.role !== "ADMIN")
      return c.json({ success: false, error: "No autorizado" }, 401);

    const data = c.req.valid("json");

    try {
      const user = await db.query.Users.findFirst({
        where: eq(Users.id, data.id),
      });

      if (!user)
        return c.json({ success: false, error: "Usuario no encontrado" }, 401);

      if (user?.role === "ADMIN") {
        return c.json({
          success: false,
          error:
            "No se puede bloquear un usuario con permisos de administrador",
        });
      }

      await db
        .update(Users)
        .set({ status: data.status })
        .where(eq(Users.id, data.id));

      return c.json({ success: true, error: "" });
    } catch (e) {
      console.log(e);
      return c.json({ success: false, error: "Ocurrió un error" });
    }
  })

  .patch("/name", zValidator("json", name), async (c) => {
    const myuser = c.get("user");
    if (!myuser) return c.json({ success: false }, 401);
    const data = c.req.valid("json");
    await db
      .update(Users)
      .set({ name: data.name })
      .where(eq(Users.id, myuser.id));
    return c.json({ success: true });
  })

  .patch("/email", zValidator("json", email), async (c) => {
    const myuser = c.get("user");
    if (!myuser) return c.json({ success: false }, 401);
    const data = c.req.valid("json");

    const verificationToken = generateEmailVerificationToken();
    await db
      .update(Users)
      .set({
        email: data.email,
        emailVerifiedAt: null,
        emailVerifToken: verificationToken,
      })
      .where(eq(Users.id, myuser.id));

    try {
      await sendVerificationEmail(data.email, verificationToken);
    } catch (e) {
      return c.json({
        success: false,
        error:
          "Ocurrió un error al enviar el email, solicite ayuda al administrador",
      });
    }
    return c.json({ success: true });
  })

  .patch("/pass", zValidator("json", password), async (c) => {
    const myuser = c.get("user");
    if (!myuser)
      return c.json({ success: false, error: "No autenticado" }, 401);
    const data = c.req.valid("json");

    const user = await db
      .select({ password: Users.password })
      .from(Users)
      .where(eq(Users.id, myuser.id));

    const passwordsMatch = await bcrypt.compare(data.old, user[0].password);
    if (!passwordsMatch) {
      return c.json({ success: false, error: "old error" });
    }

    const hashed = await hashPassword(data.new);

    await db
      .update(Users)
      .set({ password: hashed })
      .where(eq(Users.id, myuser.id));

    return c.json({ success: true, error: null });
  });
