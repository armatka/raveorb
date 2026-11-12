function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(date: Date, days: number): Date {
  const shifted = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

const today = new Date();
const daysToSaturday = (6 - today.getDay() + 7) % 7;
const thisSaturday = shiftDate(today, daysToSaturday);
const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
const laterThisMonthDay = Math.min(today.getDate() + 14, lastDayOfMonth);
const laterThisMonth = new Date(today.getFullYear(), today.getMonth(), laterThisMonthDay);

export const mockEventDates = {
  tonight: toLocalIsoDate(today),
  thisWeekend: toLocalIsoDate(thisSaturday),
  laterThisMonth: toLocalIsoDate(laterThisMonth),
  inDays(days: number): string {
    return toLocalIsoDate(shiftDate(today, days));
  },
};
