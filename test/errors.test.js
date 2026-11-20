'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { AppError, toPublicError } = require('../electron/lib/errors');

test('AppError exposes its code, status, and retry delay', () => {
  const cause = new Error('root cause');
  const error = new AppError('RATE_LIMITED', 'Slow down.', {
    status: 429,
    retryAfterMs: 5000,
    cause,
  });

  assert.equal(error.name, 'AppError');
  assert.equal(error.code, 'RATE_LIMITED');
  assert.equal(error.message, 'Slow down.');
  assert.equal(error.status, 429);
  assert.equal(error.retryAfterMs, 5000);
  assert.equal(error.cause, cause);
  assert.ok(error instanceof Error);
});

test('AppError defaults optional fields', () => {
  const error = new AppError('AUTH_EXPIRED', 'Sign in again.');
  assert.equal(error.status, null);
  assert.equal(error.retryAfterMs, null);
  assert.equal(error.cause, undefined);
});

test('toPublicError passes through AppError details', () => {
  const error = new AppError('RATE_LIMITED', 'Slow down.', { retryAfterMs: 1200 });
  assert.deepEqual(toPublicError(error), {
    code: 'RATE_LIMITED',
    message: 'Slow down.',
    retryAfterMs: 1200,
  });
});

test('toPublicError omits a missing retry delay', () => {
  assert.deepEqual(toPublicError(new AppError('NO_DEVICE', 'No device.')), {
    code: 'NO_DEVICE',
    message: 'No device.',
  });
});

test('toPublicError maps aborts and timeouts to a network message', () => {
  for (const name of ['AbortError', 'TimeoutError']) {
    const error = new Error('internal details');
    error.name = name;
    const result = toPublicError(error);
    assert.equal(result.code, 'NETWORK');
    assert.match(result.message, /took too long/);
    assert.equal(result.message.includes('internal details'), false);
  }
});

test('toPublicError hides unknown errors', () => {
  const result = toPublicError(new Error('secret internal detail'));
  assert.deepEqual(result, {
    code: 'UNKNOWN',
    message: 'Something went wrong. Please try again.',
  });
});
