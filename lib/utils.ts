import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const HIVE_TO_USDT = 0.0001; // 1 Hive = 0.0001 USDT (100 Hive = 0.01 USDT)

export function hiveToUsdt(hive: number): number {
  return hive * HIVE_TO_USDT;
}

export function usdtToHive(usdt: number): number {
  return usdt / HIVE_TO_USDT;
}

export function formatHive(amount: number): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatUsdt(amount: number): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

export function generateReferralCode(telegramId: number): string {
  return `HIVE${telegramId.toString(36).toUpperCase()}`;
}

export function timeAgo(date: string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return past.toLocaleDateString();
}

export function canClaimDailyBonus(lastClaimed: string | null): boolean {
  if (!lastClaimed) return true;
  const last = new Date(lastClaimed);
  const now = new Date();
  const diffHours = (now.getTime() - last.getTime()) / (1000 * 60 * 60);
  return diffHours >= 24;
}

export function hoursUntilNextBonus(lastClaimed: string): number {
  const last = new Date(lastClaimed);
  const next = new Date(last.getTime() + 24 * 60 * 60 * 1000);
  const now = new Date();
  return Math.max(0, Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60)));
}

export function truncateAddress(address: string): string {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function isValidBep20Address(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
