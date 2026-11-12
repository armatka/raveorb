import type { CurrencyCode } from "../types/Night";

const currencyLabels: Record<CurrencyCode, string> = {
  CAD: "CA$",
  USD: "US$",
  EUR: "€",
};

export function getCurrencySymbol(currency: string): string {
  return currencyLabels[currency as CurrencyCode] ?? currency;
}

export function formatCurrency(amount: number, currency: string): string {
  if (currency === "CAD" || currency === "USD" || currency === "EUR") {
    const formatted = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "code",
    }).format(amount);
    return formatted.replace(currency, getCurrencySymbol(currency));
  }
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
