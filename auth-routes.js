import { Router } from "express";
import rateLimit from "express-rate-limit";
import { pool, withTransaction } from "./db.js";
import { HttpError, requireAuth, requireCsrf } from "./middleware.js";
import { asyncRoute } from "./http.js";
import {
  constantTimeEqual,
  hashOpaqueToken,
  hashPassword,
  newInviteCode,
  normalizeEmail,
  normalizeInvitationCode,
  newInviteToken,
  validEmail,
  validPassword,
  verifyPassword,
} from "./security.js";
import { clearUserSessionCookies, createUserSession, setAnonymousCsrfCookie } from "./sessions.js";

const router = Router();

function limiter(limit, windowMs, code) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request, response) => response.status(429).json({
      error: { code, message: "Too many attempts. Wait and try again." },
    }),
  });
}

const loginLimiter = limiter(12, 15 * 60 * 1000, "login_rate_limited");
const inviteLimiter = limiter(8, 15 * 60 * 1000, "invite_rate_limited");
const setupLimiter = limiter(5, 15 * 60 * 1000, "setup_rate_limited");

function publicAccount(account) {
  return {
    id: String(account.id),
    fullName: account.full_name,
    email: account.email,
    role: account.role,
  };
}

router.get("/status", asyncRoute(async (request, response) => {
  let csrfToken;
  if (!request.auth) csrfToken = setAnonymousCsrfCookie(response);
  const [settings] = await pool.execute("SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1", ["first_admin_setup_completed"]);
  response.set("Cache-Control", "no-store");
  return response.json({
    setupRequired: settings[0]?.setting_value !== "1",
    authenticated: Boolean(request.auth),
    user: request.auth ? {
      id: String(request.auth.id),
      fullName: request.auth.fullName,
      email: request.auth.email,
      role: request.auth.role,
    } : null,
    csrfToken: csrfToken || undefined,
  });
}));

router.post("/login", loginLimiter, requireCsrf, asyncRoute(async (request, response) => {
  const email = normalizeEmail(request.body?.email);
  const password = request.body?.password;
  if (!validEmail(email) || typeof password !== "string" || Buffer.byteLength(password, "utf8") > 1024) {
    await verifyPassword("invalid-input", null);
    throw new HttpError(401, "invalid_credentials", "The email or password is incorrect.");
  }

  const [rows] = await pool.execute(
    "SELECT id, full_name, email, password_hash, role, is_active FROM accounts WHERE email = ? LIMIT 1",
    [email],
  );
  const account = rows[0];
  const passwordMatches = await verifyPassword(password, account?.password_hash);
  if (!account || !account.is_active || !passwordMatches) {
    throw new HttpError(401, "invalid_credentials", "The email or password is incorrect.");
  }

  const csrfToken = await createUserSession(account.id, response);
  response.set("Cache-Control", "no-store");
  return response.json({ user: publicAccount(account), csrfToken });
}));

router.post("/logout", requireAuth, requireCsrf, asyncRoute(async (request, response) => {
  await pool.execute("DELETE FROM app_sessions WHERE token_hash = ?", [request.sessionTokenHash]);
  clearUserSessionCookies(response);
  response.set("Cache-Control", "no-store");
  return response.json({ ok: true });
}));

router.post("/setup/first-admin", setupLimiter, requireCsrf, asyncRoute(async (request, response) => {
  const configuredToken = process.env.BOOTSTRAP_ADMIN_TOKEN || "";
  if (configuredToken.length < 32) {
    throw new HttpError(503, "bootstrap_not_configured", "First administrator setup is not configured.");
  }
  const suppliedToken = String(request.body?.bootstrapToken || "");
  if (suppliedToken.length > 256 || !constantTimeEqual(suppliedToken, configuredToken)) {
    throw new HttpError(403, "bootstrap_token_invalid", "The setup token is invalid.");
  }

  const fullName = String(request.body?.fullName || "").trim();
  const email = normalizeEmail(request.body?.email);
  const password = request.body?.password;
  if (!fullName || fullName.length > 160 || !validEmail(email) || !validPassword(password)) {
    throw new HttpError(400, "invalid_setup_details", "Enter a name, valid email, and password of at least 12 characters.");
  }

  const passwordHash = await hashPassword(password);
  let accountId;
  try {
    accountId = await withTransaction(async (connection) => {
      const [settings] = await connection.execute(
        "SELECT setting_value FROM app_settings WHERE setting_key = ? FOR UPDATE",
        ["first_admin_setup_completed"],
      );
      if (!settings.length) throw new HttpError(503, "setup_unavailable", "First administrator setup is not ready.");
      if (settings[0].setting_value !== "0") {
        throw new HttpError(409, "administrator_already_exists", "The first administrator has already been created.");
      }
      const [result] = await connection.execute(
        "INSERT INTO accounts (full_name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
        [fullName, email, passwordHash],
      );
      const [claimed] = await connection.execute(
        "UPDATE app_settings SET setting_value = '1' WHERE setting_key = ? AND setting_value = '0'",
        ["first_admin_setup_completed"],
      );
      if (!claimed.affectedRows) throw new HttpError(409, "administrator_already_exists", "The first administrator has already been created.");
      return result.insertId;
    });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") throw new HttpError(409, "email_already_registered", "This email is already registered.");
    throw error;
  }

  const csrfToken = await createUserSession(accountId, response);
  response.status(201).json({ user: { id: String(accountId), fullName, email, role: "admin" }, csrfToken });
}));

