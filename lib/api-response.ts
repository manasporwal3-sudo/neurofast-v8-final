// lib/api-response.ts
// PART 5 — API STANDARDIZATION
//
// All API responses MUST use this format:
//   { success: boolean, data: T | null, error: string | null, meta?: object }
//
// Why: frontend can reliably check `response.success` and `response.error`
// instead of having different shapes across routes.

import { NextResponse } from "next/server";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: string | null;
  meta?: Record<string, unknown>;
}

/**
 * Return a successful JSON response.
 * Status defaults to 200.
 */
export function apiOk<T>(
  data: T,
  meta?: Record<string, unknown>,
  status = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    { success: true, data, error: null, ...(meta ? { meta } : {}) },
    { status }
  );
}

/**
 * Return a successful creation response (201).
 */
export function apiCreated<T>(
  data: T,
  meta?: Record<string, unknown>
): NextResponse<ApiResponse<T>> {
  return apiOk(data, meta, 201);
}

/**
 * Return an error response.
 * Status defaults to 400.
 */
export function apiError(
  error: string,
  status = 400,
  meta?: Record<string, unknown>
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
    { success: false, data: null, error, ...(meta ? { meta } : {}) },
    { status }
  );
}

/**
 * Return a 401 Unauthorized response.
 */
export function apiUnauthorized(message = "Unauthorized"): NextResponse<ApiResponse<null>> {
  return apiError(message, 401);
}

/**
 * Return a 403 Forbidden response.
 */
export function apiForbidden(message = "Forbidden"): NextResponse<ApiResponse<null>> {
  return apiError(message, 403);
}

/**
 * Return a 404 Not Found response.
 */
export function apiNotFound(resource = "Resource"): NextResponse<ApiResponse<null>> {
  return apiError(`${resource} not found`, 404);
}

/**
 * Return a 409 Conflict response (duplicate operations).
 */
export function apiConflict(message: string): NextResponse<ApiResponse<null>> {
  return apiError(message, 409);
}

/**
 * Return a 429 Rate Limit response.
 */
export function apiRateLimit(retryAfterSeconds: number): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: "Rate limit exceeded. Please slow down.",
      meta: { retryAfterSeconds },
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    }
  );
}

/**
 * Return a 503 Maintenance response.
 */
export function apiMaintenance(): NextResponse<ApiResponse<null>> {
  return apiError("Platform is under maintenance. Please try again shortly.", 503);
}

/**
 * Return a 502 Upstream Error response.
 */
export function apiUpstreamError(service: string): NextResponse<ApiResponse<null>> {
  return apiError(`${service} service is temporarily unavailable.`, 502);
}
