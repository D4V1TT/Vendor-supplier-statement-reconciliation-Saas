/**
 * Auth helpers, token storage and login/register API calls.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export const TOKEN_KEY = "vr_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export async function login(email: string, password: string): Promise<void> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? "Login failed");
  setToken(data.access_token);
}

export async function register(
  email: string,
  password: string,
  fullName: string,
  companyName: string
): Promise<void> {
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, full_name: fullName, company_name: companyName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? "Registration failed");
  setToken(data.access_token);
}
