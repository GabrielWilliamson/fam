import { Hono } from "hono";
import { cors } from "hono/cors";
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
  queriesRoute,
  fileRoute,
  prescriptionsRoute,
  mediaRoute,
  servicesRoute,
  helpsRoute,
  pdfRoute,
  dataRoute,
  chartsRoute,
  flowsRoute,
} = route;

import dotenv from "dotenv";
import { serveStatic } from "hono/bun";

dotenv.config();

const app = new Hono<{ Variables: authVariables }>();

app.use("*", authMiddleware);

app.use("/api/*", logger());

const routes = app
  .basePath("/api")
  .route("/helps", helpsRoute)
  .route("/drugs", drugsRoute)
  .route("/auth", authRoute)
  .route("/users", usersRoute)
  .route("/doctors", doctorRoute)
  .route("/patients", patientsRoute)
  .route("/locations", locationsRoute)
  .route("/dates", datesRoute)
  .route("/file", fileRoute)
  .route("/queries", queriesRoute)
  .route("/prescriptions", prescriptionsRoute)
  .route("/media", mediaRoute)
  .route("/services", servicesRoute)
  .route("/pdf", pdfRoute)
  .route("/charts", chartsRoute)
  .route("/flows", flowsRoute)
  .route("/data", dataRoute);

app.get("*", serveStatic({ root: "./static" }));
app.get("*", serveStatic({ path: "./static/index.html" }));

export default app;
export type typeRoutes = typeof routes;
