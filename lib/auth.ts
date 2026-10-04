/**
 * Prototype sign-in. There is no server, so this only checks the details in the
 * browser and remembers that someone signed in. It keeps the app from opening
 * straight onto the villa's data, but it is NOT real security: replace it with
 * proper authentication (NextAuth, Supabase Auth, Laravel Sanctum, ...) before
 * real guest data goes in.
 */
export const DEMO_LOGIN = {
  email: "owner@villaserenity.lk",
  password: "serenity2026",
};

const SESSION_KEY = "villa-serenity:session";

export function checkLogin(email: string, password: string) {
  return email.trim().toLowerCase() === DEMO_LOGIN.email && password === DEMO_LOGIN.password;
}

export function readSession() {
  try {
    return window.localStorage.getItem(SESSION_KEY) === "1" || window.sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

/** "Keep me signed in" uses localStorage; otherwise the sign-in ends when the browser closes. */
export function writeSession(remember: boolean) {
  try {
    (remember ? window.localStorage : window.sessionStorage).setItem(SESSION_KEY, "1");
  } catch {
    // Storage blocked: the sign-in still works until the page is reloaded.
  }
}

export function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
