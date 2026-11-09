import { Router } from "express";
import rateLimit from "express-rate-limit";
import { pool } from "./db.js";
import { HttpError, requireAdmin, requireAuth, requireCsrf } from "./middleware.js";
import { asyncRoute } from "./http.js";
import { newInviteCode, newInviteToken, normalizeEmail, validEmail, hashOpaqueToken } from "./security.js";

const router = Router();
const inviteCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.use(requireAuth, requireAdmin);

router.get("/invitations", asyncRoute(async (_request, response) => {
  const [rows] = await pool.query(
    `SELECT i.id, i.email, i.full_name, i.purpose, i.created_at, i.expires_at, i.used_at, i.revoked_at,
            a.full_name AS created_by_name
     FROM invitations i
     INNER JOIN accounts a ON a.id = i.created_by
     ORDER BY i.created_at DESC
     LIMIT 100`,
  );
  return response.json({ invitations: rows.map((row) => ({
    id: String(row.id),
    email: row.email,
    fullName: row.full_name,
    purpose: row.purpose,
    createdBy: row.created_by_name,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    used: Boolean(row.used_at),
    revoked: Boolean(row.revoked_at),
  })) });
}));

router.post("/invitations", requireCsrf, inviteCreationLimiter, asyncRoute(async (request, response) => {
  const purpose = request.body?.purpose === "password_reset" ? "password_reset" : "account_create";
  let fullName = String(request.body?.fullName || "").trim();
  const email = normalizeEmail(request.body?.email);
  if (!validEmail(email) || (purpose === "account_create" && (!fullName || fullName.length > 160))) {
    throw new HttpError(400, "invitation_details_invalid", "Enter the user's full name and a valid email address.");
  }

  const [accounts] = await pool.execute("SELECT id, full_name, is_active FROM accounts WHERE email = ? LIMIT 1", [email]);
  if (purpose === "password_reset") {
    if (!accounts.length || !accounts[0].is_active) throw new HttpError(404, "account_not_found", "No active account was found for this email.");
    fullName = accounts[0].full_name;
  } else if (accounts.length) {
    throw new HttpError(409, "email_already_registered", "This email already has an account.");
  }

  const token = newInviteToken();
  const code = newInviteCode();
  const tokenHash = hashOpaqueToken(token);
  const codeHash = hashOpaqueToken(code);

  const connection = await pool.getConnection();
  let invitationId;
  try {
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE invitations SET revoked_at = UTC_TIMESTAMP(3)
       WHERE email = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP(3)`,
      [email],
    );
    const [result] = await connection.execute(
      `INSERT INTO invitations (email, full_name, purpose, token_hash, code_hash, created_by, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 24 HOUR))`,
      [email, fullName, purpose, tokenHash, codeHash, request.auth.id],
    );
    invitationId = result.insertId;
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const [rows] = await pool.execute("SELECT expires_at FROM invitations WHERE id = ?", [invitationId]);
  response.set("Cache-Control", "no-store");
  return response.status(201).json({
    invitation: {
      id: String(invitationId),
      email,
      fullName,
      purpose,
      token,
      code,
      expiresAt: rows[0]?.expires_at,
    },
  });
}));

router.delete("/invitations/:id", requireCsrf, asyncRoute(async (request, response) => {
  if (!/^\d{1,18}$/.test(request.params.id)) throw new HttpError(404, "invitation_not_found", "Invitation not found.");
  const [result] = await pool.execute(
    `UPDATE invitations SET revoked_at = UTC_TIMESTAMP(3)
     WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL`,
    [request.params.id],
  );
  if (!result.affectedRows) throw new HttpError(404, "invitation_not_found", "Invitation not found.");
  return response.json({ ok: true });
}));

export default router;
