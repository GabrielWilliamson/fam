import type { Session, User } from "lucia";

export type authVariables = {
  user: User | null;
  session: Session | null;
};
export type doctor = {
  id: string;
  specialtie: string;
};
export type assistant = {
  id: string;
};
export type userReturning = {
  id: string;
  name: string;
  email: string;
  role: string;
  doctor: doctor | null;
  assistant: assistant | null;
};
