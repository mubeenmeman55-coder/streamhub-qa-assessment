class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const bad = (message, details) => new ApiError(400, 'INVALID_PARAMETER', message, details);

function allowOnly(query, allowed) {
  const unknown = Object.keys(query).filter((k) => !allowed.includes(k));
  if (unknown.length) throw bad(`Unsupported query parameter(s): ${unknown.join(', ')}`, { allowed });
}

// Express yields arrays/objects for repeated or nested params (?a=1&a=2) - reject instead of guessing
function single(query, name) {
  const v = query[name];
  if (v !== undefined && typeof v !== 'string') throw bad(`Parameter '${name}' must be given exactly once as a plain value`);
  return v;
}

function number(query, name, { required = false, min, max, integer = false } = {}) {
  const raw = single(query, name);
  if (raw === undefined || raw.trim() === '') {
    if (required) throw new ApiError(400, 'MISSING_PARAMETER', `Missing required parameter '${name}'`);
    return undefined;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) throw bad(`Parameter '${name}' must be a number`, { received: raw });
  if (integer && !Number.isInteger(n)) throw bad(`Parameter '${name}' must be an integer`, { received: raw });
  if (min !== undefined && n < min) throw bad(`Parameter '${name}' must be >= ${min}`, { received: n });
  if (max !== undefined && n > max) throw bad(`Parameter '${name}' must be <= ${max}`, { received: n });
  return n;
}

function oneOf(query, name, values, fallback) {
  const raw = single(query, name);
  if (raw === undefined) return fallback;
  if (!values.includes(raw)) throw bad(`Parameter '${name}' must be one of: ${values.join(', ')}`, { received: raw });
  return raw;
}

module.exports = { ApiError, allowOnly, single, number, oneOf };
