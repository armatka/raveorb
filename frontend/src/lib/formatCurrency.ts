import type { CurrencyCode } from "../types/Night";

const currencyLabels: Record<CurrencyCode, string> = {
  CAD: "CA$",
  USD: "US$",
  EUR: "€",
};

export function getCurrencySymbol(currency: CurrencyCode): string {
  return currencyLabels[currency];
}

export function formatCurrency(amount: number, currency: CurrencyCode): string {
  const formatted = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    currencyDisplay: "code",
  }).format(amount);

  return formatted.replace(currency, getCurrencySymbol(currency));
}
