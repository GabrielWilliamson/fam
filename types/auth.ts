import type { Session, User as UserL } from "lucia";

interface User extends UserL {
  email: string;
  id: string;
  role: string;
  image: string | null;
}

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
  specialtie: string;
};
export type userReturning = {
  id: string;
  name: string;
  email: string;
  role: string;
  doctor: doctor | null;
  image: string | null;
  assistant: assistant | null;
};
