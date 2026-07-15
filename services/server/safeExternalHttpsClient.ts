import * as https from "https";
import { Buffer } from "buffer";
import { validateExternalUrl } from "./safeExternalUrlPolicy.js";
import { createSafeExternalDnsResolver } from "./safeExternalDnsResolver.js";

export type SafeResolvedAddress = {
  address: string;
  family: 4 | 6;
};

export type SafeExternalHttpsSuccess = {
  ok: true;
  body: string;
  statusCode: number;
  contentType: "text/html" | "application/xhtml+xml" | "text/plain";
  hostname: string;
  bytes: number;
};

export type SafeExternalHttpsRedirect = {
  ok: false;
  statusCode: 301 | 302 | 303 | 307 | 308;
  error: "SOURCE_REDIRECT";
  location: string;
};

export type SafeExternalHttpsFailure = {
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
    | "SOURCE_FETCH_FAILED";
};

export type SafeExternalHttpsResult =
  | SafeExternalHttpsSuccess
  | SafeExternalHttpsRedirect
  | SafeExternalHttpsFailure;

export interface SafeExternalHttpsClientDependencies {
  resolveSafeExternalHost?: (
    hostname: string,
    options?: { signal?: AbortSignal }
  ) => Promise<any>;
  requestHttps?: typeof https.request;
}

