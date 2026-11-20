'use strict';

class AppError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'AppError';
    this.code = code;
    this.status = options.status ?? null;
    this.retryAfterMs = options.retryAfterMs ?? null;
  }
}

const FRIENDLY_FALLBACK = 'Something went wrong. Please try again.';

function toPublicError(error) {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message || FRIENDLY_FALLBACK,
      ...(error.retryAfterMs ? { retryAfterMs: error.retryAfterMs } : {}),
    };
  }

  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
    return {
      code: 'NETWORK',
      message: 'Spotify took too long to respond. Check your connection and try again.',
    };
  }

  return {
    code: 'UNKNOWN',
    message: FRIENDLY_FALLBACK,
  };
}

module.exports = { AppError, toPublicError };
