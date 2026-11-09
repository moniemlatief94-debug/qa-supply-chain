import { pool } from "./db.js";
import { constantTimeEqual, hashOpaqueToken, readCookies } from "./security.js";
import { clearUserSessionCookies, CSRF_COOKIE, SESSION_COOKIE } from "./sessions.js";

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function loadSession(request, response, next) {
  try {
    const cookies = readCookies(request.headers.cookie);
    const token = cookies[SESSION_COOKIE];
    request.auth = null;
    request.sessionTokenHash = null;
    if (!token || token.length > 128) return next();

    const [rows] = await pool.execute(
      `SELECT s.token_hash, s.csrf_hash, a.id, a.full_name, a.email, a.role, a.is_active
       FROM app_sessions s
       INNER JOIN accounts a ON a.id = s.account_id
       WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP(3) AND a.is_active = 1
       LIMIT 1`,
      [hashOpaqueToken(token)],
    );
    if (rows.length) {
      const row = rows[0];
      request.auth = {
        id: Number(row.id),
        fullName: row.full_name,
        email: row.email,
        role: row.role,
        csrfHash: row.csrf_hash,
      };
      request.sessionTokenHash = row.token_hash;
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireAuth(request, response, next) {
  if (!request.auth) return next(new HttpError(401, "authentication_required", "Sign in to continue."));
  return next();
}

export function requireAdmin(request, response, next) {
  if (request.auth?.role !== "admin") return next(new HttpError(403, "admin_required", "Administrator access is required."));
  return next();
}

export function requireCsrf(request, response, next) {
  const cookies = readCookies(request.headers.cookie);
  const cookieToken = cookies[CSRF_COOKIE];
  const headerToken = request.get("x-csrf-token");
  const matches = constantTimeEqual(cookieToken, headerToken);
  if (!matches || !cookieToken || cookieToken.length < 32) {
    return next(new HttpError(403, "csrf_invalid", "Refresh the page and try again."));
  }

  if (request.auth && !constantTimeEqual(hashOpaqueToken(headerToken), request.auth.csrfHash)) {
    return next(new HttpError(403, "csrf_invalid", "Refresh the page and try again."));
  }
  return next();
}

export function canEditReport(user, report) {
  return Boolean(user && report && (user.role === "admin" || Number(report.created_by) === user.id));
}

export async function lockAndCheckReportEditor(connection, user, reportId) {
  const [rows] = await connection.execute(
    "SELECT id, created_by, deleted_at FROM reports WHERE id = ? FOR UPDATE",
    [reportId],
  );
  const report = rows[0];
  if (!report || report.deleted_at) throw new HttpError(404, "report_not_found", "Report not found.");
  if (!canEditReport(user, report)) throw new HttpError(403, "report_edit_forbidden", "Only the report author or an administrator may edit it.");
  return report;
}

export function clearExpiredSessionCookie(response) {
  clearUserSessionCookies(response);
}
