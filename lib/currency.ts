import { getUserDetail } from "@/lib/userDetail";

// Common ISO 4217 codes an admin can pick from in Settings - keep this list in sync with
// Yoton-API/Helpers/CurrencyHelper.cs's SupportedCurrencies map.
export const SUPPORTED_CURRENCIES: { code: string; symbol: string; label: string }[] = [
  { code: "INR", symbol: "₹", label: "Indian Rupee (₹)" },
  { code: "USD", symbol: "$", label: "US Dollar ($)" },
  { code: "EUR", symbol: "€", label: "Euro (€)" },
  { code: "GBP", symbol: "£", label: "British Pound (£)" },
  { code: "AED", symbol: "AED", label: "UAE Dirham (AED)" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar (A$)" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar (C$)" },
  { code: "SGD", symbol: "S$", label: "Singapore Dollar (S$)" },
];

// Every amount shown anywhere in the web app should go through this, sourced from the
// signed-in user's company (set by an admin in Settings), not a hardcoded symbol - see
// app/(pages)/settings/page.tsx for where it's edited.
export function getCurrencySymbol(): string {
  return getUserDetail()?.currencySymbol || "₹";
}

export function formatCurrency(value: number): string {
  return `${getCurrencySymbol()}${value.toFixed(2)}`;
}
