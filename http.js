export function jsonError(response, status, code, message) {
  return response.status(status).json({ error: { code, message } });
}

export function asyncRoute(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

export function reportServerError(error, request, response, next) {
  if (response.headersSent) return next(error);
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const code = typeof error?.code === "string" ? error.code : "internal_error";
  const safeMessage = status >= 500
    ? "The request could not be completed. Try again later."
    : (typeof error.message === "string" ? error.message : "The request could not be completed.");

  if (status >= 500) {
    console.error("Request failed", { method: request.method, path: request.path, code });
  }
  return jsonError(response, status, code, safeMessage);
}
