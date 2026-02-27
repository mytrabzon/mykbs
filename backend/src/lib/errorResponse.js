/**
 * Ortak hata cevabı: ok: false, code, message, requestId.
 * İş kuralı: 409 (APPROVAL_REQUIRED, BRANCH_NOT_ASSIGNED, KBS_NOT_CONFIGURED).
 * Yetki: 403 (ROLE_FORBIDDEN).
 * Sistem: 500 (MISSING_DATABASE_URL, DB_CONNECT_ERROR, SCHEMA_ERROR, UNHANDLED_ERROR).
 */

/**
 * @param {object} req - Express request (req.requestId, req.user, req.branchId, req.tesis)
 * @param {object} res - Express response
 * @param {number} status - HTTP status (400, 401, 403, 409, 423, 500, 503)
 * @param {string} code - Kod: APPROVAL_REQUIRED | BRANCH_NOT_ASSIGNED | KBS_NOT_CONFIGURED | ROLE_FORBIDDEN | MISSING_DATABASE_URL | DB_CONNECT_ERROR | SCHEMA_ERROR | UNHANDLED_ERROR | ...
 * @param {string} message - Kullanıcıya gösterilecek mesaj
 * @param {object} [extra] - Ek alanlar (response body'ye eklenir)
 */
function errorResponse(req, res, status, code, message, extra = {}) {
  const requestId = (req && req.requestId) || '-';
  const endpoint = req && req.method && req.path ? `${req.method} ${req.path}` : (req && req.url) || '-';
  const userId = (req && req.user && (req.user.id ?? req.user.sub)) || '-';
  const branchId = (req && (req.branchId ?? req.tesis?.id)) || '-';
  logErrorResponse(requestId, endpoint, userId, branchId, status, code, message);

  const body = {
    ok: false,
    code,
    message,
    ...(requestId !== '-' && { requestId }),
    ...extra,
  };
  res.status(status).json(body);
}

/**
 * Log format: [REQ abc123] /api/oda user=U1 branch=B2 -> code=BRANCH_NOT_ASSIGNED status=409
 */
function logErrorResponse(requestId, endpoint, userId, branchId, status, code, message) {
  const u = userId === '-' ? 'null' : String(userId);
  const b = branchId === '-' ? 'null' : String(branchId);
  console.warn(
    `[REQ ${requestId}] ${endpoint} user=${u} branch=${b} -> code=${code} status=${status} ${message || ''}`
  );
}

/**
 * Başarılı JSON (ok: true) — tutarlılık için
 */
function successResponse(res, data = {}, status = 200) {
  res.status(status).json({ ok: true, ...data });
}

module.exports = {
  errorResponse,
  logErrorResponse,
  successResponse,
};
