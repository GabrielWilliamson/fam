import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { authVariables } from "../types/auth";
import {
  loginSchema,
  resetSchema,
  sendEmailForgotSchema,
  verifySchema,
} from "../schemas/authSchema";
import { db } from "../db/db";
import bcrypt from "bcryptjs";
import { setCookie, deleteCookie } from "hono/cookie";
import { Assistants, Doctors, Users } from "../db/schemas";
import { type userReturning } from "../types/auth";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { initializeLucia } from "../auth/lucia";
import { eq } from "drizzle-orm";
import hashPassword, { generateEmailVerificationToken } from "../lib/hash";
import { sendForgotEmail } from "../lib/email";

dotenv.config();

export const authRoute = new Hono<{ Variables: authVariables }>()
  // Ruta de inicio de sesión
  .post("/", zValidator("json", loginSchema), async (c) => {
    const data = c.req.valid("json");

    const user = await db.query.Users.findFirst({
      where: (users, { eq }) => eq(users.email, data.email),
    });

    if (!user) {
      return c.json({
        success: false,
        error: "Credenciales incorrectas",
        role: null,
      });
    }

    if (!user.emailVerifiedAt) {
      return c.json({
        success: false,
        error: "Verificación de correo pendiente",
        role: null,
      });
    }

    if (!user.status) {
      return c.json({ success: false, error: "Acceso denegado", role: null });
    }

    const passwordsMatch = await bcrypt.compare(data.password, user.password);

    if (!passwordsMatch) {
      return c.json({
        success: false,
        error: "Credenciales incorrectas",
        role: null,
      });
    }

    if (!initializeLucia) {
      return c.json({
        success: false,
        error: "Error de inicialización",
        role: null,
      });
    }

    const lucia = initializeLucia();
    const session = await lucia.createSession(user.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);

    setCookie(
      c,
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes,
    );
    return c.json({ success: true, error: "", role: user.role });
  })

  // Ruta para verificar el usuario
  .get("/verify", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false }, 401);

    //buscar como user normal
    const findUser = await db
      .select({
        id: Users.id,
        role: Users.role,
        name: Users.name,
        email: Users.email,
      })
      .from(Users)
      .where(eq(Users.id, user.id));

    if (findUser.length <= 0) return c.json({ success: false }, 401);

    const userFind = findUser[0];
    //admin
    if (findUser[0].role === "ADMIN") {
      const data: userReturning = {
        id: userFind.id,
        name: userFind.name,
        email: userFind.email,
        role: userFind.role,
        doctor: null,
        assistant: null,
      };
      return c.json({ success: true, data });
    }

    //doctor
    if (findUser[0].role === "DOCTOR") {
      const doctor = await db
        .select({ id: Doctors.id, specialtie: Doctors.specialtie })
        .from(Doctors)
        .where(eq(Doctors.userId, userFind.id));

      const data: userReturning = {
        id: userFind.id,
        name: userFind.name,
        email: userFind.email,
        role: userFind.role,
        doctor: {
          id: doctor[0].id,
          specialtie: doctor[0].specialtie,
        },
        assistant: null,
      };
      return c.json({ success: true, data });
    }

    //asissant
    if (findUser[0].role === "ASSISTANT") {
      const assistantInfo = await db
        .select({
          id: Assistants.id,
        })
        .from(Assistants)
        .where(eq(Assistants.userId, userFind.id));

      if (assistantInfo.length <= 0) return c.json({ success: false }, 401);

      const doctor = await db
        .select({
          specialite: Doctors.specialtie,
        })
        .from(Doctors)
        .where(eq(Doctors.assistantId, assistantInfo[0].id));

      if (doctor.length <= 0) return c.json({ success: false }, 401);

      const data: userReturning = {
        id: userFind.id,
        name: userFind.name,
        email: userFind.email,
        role: userFind.role,
        doctor: null,
        assistant: {
          id: assistantInfo[0].id,
          specialtie: doctor[0].specialite,
        },
      };
      return c.json({ success: true, data });
    }
  })

  // Ruta para cerrar sesión
  .get("/logout", async (c) => {
    const session = c.get("session");
    if (!session) return c.json({ success: false }, 401);

    if (!initializeLucia) {
      return c.json({ success: false, error: "Error de inicialización" });
    }

    const lucia = initializeLucia();
    lucia.invalidateSession(session.id);
    deleteCookie(c, lucia.sessionCookieName);
    return c.json({ success: true });
  })

  // Ruta para verificar el email
  .post("/verifyEmail", zValidator("json", verifySchema), async (c) => {
    const data = c.req.valid("json");

    const user = await db.query.Users.findFirst({
      where: (users, { eq }) => eq(users.email, data.email),
    });

    if (!user) return c.json({ error: "Ocurrió un error", success: false });
    if (user.emailVerifToken === null)
      return c.json({
        error: "Tu email ya ha sido verificado",
        success: false,
      });
    if (data.token !== user.emailVerifToken) {
      return c.json({ error: "Ocurrió un error", success: false });
    }

    await db
      .update(Users)
      .set({
        emailVerifiedAt: new Date(),
        emailVerifToken: null,
      })
      .where(eq(Users.id, user.id));

    return c.json({ success: true, error: "" });
  })

  //forgot passsword
  .post(
    "/sendEmailForgot",
    zValidator("json", sendEmailForgotSchema),
    async (c) => {
      const data = c.req.valid("json");
      const findUser = await db
        .select({
          id: Users.id,
          email: Users.email,
        })
        .from(Users)
        .where(eq(Users.email, data.email));

      if (findUser.length <= 0) {
        return c.json({ error: "No se encontro el correo", success: false });
      }

      const verificationToken = generateEmailVerificationToken();

      //actualizar el token en la bd
      await db
        .update(Users)
        .set({
          email: data.email,
          emailVerifiedAt: null,
          emailVerifToken: verificationToken,
        })
        .where(eq(Users.id, findUser[0].id));

      //enviar el email
      try {
        await sendForgotEmail(data.email, verificationToken);
      } catch (e) {
        return c.json({
          success: false,
          error:
            "Ocurrió un error al enviar el email, solicite ayuda al administrador",
        });
      }

      return c.json({ success: true, error: "" });
    },
  )
  .patch("/reset", zValidator("json", resetSchema), async (c) => {
    const data = c.req.valid("json");

    const user = await db.query.Users.findFirst({
      where: (users, { eq }) => eq(users.email, data.email),
    });

    if (!user) return c.json({ error: "No autorizado", success: false });

    if (user.emailVerifToken === null)
      return c.json({
        error: "No autorizado",
        success: false,
      });
    if (data.token !== user.emailVerifToken) {
      return c.json({ error: "No autorizado", success: false });
    }

    const hashed = await hashPassword(data.newPassword);

    await db
      .update(Users)
      .set({
        emailVerifiedAt: new Date(),
        password: hashed,
        emailVerifToken: null,
      })
      .where(eq(Users.id, user.id));
    return c.json({ success: true, error: "" });
  })

  //auth whatsapp serviceP
  .get("/whatsapp", async (c) => {
    const session = c.get("session");
    if (!session) return c.json({ success: false, data: null }, 401);
    const secretKey = process.env.JWT_SECRET!;
    const token = jwt.sign({ data: session }, secretKey, { expiresIn: "20m" });
    return c.json({ data: token });
  });
