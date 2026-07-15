import { validateExternalUrl, SafeExternalUrlFailure } from "./safeExternalUrlPolicy.js";
import { createSafeExternalRedirectClient } from "./safeExternalRedirectClient.js";

export type SafeExternalFetchSuccess = {
  ok: true;
  body: string;
  statusCode: number;
  contentType: "text/html" | "application/xhtml+xml" | "text/plain";
  hostname: string;
  bytes: number;
  redirectsFollowed: number;
  timedOut: false;
};

export type SafeExternalFetchFailure = {
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
  timedOut?: boolean;
};

export type SafeExternalFetchResult =
  | SafeExternalFetchSuccess
  | SafeExternalFetchFailure;

export interface SafeExternalFetchDependencies {
  fetchExternalHttpsWithRedirects?: (
    rawUrl: unknown,
    options?: {
      signal?: AbortSignal;
      maxRedirects?: number;
    }
  ) => Promise<any>;
  createAbortController?: () => AbortController;
  setTimer?: (callback: () => void, ms: number) => any;
  clearTimer?: (timer: any) => void;
}

export function createSafeExternalFetch(dependencies: SafeExternalFetchDependencies = {}) {
  const fetchExternalHttpsWithRedirects =
    dependencies.fetchExternalHttpsWithRedirects || createSafeExternalRedirectClient();
  const createAbortController =
    dependencies.createAbortController || (() => new AbortController());
  const setTimer =
    dependencies.setTimer || globalThis.setTimeout.bind(globalThis);
  const clearTimer =
    dependencies.clearTimer || globalThis.clearTimeout.bind(globalThis);

  return async function safeExternalFetch(
    rawUrl: unknown,
    options?: {
      signal?: AbortSignal;
      timeoutMs?: number;
      maxRedirects?: number;
    }
  ): Promise<SafeExternalFetchResult> {
    if (options?.signal?.aborted) {
      return {
        ok: false,
        statusCode: 504,
        error: "SOURCE_TIMEOUT",
        timedOut: false,
      };
    }

    const validation = validateExternalUrl(rawUrl);
    if (!validation.ok) {
      const fail = validation as SafeExternalUrlFailure;
      return {
        ok: false,
        statusCode: fail.statusCode as SafeExternalFetchFailure["statusCode"],
        error: fail.error as SafeExternalFetchFailure["error"],
      };
    }

    const normalizedUrl = (validation as any).url.href;

    let timeoutMs = 8000;
    if (options && options.timeoutMs !== undefined) {
      if (
        typeof options.timeoutMs === "number" &&
        Number.isInteger(options.timeoutMs) &&
        options.timeoutMs >= 1000 &&
        options.timeoutMs <= 15000
      ) {
        timeoutMs = options.timeoutMs;
      }
    }

    const internalController = (() => {
      try {
        return createAbortController();
      } catch (err) {
        return null;
      }
    })();

    if (!internalController) {
      return {
        ok: false,
        statusCode: 502,
        error: "SOURCE_FETCH_FAILED",
        timedOut: false,
      };
    }

    let timer: any = null;
    let externalAbortHandler: (() => void) | null = null;
    let isSettled = false;
    let hasTimedOut = false;
    let hasExternalAborted = false;

    return await new Promise<SafeExternalFetchResult>((resolve) => {
      const cleanup = () => {
        if (timer !== null) {
          try {
            clearTimer(timer);
          } catch (e) {
            // Se clearTimer lançar exceção, não impede retorno
          }
          timer = null;
        }
        if (options?.signal && externalAbortHandler) {
          try {
            options.signal.removeEventListener("abort", externalAbortHandler);
          } catch (e) {
            // Se removeEventListener lançar exceção, não impede retorno
          }
          externalAbortHandler = null;
        }
      };

      const finish = (result: SafeExternalFetchResult) => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        resolve(result);
      };

      try {
        timer = setTimer(() => {
          if (isSettled) return;
          hasTimedOut = true;
          try {
            internalController.abort();
          } catch (e) {}
          finish({
            ok: false,
            statusCode: 504,
            error: "SOURCE_TIMEOUT",
            timedOut: true,
          });
        }, timeoutMs);
      } catch (err) {
        try {
          internalController.abort();
        } catch (e) {}
        finish({
          ok: false,
          statusCode: 502,
          error: "SOURCE_FETCH_FAILED",
          timedOut: false,
        });
        return;
      }

      if (options?.signal) {
        try {
          externalAbortHandler = () => {
            if (isSettled) return;
            hasExternalAborted = true;
            try {
              internalController.abort();
            } catch (e) {}
            finish({
              ok: false,
              statusCode: 504,
              error: "SOURCE_TIMEOUT",
              timedOut: false,
            });
          };
          options.signal.addEventListener("abort", externalAbortHandler);
        } catch (err) {
          if (timer !== null) {
            try {
              clearTimer(timer);
            } catch (e) {}
            timer = null;
          }
          try {
            internalController.abort();
          } catch (e) {}
          finish({
            ok: false,
            statusCode: 502,
            error: "SOURCE_FETCH_FAILED",
            timedOut: false,
          });
          return;
        }

        if (options.signal.aborted) {
          try {
            internalController.abort();
          } catch (e) {}
          finish({
            ok: false,
            statusCode: 504,
            error: "SOURCE_TIMEOUT",
            timedOut: false,
          });
          return;
        }
      }

      void (async () => {
        try {
          const redirectResult = await fetchExternalHttpsWithRedirects(normalizedUrl, {
            signal: internalController.signal,
            maxRedirects: options?.maxRedirects,
          });

          if (isSettled) return;

          if (redirectResult.ok) {
            finish({
              ok: true,
              body: redirectResult.body,
              statusCode: redirectResult.statusCode,
              contentType: redirectResult.contentType,
              hostname: redirectResult.hostname,
              bytes: redirectResult.bytes,
              redirectsFollowed: redirectResult.redirectsFollowed,
              timedOut: false,
            });
          } else {
            let timedOutVal: boolean | undefined = undefined;
            if (redirectResult.error === "SOURCE_TIMEOUT") {
              if (hasTimedOut) {
                timedOutVal = true;
              } else if (hasExternalAborted) {
                timedOutVal = false;
              } else {
                timedOutVal = false;
              }
            }

            finish({
              ok: false,
              statusCode: redirectResult.statusCode,
              error: redirectResult.error,
              ...(timedOutVal !== undefined ? { timedOut: timedOutVal } : {}),
            });
          }
        } catch (err) {
          finish({
            ok: false,
            statusCode: 502,
            error: "SOURCE_FETCH_FAILED",
            timedOut: false,
          });
        }
      })();
    });
  };
}