export function createSafeExternalHttpsClient(
  dependencies: SafeExternalHttpsClientDependencies = {}
) {
  const resolveSafeExternalHost =
    dependencies.resolveSafeExternalHost || createSafeExternalDnsResolver();
  const requestHttps = dependencies.requestHttps || https.request;

  return function fetchExternalHttpsOnce(
    rawUrl: unknown,
    options?: { signal?: AbortSignal }
  ): Promise<SafeExternalHttpsResult> {
    return new Promise<SafeExternalHttpsResult>((resolve) => {
      let finished = false;
      let abortListener: (() => void) | undefined;
      let req: any = null;
      let res: any = null;

      const done = (result: SafeExternalHttpsResult) => {
        if (finished) return;
        finished = true;

        if (options?.signal && abortListener) {
          options.signal.removeEventListener("abort", abortListener);
        }

        resolve(result);
      };

      if (options?.signal?.aborted) {
        return done({ ok: false, statusCode: 504, error: "SOURCE_TIMEOUT" });
      }

      if (options?.signal) {
        abortListener = () => {
          if (req) {
            try {
              req.destroy();
            } catch {}
          }
          if (res) {
            try {
              res.destroy();
            } catch {}
          }
          done({ ok: false, statusCode: 504, error: "SOURCE_TIMEOUT" });
        };
        options.signal.addEventListener("abort", abortListener);
      }

      try {
        const urlValidation = validateExternalUrl(rawUrl);
        if (urlValidation.ok === false) {
          return done({
            ok: false,
            statusCode: (urlValidation as any).statusCode,
            error: (urlValidation as any).error,
          });
        }

        const { hostname, hostHeader, path } = urlValidation;

        resolveSafeExternalHost(hostname, { signal: options?.signal })
          .then((dnsResult) => {
            if (finished) return;

            if (options?.signal?.aborted) {
              return done({ ok: false, statusCode: 504, error: "SOURCE_TIMEOUT" });
            }

            if (!dnsResult.ok) {
              return done({
                ok: false,
                statusCode: dnsResult.statusCode,
                error: dnsResult.error,
              });
            }

            const { selectedAddress } = dnsResult;
            if (!selectedAddress) {
              return done({
                ok: false,
                statusCode: 502,
                error: "SOURCE_DNS_FAILED",
              });
            }

            const reqOptions: https.RequestOptions = {
              protocol: "https:",
              method: "GET",
              hostname: hostname,
              port: 443,
              path: path,
              servername: hostname,
              headers: {
                "Accept": "text/html, application/xhtml+xml, text/plain",
                "Accept-Encoding": "identity",
                "User-Agent": "MusicScale-SafeExternalFetch/1.0",
                "Host": hostHeader,
              },
              lookup: (hn: string, opts: any, callback?: any) => {
                const cb = typeof opts === "function" ? opts : callback;
                if (typeof cb !== "function") {
                  return;
                }
                if (hn !== hostname) {
                  cb(new Error("SAFE_LOOKUP_HOST_MISMATCH"));
                  return;
                }
                cb(null, selectedAddress.address, selectedAddress.family);
              },
            };

            req = requestHttps(reqOptions, (response) => {
              res = response;

              if (finished) return;

              if (options?.signal?.aborted) {
                try {
                  res.destroy();
                } catch {}
                try {
                  req.destroy();
                } catch {}
                return done({ ok: false, statusCode: 504, error: "SOURCE_TIMEOUT" });
              }

              const status = response.statusCode || 0;

              if (
                status === 301 ||
                status === 302 ||
                status === 303 ||
                status === 307 ||
                status === 308
              ) {
                try {
                  res.destroy();
                } catch {}
                try {
                  req.destroy();
                } catch {}

                const locationHeader = response.headers.location;
                if (!locationHeader || typeof locationHeader !== "string") {
                  return done({
                    ok: false,
                    statusCode: 502,
                    error: "SOURCE_HTTP_ERROR",
                  });
                }

                return done({
                  ok: false,
                  statusCode: status as any,
                  error: "SOURCE_REDIRECT",
                  location: locationHeader,
                });
              }

              if (status < 200 || status >= 300) {
                try {
                  res.destroy();
                } catch {}
                try {
                  req.destroy();
                } catch {}
                return done({
                  ok: false,
                  statusCode: 502,
                  error: "SOURCE_HTTP_ERROR",
                });
              }

              const contentTypeHeader = response.headers["content-type"];
              if (!contentTypeHeader) {
                try {
                  res.destroy();
                } catch {}
                try {
                  req.destroy();
                } catch {}
                return done({
                  ok: false,
                  statusCode: 415,
                  error: "SOURCE_UNSUPPORTED_CONTENT_TYPE",
                });
              }

              const rawContentType = Array.isArray(contentTypeHeader)
                ? contentTypeHeader[0]
                : contentTypeHeader;
              const mediaType = (rawContentType || "")
                .split(";")[0]
                .trim()
                .toLowerCase();

              if (
                mediaType !== "text/html" &&
                mediaType !== "application/xhtml+xml" &&
                mediaType !== "text/plain"
              ) {
                try {
                  res.destroy();
                } catch {}
                try {
                  req.destroy();
                } catch {}
                return done({
                  ok: false,
                  statusCode: 415,
                  error: "SOURCE_UNSUPPORTED_CONTENT_TYPE",
                });
              }

              const contentEncodingHeader = response.headers["content-encoding"];
              if (contentEncodingHeader) {
                const encoding = (
                  Array.isArray(contentEncodingHeader)
                    ? contentEncodingHeader[0]
                    : contentEncodingHeader
                )
                  .trim()
                  .toLowerCase();
                if (encoding !== "identity" && encoding !== "") {
                  try {
                    res.destroy();
                  } catch {}
                  try {
                    req.destroy();
                  } catch {}
                  return done({
                    ok: false,
                    statusCode: 415,
                    error: "SOURCE_UNSUPPORTED_ENCODING",
                  });
                }
              }

              const contentLengthHeader = response.headers["content-length"];
              if (contentLengthHeader !== undefined) {
                const rawLen = Array.isArray(contentLengthHeader)
                  ? contentLengthHeader[0]
                  : contentLengthHeader;
                if (rawLen === undefined || rawLen === null) {
                  try {
                    res.destroy();
                  } catch {}
                  try {
                    req.destroy();
                  } catch {}
                  return done({
                    ok: false,
                    statusCode: 502,
                    error: "SOURCE_FETCH_FAILED",
                  });
                }

                const normalizedLength = String(rawLen).trim();
                if (!/^(0|[1-9]\d*)$/.test(normalizedLength)) {
                  try {
                    res.destroy();
                  } catch {}
                  try {
                    req.destroy();
                  } catch {}
                  return done({
                    ok: false,
                    statusCode: 502,
                    error: "SOURCE_FETCH_FAILED",
                  });
                }

                const parsedLen = Number(normalizedLength);
                if (!Number.isSafeInteger(parsedLen)) {
                  try {
                    res.destroy();
                  } catch {}
                  try {
                    req.destroy();
                  } catch {}
                  return done({
                    ok: false,
                    statusCode: 502,
                    error: "SOURCE_FETCH_FAILED",
                  });
                }

                if (parsedLen > 2 * 1024 * 1024) {
                  try {
                    res.destroy();
                  } catch {}
                  try {
                    req.destroy();
                  } catch {}
                  return done({
                    ok: false,
                    statusCode: 413,
                    error: "SOURCE_TOO_LARGE",
                  });
                }
              }

              let receivedBytes = 0;
              const chunks: Buffer[] = [];

              response.on("data", (chunk: any) => {
                if (finished) return;

                let buf: Buffer;
                if (Buffer.isBuffer(chunk)) {
                  buf = chunk;
                } else if (typeof chunk === "string") {
                  buf = Buffer.from(chunk, "utf8");
                } else {
                  try {
                    res.destroy();
                  } catch {}
                  try {
                    req.destroy();
                  } catch {}
                  return done({
                    ok: false,
                    statusCode: 502,
                    error: "SOURCE_FETCH_FAILED",
                  });
                }

                receivedBytes += buf.length;
                if (receivedBytes > 2 * 1024 * 1024) {
                  try {
                    res.destroy();
                  } catch {}
                  try {
                    req.destroy();
                  } catch {}
                  return done({
                    ok: false,
                    statusCode: 413,
                    error: "SOURCE_TOO_LARGE",
                  });
                }
                chunks.push(buf);
              });

              response.on("end", () => {
                if (finished) return;
                const bodyBuffer = Buffer.concat(chunks);
                const bodyString = bodyBuffer.toString("utf8");
                return done({
                  ok: true,
                  body: bodyString,
                  statusCode: status,
                  contentType: mediaType as any,
                  hostname: hostname,
                  bytes: bodyBuffer.length,
                });
              });

              response.on("error", () => {
                try {
                  res.destroy();
                } catch {}
                try {
                  req.destroy();
                } catch {}
                return done({
                  ok: false,
                  statusCode: 502,
                  error: "SOURCE_FETCH_FAILED",
                });
              });
            });

            req.on("error", () => {
              try {
                req.destroy();
              } catch {}
              if (res) {
                try {
                  res.destroy();
                } catch {}
              }
              return done({
                ok: false,
                statusCode: 502,
                error: "SOURCE_FETCH_FAILED",
              });
            });

            req.end();
          })
          .catch(() => {
            if (req) {
              try {
                req.destroy();
              } catch {}
            }
            if (res) {
              try {
                res.destroy();
              } catch {}
            }
            return done({
              ok: false,
              statusCode: 502,
              error: "SOURCE_FETCH_FAILED",
            });
          });
      } catch {
        if (req) {
          try {
            req.destroy();
          } catch {}
        }
        if (res) {
          try {
            res.destroy();
          } catch {}
        }
        return done({
          ok: false,
          statusCode: 502,
          error: "SOURCE_FETCH_FAILED",
        });
      }
    });
  };
}
