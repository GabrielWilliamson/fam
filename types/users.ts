export type usersTable = {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: string | null;
  image: string | null;
  role: "ADMIN" | "ASSISTANT" | "DOCTOR";
  status: boolean;
};
