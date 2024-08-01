import type { addressType } from "../types/patient";

export function NewId(): string {
  const añoActual = new Date().getFullYear().toString();
  const fechaActual = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const cadenaAleatoria = NewRamdom();
  const id = añoActual + "-" + cadenaAleatoria;
  return id.toUpperCase();
}
export function NewRamdom(): string {
  const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let cadena = "";
  for (let i = 0; i < 4; i++) {
    const indice = Math.floor(Math.random() * caracteres.length);
    cadena += caracteres.charAt(indice);
  }
  return cadena;
}
export function transformAddress(address: any): string {
  const res = JSON.stringify(address);
  const r: addressType = JSON.parse(res);
  return r.address;
}
export function transformOrigin(address: any): string {
  const res = JSON.stringify(address);
  const r: addressType = JSON.parse(res);
  return r.nationality + " " + r.department + "-" + r.municipality;
}
export function calculateFullAge(dateOfBirth: Date): string {
  const birthYear = dateOfBirth.getFullYear();
  const birthMonth = dateOfBirth.getMonth();
  const birthDay = dateOfBirth.getDate();

  const currentDate = new Date();

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const currentDay = currentDate.getDate();

  let ageYears = currentYear - birthYear;
  let ageMonths = currentMonth - birthMonth;
  let ageDays = currentDay - birthDay;

  if (ageYears > 4) {
    return `${ageYears} años`;
  }

  if (ageMonths < 0 || (ageMonths === 0 && currentDay < birthDay)) {
    ageYears--;
    ageMonths += 12;
  }

  if (ageDays < 0) {
    const lastDayOfPreviousMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      0
    ).getDate();
    ageMonths--;
    ageDays += lastDayOfPreviousMonth;
  }
  const birthDate = new Date(birthYear, birthMonth, birthDay);
  const millisecondsPerWeek = 1000 * 60 * 60 * 24 * 7;
  const ageInWeeks = Math.floor(
    (currentDate.getTime() - birthDate.getTime()) / millisecondsPerWeek
  );
  return `${ageYears} años ${ageMonths} meses ${ageDays} días (${ageInWeeks} semanas)`;
}
