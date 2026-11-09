import { getLanguage, setLanguage, t } from "./i18n.js";

const root = document.getElementById("app");
const state = { language: getLanguage(), user: null, setupRequired: false, flash: "", lastInvite: null, reportPage: 1 };
const errorKeys = {
  authentication_required: "invalidCredentials", invalid_credentials: "invalidCredentials",
  invitation_invalid: "invalidInvitation", invitation_details_invalid: "invalidInvitation",
  bootstrap_not_configured: "setupNotConfigured", bootstrap_token_invalid: "bootstrapInvalid",
  administrator_already_exists: "setupExists", setup_busy: "genericError", csrf_invalid: "csrfInvalid",
  account_not_found: "accountNotFound", invalid_setup_details: "invalidFields", network_error: "networkError",
  login_rate_limited: "loginRateLimited", invite_rate_limited: "inviteRateLimited",
  report_not_found: "reportNotFound", report_edit_forbidden: "reportEditForbidden", admin_required: "adminRequired",
  email_already_registered: "emailAlreadyRegistered", attachment_too_large: "attachmentTooLarge",
  attachment_type_not_allowed: "attachmentTypeNotAllowed", attachment_limit_reached: "attachmentLimitReached",
  attachment_unavailable: "attachmentUnavailable", report_fields_invalid: "invalidFields",
  invitation_details_invalid: "invalidInvitation",
};

function tr(key) { return t(key, state.language); }
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}
function readCookie(name) {
  const match = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}
