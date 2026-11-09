import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const PASSWORD_N = 1 << 15;
const PASSWORD_R = 8;
const PASSWORD_P = 1;
const PASSWORD_BYTES = 64;
const MAXMEM = 64 * 1024 * 1024;

export const SESSION_TTL_SECONDS = 12 * 60 * 60;
export const INVITATION_TTL_HOURS = 24;

export function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizeInvitationCode(value) {
  return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

export function hashOpaqueToken(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function newSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function newCsrfToken() {
  return randomBytes(32).toString("base64url");
}

export function newInviteToken() {
  return randomBytes(32).toString("base64url");
}

export function newInviteCode() {
  return randomBytes(12).toString("hex").toUpperCase();
}

export function constantTimeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function validEmail(value) {
  return typeof value === "string" && value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validPassword(value) {
  return typeof value === "string" && value.length >= 12 &&
    Buffer.byteLength(value, "utf8") <= 1024;
}

export async function hashPassword(password) {
  if (!validPassword(password)) {
    throw new Error("Password does not meet the minimum length requirement.");
  }
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, PASSWORD_BYTES, {
    N: PASSWORD_N,
    r: PASSWORD_R,
    p: PASSWORD_P,
    maxmem: MAXMEM,
  });
  return [
    "scrypt",
    PASSWORD_N,
    PASSWORD_R,
    PASSWORD_P,
    salt.toString("hex"),
    Buffer.from(derived).toString("hex"),
  ].join("$");
}

async function verifyKnownHash(password, encoded) {
  const parts = String(encoded ?? "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nText, rText, pText, saltHex, hashHex] = parts;
  const n = Number(nText);
  const r = Number(rText);
  const p = Number(pText);
  if (n !== PASSWORD_N || r !== PASSWORD_R || p !== PASSWORD_P ||
      !/^[a-f0-9]{32}$/i.test(saltHex) || !/^[a-f0-9]{128}$/i.test(hashHex)) {
    return false;
  }
  const expected = Buffer.from(hashHex, "hex");
  const actual = Buffer.from(await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length, {
    N: n,
    r,
    p,
    maxmem: MAXMEM,
  }));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const DUMMY_PASSWORD_HASH = await hashPassword("DDF-Tracking-Dummy-Password-Not-For-Login");

export async function verifyPassword(password, storedHash) {
  if (typeof password !== "string" || Buffer.byteLength(password, "utf8") > 1024) {
    await verifyKnownHash("invalid-input", DUMMY_PASSWORD_HASH);
    return false;
  }
  if (!storedHash) {
    await verifyKnownHash(password, DUMMY_PASSWORD_HASH);
    return false;
  }
  try {
    return await verifyKnownHash(password, storedHash);
  } catch {
    await verifyKnownHash(password, DUMMY_PASSWORD_HASH);
    return false;
  }
}

export function getCookieProfile() {
  const profile = process.env.SESSION_COOKIE_PROFILE || "cloud";
  if (!new Set(["cloud", "http-local"]).has(profile)) {
    throw new Error("SESSION_COOKIE_PROFILE must be 'cloud' or 'http-local'.");
  }
  if (process.env.NODE_ENV === "production" && profile === "http-local") {
    throw new Error("The local HTTP cookie profile cannot be used in production.");
  }
  return profile;
}

export function cookieHeader(name, value, { httpOnly = true, maxAge = SESSION_TTL_SECONDS } = {}) {
  const profile = getCookieProfile();
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
    "SameSite=None",
  ];
  if (httpOnly) parts.push("HttpOnly");
  if (profile === "cloud") {
    parts.push("Secure");
  } else {
    parts[parts.length - 1] = "SameSite=Lax";
  }
  return parts.join("; ");
}

export function readCookies(header = "") {
  const result = Object.create(null);
  for (const part of String(header).split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try {
      result[key] = decodeURIComponent(value);
    } catch {
      result[key] = "";
    }
  }
  return result;
}
