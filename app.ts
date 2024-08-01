import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { logger } from "hono/logger";
import { authMiddleware } from "./auth/midleware";
import type { authVariables } from "./types/auth";

import { route } from "./routes/index";

const {
  drugsRoute,
  usersRoute,
  doctorRoute,
  patientsRoute,
  locationsRoute,
  authRoute,
  datesRoute,
} = route;

import dotenv from "dotenv";

dotenv.config();

const app = new Hono<{ Variables: authVariables }>();

app.use("*", logger());
app.use("*", authMiddleware);

const routes = app
  .basePath("/api")
  .route("/drugs", drugsRoute)
  .route("/auth", authRoute)
  .route("/users", usersRoute)
  .route("/doctors", doctorRoute)
  .route("/patients", patientsRoute)
  .route("/locations", locationsRoute)
  .route("/dates", datesRoute);

app.get("*", serveStatic({ root: "./static" }));
app.get("*", serveStatic({ path: "./static/index.html" }));

export default app;
export type typeRoutes = typeof routes;
