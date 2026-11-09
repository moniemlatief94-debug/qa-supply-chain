import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Router } from "express";
import multer from "multer";
import { randomBytes } from "node:crypto";
import { pool, withTransaction } from "./db.js";
import { asyncRoute } from "./http.js";
import { canEditReport, HttpError, lockAndCheckReportEditor, requireAdmin, requireAuth, requireCsrf } from "./middleware.js";
import { downloadReportAttachment, uploadLimits, uploadReportAttachment, validateUpload } from "./storage.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: uploadLimits.fileBytes, files: 1, fields: 0, parts: 1 },
});
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function reportId(value) {
  return /^\d{1,18}$/.test(String(value)) ? String(value) : null;
}

function validDate(value) {
  if (typeof value !== "string" || !datePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function requiredText(value, maximum, fieldName) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > maximum) {
    throw new HttpError(400, "report_fields_invalid", `${fieldName} is required and must be no more than ${maximum} characters.`);
  }
  return text;
}

function normalizeReport(body) {
  if (!validDate(body?.reportDate)) throw new HttpError(400, "report_fields_invalid", "Enter a valid report date.");
  return {
    reportDate: body.reportDate,
    department: requiredText(body.department, 160, "Location or department"),
    productBatch: requiredText(body.productBatch, 180, "Product or batch"),
    issueType: requiredText(body.issueType, 100, "Case type"),
    description: requiredText(body.description, 10000, "Observation"),
    correctiveAction: requiredText(body.correctiveAction, 10000, "Action taken"),
  };
}

function generateReportNumber(date) {
  const year = date.slice(0, 4);
  return `DDF-${year}-${randomBytes(8).toString("hex").toUpperCase()}`;
}

function toReport(row, user, attachments = []) {
  return {
    id: String(row.id),
    reportNo: row.report_no,
    reportDate: typeof row.report_date === "string" ? row.report_date.slice(0, 10) : new Date(row.report_date).toISOString().slice(0, 10),
    department: row.department,
    productBatch: row.product_batch,
    issueType: row.issue_type,
    description: row.description,
    correctiveAction: row.corrective_action,
    author: row.author_name,
    createdBy: String(row.created_by),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    canEdit: canEditReport(user, row),
    canDelete: user.role === "admin",
    attachmentCount: Number(row.attachment_count || attachments.length),
    attachments: attachments.map((file) => ({
      id: String(file.id),
      name: file.original_name,
      mimeType: file.mime_type,
      size: Number(file.size_bytes),
      createdAt: file.created_at,
    })),
  };
}

async function getReport(reportIdValue, user) {
  const [rows] = await pool.execute(
    `SELECT r.*, a.full_name AS author_name,
       (SELECT COUNT(*) FROM report_attachments f WHERE f.report_id = r.id AND f.deleted_at IS NULL) AS attachment_count
     FROM reports r
     INNER JOIN accounts a ON a.id = r.created_by
     WHERE r.id = ? AND r.deleted_at IS NULL
     LIMIT 1`,
    [reportIdValue],
  );
  const row = rows[0];
  if (!row) throw new HttpError(404, "report_not_found", "Report not found.");
  const [files] = await pool.execute(
    `SELECT id, original_name, mime_type, size_bytes, created_at
     FROM report_attachments WHERE report_id = ? AND deleted_at IS NULL ORDER BY created_at`,
    [reportIdValue],
  );
  return toReport(row, user, files);
}

async function withReportLock(reportIdValue, work) {
  const connection = await pool.getConnection();
  const lockName = `ddf-report-${reportIdValue}`;
  let lockHeld = false;
  let destroyConnection = false;
  try {
    const [rows] = await connection.execute("SELECT GET_LOCK(?, 75) AS acquired", [lockName]);
    lockHeld = Number(rows[0]?.acquired) === 1;
    if (!lockHeld) throw new HttpError(503, "report_busy", "This report is busy. Try again shortly.");
    return await work(connection);
  } finally {
    if (lockHeld) {
      try {
        const [rows] = await connection.execute("SELECT RELEASE_LOCK(?) AS released", [lockName]);
        destroyConnection = Number(rows[0]?.released) !== 1;
      } catch {
        destroyConnection = true;
      }
    }
    if (destroyConnection) connection.destroy();
    else connection.release();
  }
}