router.post("/invitation/lookup", inviteLimiter, requireCsrf, asyncRoute(async (request, response) => {
  const token = String(request.body?.token || "");
  if (!/^[A-Za-z0-9_-]{40,48}$/.test(token)) {
    throw new HttpError(404, "invitation_invalid", "This invitation is invalid, expired, or already used.");
  }
  const [rows] = await pool.execute(
    `SELECT email, full_name, purpose, expires_at
     FROM invitations
     WHERE token_hash = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP(3)
     LIMIT 1`,
    [hashOpaqueToken(token)],
  );
  if (!rows.length) throw new HttpError(404, "invitation_invalid", "This invitation is invalid, expired, or already used.");
  return response.json({ email: rows[0].email, fullName: rows[0].full_name, purpose: rows[0].purpose, expiresAt: rows[0].expires_at });
}));

router.post("/invitation/accept", inviteLimiter, requireCsrf, asyncRoute(async (request, response) => {
  const token = String(request.body?.token || "");
  const code = normalizeInvitationCode(request.body?.code);
  const password = request.body?.password;
  if (!/^[A-Za-z0-9_-]{40,48}$/.test(token) || !/^[A-F0-9]{24}$/.test(code) || !validPassword(password)) {
    throw new HttpError(400, "invitation_details_invalid", "Check the invitation code and use a password of at least 12 characters.");
  }

  const tokenHash = hashOpaqueToken(token);
  const codeHash = hashOpaqueToken(code);
  const passwordHash = await hashPassword(password);
  const account = await withTransaction(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT id, email, full_name, purpose
       FROM invitations
       WHERE token_hash = ? AND code_hash = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP(3)
       LIMIT 1 FOR UPDATE`,
      [tokenHash, codeHash],
    );
    const invitation = rows[0];
    if (!invitation) throw new HttpError(400, "invitation_invalid", "This invitation is invalid, expired, or already used.");

    let account;
    if (invitation.purpose === "password_reset") {
      const [accounts] = await connection.execute(
        "SELECT id, full_name, email, role, is_active FROM accounts WHERE email = ? LIMIT 1 FOR UPDATE",
        [invitation.email],
      );
      const existing = accounts[0];
      if (!existing || !existing.is_active) {
        throw new HttpError(400, "invitation_invalid", "This invitation is invalid, expired, or already used.");
      }
      await connection.execute("UPDATE accounts SET password_hash = ? WHERE id = ?", [passwordHash, existing.id]);
      await connection.execute("DELETE FROM app_sessions WHERE account_id = ?", [existing.id]);
      account = { id: existing.id, full_name: existing.full_name, email: existing.email, role: existing.role };
    } else {
      const [existing] = await connection.execute("SELECT id FROM accounts WHERE email = ? LIMIT 1", [invitation.email]);
      if (existing.length) throw new HttpError(409, "email_already_registered", "This email is already registered.");
      const [result] = await connection.execute(
        "INSERT INTO accounts (full_name, email, password_hash, role) VALUES (?, ?, ?, 'user')",
        [invitation.full_name, invitation.email, passwordHash],
      );
      account = { id: result.insertId, full_name: invitation.full_name, email: invitation.email, role: "user" };
    }
    const [used] = await connection.execute("UPDATE invitations SET used_at = UTC_TIMESTAMP(3) WHERE id = ? AND used_at IS NULL", [invitation.id]);
    if (!used.affectedRows) throw new HttpError(400, "invitation_invalid", "This invitation is invalid, expired, or already used.");
    return account;
  });

  const csrfToken = await createUserSession(account.id, response);
  response.status(201).json({ user: publicAccount(account), csrfToken });
}));

export default router;
