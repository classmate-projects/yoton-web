import { getUserDetail } from "@/lib/userDetail";

// Amounts are always shown in the installation's currency - the region chosen by the super
// administrator (see lib/region.ts). There is no separate currency setting any more.
export function getCurrencySymbol(): string {
  const detail = getUserDetail();
  return detail?.region?.currency.symbol || detail?.currencySymbol || "";
}

function currencyDecimals(): number {
  return getUserDetail()?.region?.currency.decimals ?? 2;
}

// "QR 12.50" / "AED 12.50" for letter symbols, "₹12.50" for a sign.
export function formatCurrency(value: number): string {
  const symbol = getCurrencySymbol();
  const amount = value.toFixed(currencyDecimals());
  if (!symbol) return amount;
  return /[A-Za-z.]$/.test(symbol) ? `${symbol} ${amount}` : `${symbol}${amount}`;
}
