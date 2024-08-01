import bcryptjs from "bcryptjs";
export default async function hashPassword(password: string) {
  const salt = await bcryptjs.genSalt(10);
  return bcryptjs.hash(password, salt);
}
