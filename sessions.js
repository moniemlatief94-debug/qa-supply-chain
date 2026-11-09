import { pool } from "./db.js";
import {
  cookieHeader,
  hashOpaqueToken,
  newCsrfToken,
  newSessionToken,
  SESSION_TTL_SECONDS,
} from "./security.js";

export const SESSION_COOKIE = "ddf_session";
export const CSRF_COOKIE = "ddf_csrf";

export function setAnonymousCsrfCookie(response) {
  const token = newCsrfToken();
  response.append("Set-Cookie", cookieHeader(CSRF_COOKIE, token, { httpOnly: false, maxAge: 900 }));
  return token;
}

export async function createUserSession(accountId, response) {
  const sessionToken = newSessionToken();
  const csrfToken = newCsrfToken();
  await pool.execute(
    `INSERT INTO app_sessions (token_hash, csrf_hash, account_id, expires_at)
     VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? SECOND))`,
    [hashOpaqueToken(sessionToken), hashOpaqueToken(csrfToken), accountId, SESSION_TTL_SECONDS],
  );
  response.append("Set-Cookie", cookieHeader(SESSION_COOKIE, sessionToken, { maxAge: SESSION_TTL_SECONDS }));
  response.append("Set-Cookie", cookieHeader(CSRF_COOKIE, csrfToken, { httpOnly: false, maxAge: SESSION_TTL_SECONDS }));
  return csrfToken;
}

export function clearUserSessionCookies(response) {
  response.append("Set-Cookie", cookieHeader(SESSION_COOKIE, "", { maxAge: 0 }));
  response.append("Set-Cookie", cookieHeader(CSRF_COOKIE, "", { httpOnly: false, maxAge: 0 }));
}