async function requireEditorBeforeUpload(request, _response, next) {
  const id = reportId(request.params.id);
  if (!id) return next(new HttpError(404, "report_not_found", "Report not found."));
  try {
    const [rows] = await pool.execute("SELECT id, created_by, deleted_at FROM reports WHERE id = ? LIMIT 1", [id]);
    const report = rows[0];
    if (!report || report.deleted_at) return next(new HttpError(404, "report_not_found", "Report not found."));
    if (!canEditReport(request.auth, report)) return next(new HttpError(403, "report_edit_forbidden", "Only the report author or an administrator may edit it."));
    request.reportForUpload = report;
    return next();
  } catch (error) {
    return next(error);
  }
}

router.use(requireAuth);

router.get("/", asyncRoute(async (request, response) => {
  const pageText = String(request.query.page ?? "1");
  if (!/^\d{1,7}$/.test(pageText) || Number(pageText) < 1 || Number(pageText) > 1000000) {
    throw new HttpError(400, "report_page_invalid", "Choose a valid report page.");
  }
  const pageSize = 50;
  const [countRows] = await pool.query("SELECT COUNT(*) AS total FROM reports WHERE deleted_at IS NULL");
  const total = Number(countRows[0].total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Number(pageText), totalPages);
  const offset = (page - 1) * pageSize;
  const [rows] = await pool.execute(
    `SELECT r.id, r.report_no, r.report_date, r.department, r.product_batch, r.issue_type,
            r.description, r.corrective_action, r.created_by, r.created_at, r.updated_at,
            a.full_name AS author_name,
            (SELECT COUNT(*) FROM report_attachments f WHERE f.report_id = r.id AND f.deleted_at IS NULL) AS attachment_count
     FROM reports r
     INNER JOIN accounts a ON a.id = r.created_by
     WHERE r.deleted_at IS NULL
     ORDER BY r.report_date DESC, r.created_at DESC, r.id DESC
     LIMIT ? OFFSET ?`,
    [pageSize, offset],
  );
  return response.json({ reports: rows.map((row) => toReport(row, request.auth)), page, pageSize, total, totalPages });
}));

