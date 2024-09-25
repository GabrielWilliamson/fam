export const formatPhone = (phoneNumber: string) => {
  const cleaned = ("" + phoneNumber).replace(/\D/g, "");
  const match = cleaned.match(/^(\d{1,3})(\d{4})(\d{4})$/);
  if (match) {
    return `+ (${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phoneNumber;
};
