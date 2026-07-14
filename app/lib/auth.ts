import { redirect } from "react-router";

const STORAGE_KEY = "cointer.personalKey";

export const KEY_PATTERN = /^ck_[A-Za-z0-9_-]{43}$/;

export function getKey(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setKey(key: string): void {
  window.localStorage.setItem(STORAGE_KEY, key);
}

export function clearKey(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function requireKey(): string {
  const key = getKey();
  if (!key) throw redirect("/login");
  return key;
}

export function maskKey(key: string): string {
  return `ck_…${key.slice(-4)}`;
}
