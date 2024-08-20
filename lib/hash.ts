import bcryptjs from "bcryptjs";
import { randomBytes } from "crypto";



export default async function hashPassword(password: string) {
  const salt = await bcryptjs.genSalt(10);
  return bcryptjs.hash(password, salt);
}

export function generateEmailVerificationToken() {
  return randomBytes(32).toString("hex");
}
