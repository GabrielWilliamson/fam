import { relations } from "drizzle-orm";

import {
  boolean,
  decimal,
  integer,
  json,
  pgEnum,
  pgTable,
  serial,
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
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});
export const UserRelations = relations(Users, ({ one }) => ({
  session: one(Sessions, {
    fields: [Users.id],
    references: [Sessions.userId],
  }),
  doctor: one(Doctors, { fields: [Users.id], references: [Doctors.userId] }),
  assistant: one(Assistants, {
    fields: [Users.id],
    references: [Assistants.userId],
  }),
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
  skils: json("skils"),
  assistantId: uuid("assistantId"),
  specialtie: Specialties("specialtie").default("GENERAL").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});
export const DoctorRelations = relations(Doctors, ({ many, one }) => ({
  user: one(Users, { fields: [Doctors.id], references: [Users.id] }),
  assistant: one(Assistants, {
    fields: [Doctors.id],
    references: [Assistants.id],
  }),
  queries: many(Queries),
  dates: many(Dates),
  drugs: many(Drugs),
}));
export const Assistants = pgTable("assistants", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => Users.id),
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
  address: json("address").notNull(),
  phone: text("phone"),
  doctorId: uuid("doctorId")
    .notNull()
    .references(() => Doctors.id),
  date: timestamp("date").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});
export const PatientRelations = relations(Patients, ({ many, one }) => ({
  queries: many(Queries),
  doctor: one(Doctors, {
    fields: [Patients.doctorId],
    references: [Doctors.id],
  }),
  file: one(Files, {
    fields: [Patients.id],
    references: [Files.patientId],
  }),
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
  patient: one(Patients, {
    fields: [Dates.patientId],
    references: [Patients.id],
  }),
  queries: many(Queries),
}));
export const Files = pgTable("files", {
  id: text("id").primaryKey(),
  patientId: uuid("patientId")
    .notNull()
    .references(() => Patients.id),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
export const FileRelations = relations(Files, ({ many, one }) => ({
  queries: many(Queries),
  patient: one(Patients, {
    references: [Patients.id],
    fields: [Files.patientId],
  }),
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
  dateId: uuid("dateId")
    .notNull()
    .references(() => Dates.id),
  price: decimal("price"),
  emergency: boolean("emergency").default(false),
  doctorsId: uuid("doctorsId")
    .notNull()
    .references(() => Doctors.id),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});
export const QueriesRelations = relations(Queries, ({ one }) => ({
  date: one(Dates, { fields: [Queries.dateId], references: [Dates.id] }),
  exam: one(Exams, {
    fields: [Queries.id],
    references: [Exams.querieId],
  }),
  prescription: one(Prescriptions, {
    fields: [Queries.id],
    references: [Prescriptions.querieId],
  }),
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
  indications: text("Indications").notNull(),
  drugId: uuid("drugId")
    .notNull()
    .references(() => Drugs.id),
  presentations: text("presentations").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
export const Drugs = pgTable("drugs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tradeName: text("name").notNull(),
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
  signosVitales: json("signosVitales"),
  antropometrics: json("antropometrics"),
  aspectoGeneral: text("aspectoGeneral"),
  pielYMucosa: text("pielYMucosa"),
  cabezaYCuello: text("cabezaYCuello"),
  torax: text("torax"),
  abdomenYPelvis: text("abdomenYPelvis"),
  ano: text("ano"),
  musculoesqueletico: text("musculoes"),
  genitourinario: text("genitourinario"),
  neuro: text("neuro"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