router.post("/", requireCsrf, asyncRoute(async (request, response) => {
  const fields = normalizeReport(request.body);
  const reportNo = generateReportNumber(fields.reportDate);
  const [result] = await pool.execute(
    `INSERT INTO reports
       (report_no, report_date, department, product_batch, issue_type, description, corrective_action, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [reportNo, fields.reportDate, fields.department, fields.productBatch, fields.issueType,
      fields.description, fields.correctiveAction, request.auth.id, request.auth.id],
  );
  const report = await getReport(result.insertId, request.auth);
  return response.status(201).json({ report });
}));

router.get("/:id", asyncRoute(async (request, response) => {
  const id = reportId(request.params.id);
  if (!id) throw new HttpError(404, "report_not_found", "Report not found.");
  return response.json({ report: await getReport(id, request.auth) });
}));

router.put("/:id", requireCsrf, asyncRoute(async (request, response) => {
  const id = reportId(request.params.id);
  if (!id) throw new HttpError(404, "report_not_found", "Report not found.");
  const fields = normalizeReport(request.body);
  await withTransaction(async (connection) => {
    await lockAndCheckReportEditor(connection, request.auth, id);
    await connection.execute(
      `UPDATE reports SET report_date = ?, department = ?, product_batch = ?, issue_type = ?,
         description = ?, corrective_action = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`,
      [fields.reportDate, fields.department, fields.productBatch, fields.issueType,
        fields.description, fields.correctiveAction, request.auth.id, id],
    );
  });
  return response.json({ report: await getReport(id, request.auth) });
}));

router.delete("/:id", requireAdmin, requireCsrf, asyncRoute(async (request, response) => {
  const id = reportId(request.params.id);
  if (!id) throw new HttpError(404, "report_not_found", "Report not found.");
  await withReportLock(id, async (connection) => {
    const [result] = await connection.execute(
      "UPDATE reports SET deleted_at = UTC_TIMESTAMP(3), updated_by = ? WHERE id = ? AND deleted_at IS NULL",
      [request.auth.id, id],
    );
    if (!result.affectedRows) throw new HttpError(404, "report_not_found", "Report not found.");
    await connection.execute("UPDATE report_attachments SET deleted_at = UTC_TIMESTAMP(3) WHERE report_id = ? AND deleted_at IS NULL", [id]);
  });
  return response.json({ ok: true });
}));

router.post("/:id/attachments", requireCsrf, requireEditorBeforeUpload, upload.single("file"), asyncRoute(async (request, response) => {
  const id = request.reportForUpload.id;
  if (!request.file) throw new HttpError(400, "attachment_missing", "Choose a file to upload.");
  const validation = validateUpload(request.file);
  if (!validation.ok) {
    const tooLarge = validation.reason === "too_large";
    throw new HttpError(tooLarge ? 413 : 415,
      tooLarge ? "attachment_too_large" : "attachment_type_not_allowed",
      tooLarge ? "Each attachment must be 10 MB or smaller." : "Use a PDF, PNG, JPG, CSV, or XLSX file.");
  }
  const attachment = await withReportLock(id, async (connection) => {
    await lockAndCheckReportEditor(connection, request.auth, id);
    const [counts] = await connection.execute(
      "SELECT COUNT(*) AS total FROM report_attachments WHERE report_id = ? AND deleted_at IS NULL",
      [id],
    );
    if (Number(counts[0].total) >= uploadLimits.filesPerReport) {
      throw new HttpError(409, "attachment_limit_reached", "A report can have up to five attachments.");
    }
    const storedObject = await uploadReportAttachment(id, request.file, validation);
    const [result] = await connection.execute(
      `INSERT INTO report_attachments (report_id, storage_key, stable_path, original_name, mime_type, size_bytes, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, storedObject.key, storedObject.stablePath, validation.originalName, validation.mime, validation.size, request.auth.id],
    );
    return {
      id: String(result.insertId),
      name: validation.originalName,
      mimeType: validation.mime,
      size: validation.size,
    };
  });
  return response.status(201).json({ attachment });
}));

router.get("/:id/attachments/:attachmentId/download", asyncRoute(async (request, response) => {
  const id = reportId(request.params.id);
  const attachmentId = reportId(request.params.attachmentId);
  if (!id || !attachmentId) throw new HttpError(404, "attachment_not_found", "Attachment not found.");
  const [rows] = await pool.execute(
    `SELECT f.storage_key, f.original_name, f.mime_type
     FROM report_attachments f
     INNER JOIN reports r ON r.id = f.report_id
     WHERE f.id = ? AND f.report_id = ? AND f.deleted_at IS NULL AND r.deleted_at IS NULL
     LIMIT 1`,
    [attachmentId, id],
  );
  const file = rows[0];
  if (!file) throw new HttpError(404, "attachment_not_found", "Attachment not found.");
  const upstream = await downloadReportAttachment(file.storage_key);
  if (!upstream.body) throw new HttpError(502, "attachment_unavailable", "The attachment is temporarily unavailable.");
  const asciiName = file.original_name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encodedName = encodeURIComponent(file.original_name).replace(/'/g, "%27");
  response.set({
    "Content-Type": file.mime_type,
    "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  });
  await pipeline(Readable.fromWeb(upstream.body), response);
}));

export default router;
