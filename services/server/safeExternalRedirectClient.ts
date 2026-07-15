import { URL } from "node:url";
import { validateExternalUrl, SafeExternalUrlFailure } from "./safeExternalUrlPolicy.js";
import {
  createSafeExternalHttpsClient,
  SafeExternalHttpsResult,
  SafeExternalHttpsRedirect,
  SafeExternalHttpsFailure,
} from "./safeExternalHttpsClient.js";

export type FetchExternalHttpsOnceFn = (
  rawUrl: unknown,
  options?: { signal?: AbortSignal }
) => Promise<SafeExternalHttpsResult>;

export interface SafeExternalRedirectClientDependencies {
  fetchExternalHttpsOnce?: FetchExternalHttpsOnceFn;
}

export type SafeExternalRedirectSuccess = {
  ok: true;
  body: string;
  statusCode: number;
  contentType: "text/html" | "application/xhtml+xml" | "text/plain";
  hostname: string;
  bytes: number;
  redirectsFollowed: number;
};

export type SafeExternalRedirectFailure = {
  ok: false;
  statusCode: 400 | 403 | 413 | 415 | 502 | 504;
  error:
    | "INVALID_SOURCE_URL"
    | "UNSAFE_SOURCE_URL"
    | "SOURCE_DNS_FAILED"
    | "SOURCE_TIMEOUT"
    | "SOURCE_HTTP_ERROR"
    | "SOURCE_UNSUPPORTED_CONTENT_TYPE"
    | "SOURCE_UNSUPPORTED_ENCODING"
    | "SOURCE_TOO_LARGE"
    | "SOURCE_FETCH_FAILED"
    | "SOURCE_REDIRECT_LIMIT"
    | "SOURCE_REDIRECT_LOOP"
    | "SOURCE_UNSAFE_REDIRECT";
};

export type SafeExternalRedirectResult =
  | SafeExternalRedirectSuccess
  | SafeExternalRedirectFailure;

export function createSafeExternalRedirectClient(
  dependencies: SafeExternalRedirectClientDependencies = {}
) {
  const fetchExternalHttpsOnce =
    dependencies.fetchExternalHttpsOnce || createSafeExternalHttpsClient();

  return async function fetchExternalHttpsWithRedirects(
    rawUrl: unknown,
    options?: {
      signal?: AbortSignal;
      maxRedirects?: number;
    }
  ): Promise<SafeExternalRedirectResult> {
    if (options?.signal?.aborted) {
      return { ok: false, statusCode: 504, error: "SOURCE_TIMEOUT" };
    }

    let maxRedirects = 5;
    if (options && options.maxRedirects !== undefined) {
      if (
        typeof options.maxRedirects === "number" &&
        Number.isInteger(options.maxRedirects) &&
        options.maxRedirects >= 0 &&
        options.maxRedirects <= 10
      ) {
        maxRedirects = options.maxRedirects;
      }
    }

    try {
      const initialValidation = validateExternalUrl(rawUrl);
      if (!initialValidation.ok) {
        const fail = initialValidation as SafeExternalUrlFailure;
        return {
          ok: false,
          statusCode: fail.statusCode as SafeExternalRedirectFailure["statusCode"],
          error: fail.error as SafeExternalRedirectFailure["error"],
        };
      }

      let currentUrlObj = initialValidation.url;
      const visited = new Set<string>();
      visited.add(currentUrlObj.href);
      let redirectsFollowed = 0;

      while (true) {
        if (options?.signal?.aborted) {
          return { ok: false, statusCode: 504, error: "SOURCE_TIMEOUT" };
        }

        const response = await fetchExternalHttpsOnce(currentUrlObj.href, {
          signal: options?.signal,
        });

        if (response.ok) {
          return {
            ok: true,
            body: response.body,
            statusCode: response.statusCode,
            contentType: response.contentType,
            hostname: response.hostname,
            bytes: response.bytes,
            redirectsFollowed,
          };
        }

        // Explicitly cast non-ok responses to narrow the union
        const notOkResponse = response as SafeExternalHttpsRedirect | SafeExternalHttpsFailure;

        if (notOkResponse.error === "SOURCE_REDIRECT") {
          const redirectResp = response as SafeExternalHttpsRedirect;
          if (redirectsFollowed >= maxRedirects) {
            return { ok: false, statusCode: 502, error: "SOURCE_REDIRECT_LIMIT" };
          }

          const rawLocation = redirectResp.location;
          if (typeof rawLocation !== "string") {
            return { ok: false, statusCode: 403, error: "SOURCE_UNSAFE_REDIRECT" };
          }

          const trimmedLocation = rawLocation.trim();
          if (trimmedLocation === "") {
            return { ok: false, statusCode: 403, error: "SOURCE_UNSAFE_REDIRECT" };
          }

          if (trimmedLocation.length > 2048) {
            return { ok: false, statusCode: 403, error: "SOURCE_UNSAFE_REDIRECT" };
          }

          if (/[\r\n\t\s]/.test(rawLocation)) {
            return { ok: false, statusCode: 403, error: "SOURCE_UNSAFE_REDIRECT" };
          }

          let nextUrlObj: URL;
          try {
            nextUrlObj = new URL(trimmedLocation, currentUrlObj);
          } catch {
            return { ok: false, statusCode: 403, error: "SOURCE_UNSAFE_REDIRECT" };
          }

          if (nextUrlObj.protocol !== "https:") {
            return { ok: false, statusCode: 403, error: "SOURCE_UNSAFE_REDIRECT" };
          }

          const nextValidation = validateExternalUrl(nextUrlObj.href);
          if (!nextValidation.ok) {
            return { ok: false, statusCode: 403, error: "SOURCE_UNSAFE_REDIRECT" };
          }

          const validatedNextUrlObj = nextValidation.url;
          if (visited.has(validatedNextUrlObj.href)) {
            return { ok: false, statusCode: 502, error: "SOURCE_REDIRECT_LOOP" };
          }

          visited.add(validatedNextUrlObj.href);
          currentUrlObj = validatedNextUrlObj;
          redirectsFollowed++;
        } else {
          const failResp = response as SafeExternalHttpsFailure;
          return {
            ok: false,
            statusCode: failResp.statusCode as SafeExternalRedirectFailure["statusCode"],
            error: failResp.error as SafeExternalRedirectFailure["error"],
          };
        }
      }
    } catch {
      return { ok: false, statusCode: 502, error: "SOURCE_FETCH_FAILED" };
    }
  };
}
