/**
 * Sign-in is handled by the server (see lib/server/auth.ts and /api/auth/login):
 * passwords are stored as salted scrypt hashes and the session lives in an
 * httpOnly cookie.
 *
 * This file only holds the sample villa's sign-in details, which fill the login
 * form while developing (`npm run dev`). They are left out of production builds.
 */
export const DEV_LOGIN =
  process.env.NODE_ENV === "development" ? { email: "owner@villaserenity.lk", password: "serenity2026" } : { email: "", password: "" };
