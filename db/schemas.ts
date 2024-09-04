import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  json,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const UserRoles = pgEnum("userRoles", ["ADMIN", "ASSISTANT", "DOCTOR"]);
export const Specialties = pgEnum("specialties", ["PEDIATRIA", "GENERAL"]);

export const Users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerifiedAt: timestamp("emailVerifiedAt"),
  emailVerifToken: text("emailVerifToken"),
  image: text("image"),
  password: text("password").notNull(),
  role: UserRoles("role").notNull(),
  status: boolean("status").default(true).notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
export const UserRelations = relations(Users, ({ one }) => ({
  session: one(Sessions),
  doctor: one(Doctors),
  assistant: one(Assistants),
}));
export const Sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => Users.id),
});
export const Doctors = pgTable("doctors", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => Users.id),
  credential: text("credential").unique(),
  socials: json("socials"),
  assistantId: uuid("assistantId"),
  rate: doublePrecision("rate").notNull().default(0),
  specialtie: Specialties("specialtie").default("GENERAL").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
export const DoctorRelations = relations(Doctors, ({ many, one }) => ({
  user: one(Users),
  assistant: one(Assistants),
  queries: many(Queries),
  dates: many(Dates),
  drugs: many(Drugs),
}));
export const Assistants = pgTable("assistants", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => Users.id),
  change: doublePrecision("change").notNull().default(0),
  total: doublePrecision("total").notNull().default(0),
  expences: json("expences"),
});
export const AssistantRelations = relations(Assistants, ({ many, one }) => ({
  user: one(Users, { fields: [Assistants.id], references: [Users.id] }),
  doctor: one(Doctors, { fields: [Assistants.id], references: [Doctors.id] }),
}));
export const Patients = pgTable("patients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  dni: text("dni").unique(),
  sex: text("sex").notNull(),
  image: text("image"),
  address: json("address").notNull(),
  phone: text("phone"),
  doctorId: uuid("doctorId")
    .notNull()
    .references(() => Doctors.id),
  date: timestamp("date").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
export const PatientRelations = relations(Patients, ({ many, one }) => ({
  queries: many(Queries),
  doctor: one(Doctors),
  file: one(Files),
  relatives: many(Relatives),
}));
export const Dates = pgTable("dates", {
  id: uuid("id").primaryKey().defaultRandom(),
  start: timestamp("start").notNull(),
  end: timestamp("end").notNull(),
  doctorId: uuid("doctorId")
    .notNull()
    .references(() => Doctors.id),
  patientId: uuid("patientId")
    .notNull()
    .references(() => Patients.id),
  status: text("status"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
export const DateRelations = relations(Dates, ({ many, one }) => ({
  patient: one(Patients),
}));
export const Files = pgTable("files", {
  id: text("id").primaryKey(),
  patientId: uuid("patientId")
    .notNull()
    .references(() => Patients.id),
  infecto: text("infecto").array(),
  hereditary: text("hereditary").array(),
  app: json("app"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
export const FileRelations = relations(Files, ({ many, one }) => ({
  queries: many(Queries),
  patient: one(Patients),
}));
export const Queries = pgTable("queries", {
  id: uuid("id").primaryKey().defaultRandom(),
  idFile: text("idFile")
    .notNull()
    .references(() => Files.id),
  resources: text("resources").array(),
  interrogation: text("interrogation"),
  reason: text("reason"),
  history: text("history"),
  observations: text("observations"),
  diag: text("diag"),
  status: text("status"),
  dateId: uuid("dateId")
    .notNull()
    .references(() => Dates.id),
  price: doublePrecision("price").default(0),
  collector: uuid("collector"),
  emergency: boolean("emergency").default(false),
  doctorId: uuid("doctorId")
    .notNull()
    .references(() => Doctors.id),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
export const QueriesRelations = relations(Queries, ({ one }) => ({
  date: one(Dates),
  exam: one(Exams),
  prescription: one(Prescriptions),
}));
export const Relatives = pgTable("relatives", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  dni: text("dni").unique(),
  relation: text("relation").notNull(),
  nationality: text("nationality").notNull(),
  civilStatus: text("civilStatus").notNull(),
  phone: text("phone"),
  patientId: uuid("patientId")
    .notNull()
    .references(() => Patients.id),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
export const Prescriptions = pgTable("prescriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  querieId: uuid("QuerieId")
    .notNull()
    .references(() => Queries.id),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
export const PrescriptionsRelations = relations(Prescriptions, ({ many }) => ({
  details: many(PrescriptionsDetails),
}));
export const PrescriptionsDetails = pgTable("prescriptionsDetails", {
  id: uuid("id").primaryKey().defaultRandom(),
  prescriptionId: uuid("prescriptionId")
    .notNull()
    .references(() => Prescriptions.id),
  indications: text("indications").notNull(),
  drugId: uuid("drugId")
    .notNull()
    .references(() => Drugs.id),
  presentations: text("presentations").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
export const Drugs = pgTable("drugs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tradeName: text("tradeName").notNull(),
  genericName: text("genericName"),
  status: boolean("status").default(true),
  presentations: text("presentations").array(),
  doctorId: uuid("doctorId")
    .notNull()
    .references(() => Doctors.id),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
export const Exams = pgTable("exams", {
  id: uuid("id").primaryKey().defaultRandom(),
  querieId: uuid("querieId")
    .notNull()
    .references(() => Queries.id),
  vitals: json("vitals"),
  antropometrics: json("antropometrics"),
  aspects: text("aspects"),
  skin: text("skin"),
  hea: json("hea"),
  tor: json("tor"),
  abd: text("abd"),
  anus: text("anus"),
  genitu: text("genitu"),
  neuro: text("neuro"),
  exInf: text("exInf"),
  exSup: text("exSup"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