function apiMessage(error) {
  if (error?.status === 429) return tr(errorKeys[error.code] || "rateLimited");
  if (error?.status >= 500 || !error?.code) return tr("genericError");
  return tr(errorKeys[error.code] || "genericError");
}
async function api(path, { method = "GET", body, formData } = {}) {
  const headers = {};
  const options = { method, credentials: "same-origin", headers };
  if (!new Set(["GET", "HEAD", "OPTIONS"]).has(method.toUpperCase())) {
    const csrf = readCookie("ddf_csrf");
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }
  if (formData) {
    options.body = formData;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(path, options);
  } catch {
    throw { code: "network_error", status: 0 };
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.error || {};
    throw { code: detail.code || "request_failed", status: response.status, message: detail.message };
  }
  return payload;
}
function navigate(path) { location.hash = path.startsWith("/") ? `#${path}` : `#/${path}`; }
function route() {
  const value = location.hash.slice(1) || "/";
  if (value.startsWith("/invite/")) return { name: "invite", token: value.slice("/invite/".length).split("/")[0] };
  if (value.startsWith("/reports/")) return { name: "detail", id: value.slice("/reports/".length).split("/")[0] };
  if (value.startsWith("/edit/")) return { name: "edit", id: value.slice("/edit/".length).split("/")[0] };
  if (value === "/new") return { name: "new" };
  if (value === "/admin/invitations") return { name: "invitations" };
  if (value === "/setup") return { name: "setup" };
  if (value === "/login") return { name: "login" };
  return { name: "reports" };
}
function formatDate(value, withTime = false) {
  if (!value) return "—";
  const dateValue = String(value).slice(0, 10);
  const date = new Date(withTime ? String(value) : `${dateValue}T12:00:00`);
  if (Number.isNaN(date.valueOf())) return escapeHtml(value);
  return new Intl.DateTimeFormat(state.language === "ar" ? "ar" : "en", withTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }).format(date);
}
function updateDocumentLanguage() {
  setLanguage(state.language);
  document.title = `${tr("brand")} — ${tr("subtitle")}`;
}
function userNav() {
  if (!state.user) return "";
  return `<nav class="main-nav" aria-label="${escapeHtml(tr("reports"))}">
    <a href="#/reports">${escapeHtml(tr("reports"))}</a>
    <a href="#/new">${escapeHtml(tr("newReport"))}</a>
    ${state.user.role === "admin" ? `<a href="#/admin/invitations">${escapeHtml(tr("invitations"))}</a>` : ""}
  </nav>
  <div class="account-tools"><span class="account-name">${escapeHtml(state.user.fullName)}</span>
    <button class="button-quiet" type="button" data-action="logout">${escapeHtml(tr("logout"))}</button>
  </div>`;
}
function shell(content, { compact = false } = {}) {
  updateDocumentLanguage();
  root.setAttribute("aria-busy", "false");
  root.innerHTML = `<div class="site-frame">
    <header class="site-header">
      <a class="brand-link" href="#/reports" aria-label="${escapeHtml(tr("brand"))}">
        <img src="/icon.svg" width="34" height="34" alt="" />
        <span class="brand-copy"><strong>${escapeHtml(tr("brand"))}</strong><small>${escapeHtml(tr("subtitle"))}</small></span>
      </a>
      <div class="header-actions">${userNav()}
        <button type="button" class="language-switch" data-action="language" aria-label="${escapeHtml(tr("languageLabel"))}">${escapeHtml(tr("language"))}</button>
      </div>
    </header>
    <main class="site-main${compact ? " site-main--compact" : ""}">${content}</main>
    <footer class="site-footer"><span>${escapeHtml(tr("brand"))}</span><span>${escapeHtml(tr("subtitle"))}</span></footer>
  </div>`;
  bindActions();
}
function showBanner(key, kind = "error") {
  const area = document.querySelector("[data-notice]");
  if (!area) return;
  area.textContent = typeof key === "string" ? tr(key) : String(key);
  area.className = `notice notice--${kind}`;
  area.hidden = false;
}
function renderAuthCard(title, inner) {
  shell(`<section class="auth-layout">
    <div class="auth-brand">
      <div class="brand-emblem"><img src="/icon.svg" width="56" height="56" alt="" /></div>
      <p class="eyebrow">DAL FOOD · QUALITY ASSURANCE</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="auth-tagline">${escapeHtml(tr("subtitle"))}</p>
    </div>
    <div class="auth-card">${inner}</div>
  </section>`, { compact: true });
}
function renderLogin() {
  renderAuthCard(tr("signInTitle"), `<form id="login-form" class="stack-form">
    <p class="form-intro">${escapeHtml(tr("adminCreates"))}</p>
    <label class="field"><span>${escapeHtml(tr("email"))}</span>
      <input name="email" type="email" autocomplete="username" inputmode="email" maxlength="254" required />
    </label>
    <label class="field"><span>${escapeHtml(tr("password"))}</span>
      <input name="password" type="password" autocomplete="current-password" required />
    </label>
    <div class="notice" data-notice role="alert" hidden></div>
    <button class="button-primary button-wide" type="submit">${escapeHtml(tr("signIn"))}</button>
    <p class="help-note">${escapeHtml(tr("noOpenSignup"))}</p>
    ${state.setupRequired ? `<a class="text-link setup-link" href="#/setup">${escapeHtml(tr("firstAdmin"))}</a>` : ""}
  </form>`);
  document.getElementById("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      const result = await api("/api/auth/login", { method: "POST", body: {
        email: form.elements.email.value.trim(), password: form.elements.password.value,
      } });
      state.user = result.user;
      state.setupRequired = false;
      state.flash = "";
      navigate("/reports");
    } catch (error) {
      showBanner(apiMessage(error));
    } finally {
      button.disabled = false;
    }
  });
}
function renderSetup() {
  renderAuthCard(tr("setupTitle"), `<form id="setup-form" class="stack-form">
    <p class="form-intro">${escapeHtml(tr("setupHelp"))}</p>
    <label class="field"><span>${escapeHtml(tr("bootstrapToken"))}</span>
      <input name="bootstrapToken" type="password" autocomplete="off" required minlength="32" />
    </label>
    <label class="field"><span>${escapeHtml(tr("fullName"))}</span><input name="fullName" autocomplete="name" maxlength="160" required /></label>
    <label class="field"><span>${escapeHtml(tr("email"))}</span><input name="email" type="email" autocomplete="email" maxlength="254" required /></label>
    <label class="field"><span>${escapeHtml(tr("password"))}</span><input name="password" type="password" autocomplete="new-password" minlength="12" required /><small>${escapeHtml(tr("passwordRule"))}</small></label>
    <div class="notice" data-notice role="alert" hidden></div>
    <button class="button-primary button-wide" type="submit">${escapeHtml(tr("createAdmin"))}</button>
    <a class="text-link" href="#/login">${escapeHtml(tr("signIn"))}</a>
  </form>`);
  document.getElementById("setup-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      const result = await api("/api/auth/setup/first-admin", { method: "POST", body: {
        bootstrapToken: form.elements.bootstrapToken.value,
        fullName: form.elements.fullName.value.trim(),
        email: form.elements.email.value.trim(),
        password: form.elements.password.value,
      } });
      state.user = result.user;
      state.setupRequired = false;
      navigate("/reports");
    } catch (error) {
      showBanner(apiMessage(error));
    } finally {
      button.disabled = false;
    }
  });
}
function reportCard(report) {
  return `<article class="report-card">
    <div class="report-card-top"><span class="report-id">${escapeHtml(report.reportNo)}</span><time>${escapeHtml(formatDate(report.reportDate))}</time></div>
    <h2><a href="#/reports/${encodeURIComponent(report.id)}">${escapeHtml(report.issueType)}</a></h2>
    <p class="report-location">${escapeHtml(report.department)} <span aria-hidden="true">·</span> ${escapeHtml(report.productBatch)}</p>
    <div class="report-card-bottom"><span>${escapeHtml(report.author)}</span><span>${escapeHtml(String(report.attachmentCount))} ${escapeHtml(tr("attachments").toLowerCase())}</span></div>
  </article>`;
}
async function renderReports() {
  shell(`<section class="section-heading">
    <div><p class="eyebrow">DAL FOOD · QUALITY ASSURANCE</p><h1>${escapeHtml(tr("allReports"))}</h1><p>${escapeHtml(tr("reportsHelp"))}</p></div>
    <a class="button-primary" href="#/new">${escapeHtml(tr("newReport"))}<span aria-hidden="true">＋</span></a>
  </section>
  <div class="notice" data-flash hidden></div>
  <section class="report-grid" aria-live="polite"><div class="loading-inline">${escapeHtml(tr("loading"))}</div></section>
  <nav class="report-pagination" data-pagination aria-label="${escapeHtml(tr("pagination"))}" hidden></nav>`);
  if (state.flash) {
    const flash = document.querySelector("[data-flash]");
    flash.textContent = tr(state.flash);
    flash.className = "notice notice--success";
    flash.hidden = false;
    state.flash = "";
  }
  try {
    const result = await api(`/api/reports?page=${state.reportPage}`);
    const grid = document.querySelector(".report-grid");
    state.reportPage = result.page;
    if (!result.reports.length) {
      grid.innerHTML = `<div class="empty-state"><span class="empty-mark">DDF</span><h2>${escapeHtml(tr("noReports"))}</h2><p>${escapeHtml(tr("shareReport"))}</p><a class="button-primary" href="#/new">${escapeHtml(tr("createReport"))}</a></div>`;
      return;
    }
    grid.innerHTML = result.reports.map(reportCard).join("");
    const pager = document.querySelector("[data-pagination]");
    pager.hidden = result.totalPages <= 1;
    pager.innerHTML = `<button class="button-secondary" type="button" data-action="reports-page" data-page="${Math.max(1, result.page - 1)}" ${result.page <= 1 ? "disabled" : ""}>${escapeHtml(tr("previous"))}</button>
      <span>${escapeHtml(tr("page"))} ${result.page} / ${result.totalPages} · ${escapeHtml(tr("reportCount"))}: ${result.total}</span>
      <button class="button-secondary" type="button" data-action="reports-page" data-page="${Math.min(result.totalPages, result.page + 1)}" ${result.page >= result.totalPages ? "disabled" : ""}>${escapeHtml(tr("next"))}</button>`;
  } catch (error) {
    const grid = document.querySelector(".report-grid");
    if (grid) grid.innerHTML = `<div class="notice notice--error">${escapeHtml(apiMessage(error))}</div>`;
  }
}
function reportFormMarkup(report = null) {
  const editing = Boolean(report);
  const val = (key) => escapeHtml(report?.[key] || "");
  const fileLimit = Math.max(0, 5 - Number(report?.attachmentCount || 0));
  return `<section class="content-panel report-form-panel">
    <div class="section-heading section-heading--small"><div><p class="eyebrow">${escapeHtml(tr("brand"))}</p><h1>${escapeHtml(editing ? tr("edit") : tr("createReport"))}</h1></div><a class="text-link" href="${editing ? `#/reports/${encodeURIComponent(report.id)}` : "#/reports"}">${escapeHtml(tr("cancel"))}</a></div>
    <form id="report-form" class="report-form" data-editing="${editing ? "true" : "false"}">
      <div class="form-grid">
        <label class="field"><span>${escapeHtml(tr("date"))}</span><input name="reportDate" type="date" value="${val("reportDate") || new Date().toISOString().slice(0, 10)}" required /></label>
        <label class="field"><span>${escapeHtml(tr("department"))}</span><input name="department" maxlength="160" value="${val("department")}" required /></label>
        <label class="field"><span>${escapeHtml(tr("productBatch"))}</span><input name="productBatch" maxlength="180" value="${val("productBatch")}" required /></label>
        <label class="field"><span>${escapeHtml(tr("issueType"))}</span><input name="issueType" maxlength="100" value="${val("issueType")}" required /></label>
        <label class="field field-span"><span>${escapeHtml(tr("description"))}</span><textarea name="description" rows="4" maxlength="10000" required>${val("description")}</textarea></label>
        <label class="field field-span"><span>${escapeHtml(tr("correctiveAction"))}</span><textarea name="correctiveAction" rows="4" maxlength="10000" required>${val("correctiveAction")}</textarea></label>
        <label class="field field-span"><span>${escapeHtml(tr("chooseFiles"))}</span>
          <input name="files" type="file" accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,application/pdf,image/png,image/jpeg,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" multiple ${fileLimit === 0 ? "disabled" : ""} />
          <small>${escapeHtml(tr("allowedFiles"))}${fileLimit ? ` · ${fileLimit} ${state.language === "ar" ? "متبقية" : "remaining"}` : ""}</small>
        </label>
      </div>
      <div class="notice" data-notice role="alert" hidden></div>
      <div class="form-actions"><button class="button-primary" type="submit">${escapeHtml(editing ? tr("saveChanges") : tr("createReport"))}</button><a class="button-secondary" href="${editing ? `#/reports/${encodeURIComponent(report.id)}` : "#/reports"}">${escapeHtml(tr("cancel"))}</a></div>
    </form>
  </section>`;
}
async function renderReportForm(id = null) {
  let report = null;
  if (id) {
    try {
      const result = await api(`/api/reports/${encodeURIComponent(id)}`);
      report = result.report;
      if (!report.canEdit) { navigate(`/reports/${encodeURIComponent(id)}`); return; }
    } catch (error) {
      shell(`<div class="content-panel"><div class="notice notice--error">${escapeHtml(apiMessage(error))}</div><a class="text-link" href="#/reports">${escapeHtml(tr("back"))}</a></div>`);
      return;
    }
  }
  shell(reportFormMarkup(report));
  document.getElementById("report-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    const files = [...form.elements.files.files];
    const values = Object.fromEntries(["reportDate", "department", "productBatch", "issueType", "description", "correctiveAction"].map((name) => [name, form.elements[name].value.trim()]));
    button.disabled = true;
    try {
      const saved = await api(id ? `/api/reports/${encodeURIComponent(id)}` : "/api/reports", {
        method: id ? "PUT" : "POST", body: values,
      });
      const savedReport = saved.report;
      if (!id) state.reportPage = 1;
      let attachmentError = "";
      for (const file of files) {
        const data = new FormData();
        data.append("file", file);
        try {
          await api(`/api/reports/${encodeURIComponent(savedReport.id)}/attachments`, { method: "POST", formData: data });
        } catch (error) {
          attachmentError = errorKeys[error.code] || "genericError";
          break;
        }
      }
      state.flash = attachmentError || "reportSaved";
      navigate(`/reports/${encodeURIComponent(savedReport.id)}`);
    } catch (error) {
      showBanner(apiMessage(error));
    } finally {
      button.disabled = false;
    }
  });
}
async function renderReportDetail(id) {
  try {
    const result = await api(`/api/reports/${encodeURIComponent(id)}`);
    const report = result.report;
    const filesMarkup = report.attachments.length
      ? report.attachments.map((file) => `<li><span class="file-icon" aria-hidden="true">${escapeHtml(file.name.split(".").pop().slice(0, 4).toUpperCase())}</span><span class="file-name">${escapeHtml(file.name)}</span><a class="text-link" href="/api/reports/${encodeURIComponent(report.id)}/attachments/${encodeURIComponent(file.id)}/download">${escapeHtml(tr("download"))}</a></li>`).join("")
      : `<li class="muted-row">${escapeHtml(tr("noAttachments"))}</li>`;
    const body = `<section class="content-panel detail-panel">
      <div class="detail-top"><a class="text-link" href="#/reports">← ${escapeHtml(tr("back"))}</a><span class="report-id">${escapeHtml(report.reportNo)}</span></div>
      <div class="section-heading section-heading--small"><div><p class="eyebrow">${escapeHtml(formatDate(report.reportDate))}</p><h1>${escapeHtml(report.issueType)}</h1><p>${escapeHtml(report.department)} · ${escapeHtml(report.productBatch)}</p></div>
        <div class="form-actions">${report.canEdit ? `<button class="button-secondary" type="button" data-action="edit-report" data-id="${escapeHtml(report.id)}">${escapeHtml(tr("edit"))}</button>` : ""}${report.canDelete ? `<button class="button-danger" type="button" data-action="delete-report" data-id="${escapeHtml(report.id)}">${escapeHtml(tr("delete"))}</button>` : ""}</div>
      </div>
      <div class="notice" data-flash hidden></div>
      <div class="detail-meta"><span>${escapeHtml(tr("author"))}: <strong>${escapeHtml(report.author)}</strong></span><span>${escapeHtml(tr("updatedAt"))}: <strong>${escapeHtml(formatDate(report.updatedAt, true))}</strong></span></div>
      <div class="detail-section"><h2>${escapeHtml(tr("description"))}</h2><p class="preserve-lines">${escapeHtml(report.description)}</p></div>
      <div class="detail-section"><h2>${escapeHtml(tr("correctiveAction"))}</h2><p class="preserve-lines">${escapeHtml(report.correctiveAction)}</p></div>
      <div class="detail-section"><h2>${escapeHtml(tr("attachments"))}</h2><ul class="attachment-list">${filesMarkup}</ul></div>
      ${report.canEdit ? `<a class="text-link" href="#/edit/${encodeURIComponent(report.id)}">${escapeHtml(tr("edit"))}</a>` : `<p class="muted-note">${escapeHtml(tr("editOwnerOnly"))}</p>`}
      ${report.canDelete ? "" : `<p class="muted-note">${escapeHtml(tr("deleteAdminOnly"))}</p>`}
    </section>`;
    shell(body);
    if (state.flash) {
      const flash = document.querySelector("[data-flash]");
      flash.textContent = tr(state.flash);
      flash.className = "notice notice--success";
      flash.hidden = false;
      state.flash = "";
    }
  } catch (error) {
    shell(`<div class="content-panel"><div class="notice notice--error">${escapeHtml(apiMessage(error))}</div><a class="text-link" href="#/reports">${escapeHtml(tr("back"))}</a></div>`);
  }
}
async function renderInvitations() {
  shell(`<section class="section-heading"><div><p class="eyebrow">${escapeHtml(tr("account"))}</p><h1>${escapeHtml(tr("invitations"))}</h1><p>${escapeHtml(tr("invitationHelp"))}</p></div></section>
    <div class="admin-grid"><section class="content-panel"><h2>${escapeHtml(tr("createInvitation"))}</h2>
      <form id="invite-form" class="stack-form">
        <label class="field"><span>${escapeHtml(tr("invitationType"))}</span><select name="purpose"><option value="account_create">${escapeHtml(tr("newAccount"))}</option><option value="password_reset">${escapeHtml(tr("resetPassword"))}</option></select></label>
        <label class="field"><span>${escapeHtml(tr("fullName"))}</span><input name="fullName" autocomplete="name" maxlength="160" /><small>${escapeHtml(tr("inviteNameHelp"))}</small></label>
        <label class="field"><span>${escapeHtml(tr("email"))}</span><input name="email" type="email" autocomplete="email" maxlength="254" required /></label>
        <div class="notice" data-notice role="alert" hidden></div>
        <button class="button-primary" type="submit">${escapeHtml(tr("createInvitation"))}</button>
      </form>
      <div class="invite-result" data-invite-result hidden></div>
    </section><section class="content-panel"><h2>${escapeHtml(tr("pendingInvitations"))}</h2><div data-invite-list class="invite-list"><p class="loading-inline">${escapeHtml(tr("loading"))}</p></div></section></div>`);
  const inviteForm = document.getElementById("invite-form");
  const inviteName = inviteForm.elements.fullName;
  const syncInviteName = () => {
    const isNewAccount = inviteForm.elements.purpose.value === "account_create";
    inviteName.required = isNewAccount;
    inviteName.disabled = !isNewAccount;
  };
  inviteForm.elements.purpose.addEventListener("change", syncInviteName);
  syncInviteName();
  inviteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      const purpose = form.elements.purpose.value;
      const result = await api("/api/admin/invitations", { method: "POST", body: {
        purpose, fullName: purpose === "account_create" ? form.elements.fullName.value.trim() : "", email: form.elements.email.value.trim(),
      } });
      const invite = result.invitation;
      invite.link = `${window.location.origin}/#/invite/${encodeURIComponent(invite.token)}`;
      state.lastInvite = invite;
      showInviteResult();
      form.reset();
      syncInviteName();
      await loadInvitations();
    } catch (error) {
      showBanner(apiMessage(error));
    } finally {
      button.disabled = false;
    }
  });
  showInviteResult();
  await loadInvitations();
}
function showInviteResult() {
  const area = document.querySelector("[data-invite-result]");
  if (!area || !state.lastInvite) return;
  area.hidden = false;
  const bundle = `${state.lastInvite.link}\n${tr("accessCode")}: ${state.lastInvite.code}`;
  area.innerHTML = `<div class="notice notice--success">${escapeHtml(tr("invitationCreated"))}</div>
    <label class="field"><span>${escapeHtml(tr("inviteLink"))}</span><input readonly value="${escapeHtml(state.lastInvite.link)}" /></label>
    <label class="field"><span>${escapeHtml(tr("inviteCode"))}</span><input readonly dir="ltr" value="${escapeHtml(state.lastInvite.code)}" /></label>
    <textarea class="copy-buffer" data-bundle readonly aria-label="${escapeHtml(tr("copyInvite"))}">${escapeHtml(bundle)}</textarea>
    <button class="button-secondary" type="button" data-action="copy-invite">${escapeHtml(tr("copyInvite"))}</button>`;
}
async function loadInvitations() {
  const list = document.querySelector("[data-invite-list]");
  if (!list) return;
  try {
    const result = await api("/api/admin/invitations");
    if (!result.invitations.length) { list.innerHTML = `<p class="muted-note">${escapeHtml(tr("noInvitations"))}</p>`; return; }
    list.innerHTML = result.invitations.map((invite) => {
      const expired = new Date(invite.expiresAt).valueOf() < Date.now();
      const status = invite.used ? tr("used") : invite.revoked ? tr("revoked") : expired ? tr("expired") : tr("pending");
      const canRevoke = !invite.used && !invite.revoked && !expired;
      return `<article class="invite-row"><div><strong>${escapeHtml(invite.fullName)}</strong><span>${escapeHtml(invite.email)}</span><small>${escapeHtml(invite.purpose === "password_reset" ? tr("resetPassword") : tr("newAccount"))}</small><small>${escapeHtml(tr("expiresAt"))}: ${escapeHtml(formatDate(invite.expiresAt, true))}</small></div>
        <span class="status-pill${canRevoke ? " status-pill--pending" : ""}">${escapeHtml(status)}</span>
        ${canRevoke ? `<button class="button-quiet" type="button" data-action="revoke-invite" data-id="${escapeHtml(invite.id)}">${escapeHtml(tr("revoke"))}</button>` : ""}</article>`;
    }).join("");
  } catch (error) {
    list.innerHTML = `<div class="notice notice--error">${escapeHtml(apiMessage(error))}</div>`;
  }
}
async function renderInvite(token) {
  if (!/^[A-Za-z0-9_-]{40,48}$/.test(token)) {
    renderAuthCard(tr("acceptInvitation"), `<div class="notice notice--error">${escapeHtml(tr("invalidInvitation"))}</div><a class="text-link" href="#/login">${escapeHtml(tr("signIn"))}</a>`);
    return;
  }
  renderAuthCard(tr("acceptInvitation"), `<p class="form-intro">${escapeHtml(tr("loading"))}</p>`);
  try {
    const result = await api("/api/auth/invitation/lookup", { method: "POST", body: { token } });
    const isPasswordReset = result.purpose === "password_reset";
    const inviteTitle = isPasswordReset ? tr("resetPassword") : tr("acceptInvitation");
    renderAuthCard(inviteTitle, `<form id="accept-invite-form" class="stack-form">
      <p class="form-intro">${escapeHtml(tr("invitedAs"))}: <strong>${escapeHtml(result.fullName)}</strong><br /><span dir="ltr">${escapeHtml(result.email)}</span>${isPasswordReset ? `<br /><span>${escapeHtml(tr("resetPasswordHelp"))}</span>` : ""}</p>
      <label class="field"><span>${escapeHtml(tr("accessCode"))}</span><input name="code" autocomplete="one-time-code" inputmode="text" maxlength="24" dir="ltr" required /></label>
      <label class="field"><span>${escapeHtml(tr("setPassword"))}</span><input name="password" type="password" autocomplete="new-password" minlength="12" required /><small>${escapeHtml(tr("passwordRule"))}</small></label>
      <label class="field"><span>${escapeHtml(tr("confirmPassword"))}</span><input name="confirmPassword" type="password" autocomplete="new-password" minlength="12" required /></label>
      <div class="notice" data-notice role="alert" hidden></div>
      <button class="button-primary button-wide" type="submit">${escapeHtml(isPasswordReset ? tr("resetPassword") : tr("activateAccount"))}</button>
    </form>`);
    document.getElementById("accept-invite-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (form.elements.password.value !== form.elements.confirmPassword.value) { showBanner("invalidFields"); return; }
      const button = form.querySelector("button[type=submit]");
      button.disabled = true;
      try {
        const accepted = await api("/api/auth/invitation/accept", { method: "POST", body: {
          token, code: form.elements.code.value, password: form.elements.password.value,
        } });
        state.user = accepted.user;
        state.setupRequired = false;
        navigate("/reports");
      } catch (error) {
        showBanner(apiMessage(error));
      } finally { button.disabled = false; }
    });
  } catch (error) {
    renderAuthCard(tr("acceptInvitation"), `<div class="notice notice--error">${escapeHtml(apiMessage(error))}</div><a class="text-link" href="#/login">${escapeHtml(tr("signIn"))}</a>`);
  }
}
function bindActions() {
  root.onclick = async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "language") {
      state.language = state.language === "ar" ? "en" : "ar";
      updateDocumentLanguage();
      await renderCurrent();
    } else if (action === "logout") {
      button.disabled = true;
      try { await api("/api/auth/logout", { method: "POST", body: {} }); } catch { /* session expiry is handled locally */ }
      state.user = null;
      state.setupRequired = false;
      navigate("/login");
    } else if (action === "edit-report") {
      navigate(`/edit/${encodeURIComponent(button.dataset.id)}`);
    } else if (action === "delete-report") {
      if (!window.confirm(tr("deleteConfirm"))) return;
      button.disabled = true;
      try {
        await api(`/api/reports/${encodeURIComponent(button.dataset.id)}`, { method: "DELETE", body: {} });
        state.flash = "reportDeleted";
        navigate("/reports");
      } catch (error) { showBanner(apiMessage(error)); button.disabled = false; }
    } else if (action === "reports-page") {
      const page = Number(button.dataset.page);
      if (Number.isSafeInteger(page) && page > 0) {
        state.reportPage = page;
        await renderReports();
      }
    } else if (action === "revoke-invite") {
      if (!window.confirm(tr("revokeConfirm"))) return;
      button.disabled = true;
      try {
        await api(`/api/admin/invitations/${encodeURIComponent(button.dataset.id)}`, { method: "DELETE", body: {} });
        await loadInvitations();
      } catch (error) { showBanner(apiMessage(error)); button.disabled = false; }
    } else if (action === "copy-invite") {
      const buffer = document.querySelector("[data-bundle]");
      try {
        await navigator.clipboard.writeText(buffer.value);
        button.textContent = tr("copied");
      } catch {
        buffer.focus(); buffer.select();
        button.textContent = tr("copyInvite");
      }
    }
  };
}
async function renderCurrent() {
  if (!state.user) {
    const current = route();
    if (current.name === "invite") return renderInvite(current.token);
    if (current.name === "setup" && state.setupRequired) return renderSetup();
    if (state.setupRequired && current.name !== "login") { navigate("/setup"); return; }
    return renderLogin();
  }
  const current = route();
  if (current.name === "invite") return renderInvite(current.token);
  if (current.name === "invitations") {
    if (state.user.role !== "admin") { navigate("/reports"); return; }
    return renderInvitations();
  }
  if (current.name === "new") return renderReportForm();
  if (current.name === "edit") return renderReportForm(current.id);
  if (current.name === "detail") return renderReportDetail(current.id);
  return renderReports();
}
async function start() {
  try {
    const status = await api("/api/auth/status");
    state.user = status.user;
    state.setupRequired = status.setupRequired;
    await renderCurrent();
  } catch {
    shell(`<section class="auth-layout"><div class="content-panel"><h1>${escapeHtml(tr("brand"))}</h1><div class="notice notice--error">${escapeHtml(tr("networkError"))}</div></div></section>`, { compact: true });
  }
}

root.addEventListener("click", () => {});
window.addEventListener("hashchange", () => { renderCurrent(); });
start();
