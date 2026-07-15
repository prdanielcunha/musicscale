export type SafeExternalFetchResultLike =
  | {
      ok: true;
      body: string;
      statusCode: number;
      contentType: "text/html" | "application/xhtml+xml" | "text/plain";
      hostname: string;
      bytes: number;
      redirectsFollowed: number;
      timedOut: false;
    }
  | {
      ok: false;
      statusCode: number;
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

export function mapSafeExternalFetchErrorToAiImportResponse(
  safeFetchResult: any,
  makeErrorResponse: (
    code: "VALIDATION" | "SCRAPING" | "PARSING" | "GEMINI" | "TIMEOUT" | "UNKNOWN",
    message: string,
    details?: any,
    step?: string
  ) => any
): any {
  const err = safeFetchResult?.error;
  switch (err) {
    case "INVALID_SOURCE_URL":
      return makeErrorResponse(
        "VALIDATION",
        "O link informado não é um endereço de internet válido.",
        null,
        "2_URL_NORMALIZATION"
      );
    case "UNSAFE_SOURCE_URL":
      return makeErrorResponse(
        "VALIDATION",
        "O link informado não é permitido por segurança.",
        null,
        "3_NETWORK_FETCH"
      );
    case "SOURCE_TIMEOUT":
      return makeErrorResponse(
        "TIMEOUT",
        "Não foi possível conectar ao site informado. A página demorou muito para responder.",
        { timedOut: safeFetchResult.timedOut === true },
        "3_NETWORK_FETCH"
      );
    case "SOURCE_DNS_FAILED":
      return makeErrorResponse(
        "SCRAPING",
        "Não foi possível resolver o endereço do site informado.",
        null,
        "3_NETWORK_FETCH"
      );
    case "SOURCE_HTTP_ERROR":
      return makeErrorResponse(
        "SCRAPING",
        "O site informado retornou um erro de carregamento.",
        null,
        "3_NETWORK_FETCH"
      );
    case "SOURCE_UNSUPPORTED_CONTENT_TYPE":
      return makeErrorResponse(
        "SCRAPING",
        "O site informado não retornou uma página textual compatível.",
        null,
        "3_NETWORK_FETCH"
      );
    case "SOURCE_UNSUPPORTED_ENCODING":
      return makeErrorResponse(
        "SCRAPING",
        "O site informado retornou um formato de compressão não suportado.",
        null,
        "3_NETWORK_FETCH"
      );
    case "SOURCE_TOO_LARGE":
      return makeErrorResponse(
        "SCRAPING",
        "A página informada é grande demais para importação automática.",
        null,
        "3_NETWORK_FETCH"
      );
    case "SOURCE_REDIRECT_LIMIT":
      return makeErrorResponse(
        "SCRAPING",
        "O site informado redirecionou muitas vezes.",
        null,
        "3_NETWORK_FETCH"
      );
    case "SOURCE_REDIRECT_LOOP":
      return makeErrorResponse(
        "SCRAPING",
        "O site informado entrou em um ciclo de redirecionamento.",
        null,
        "3_NETWORK_FETCH"
      );
    case "SOURCE_UNSAFE_REDIRECT":
      return makeErrorResponse(
        "VALIDATION",
        "O link informado redireciona para um destino não permitido por segurança.",
        null,
        "3_NETWORK_FETCH"
      );
    case "SOURCE_FETCH_FAILED":
    default:
      return makeErrorResponse(
        "SCRAPING",
        "Incapaz de acessar a página. Verifique se o link está acessível ou se há instabilidade de rede.",
        null,
        "3_NETWORK_FETCH"
      );
  }
}

export async function fetchAiImportHtmlSafely(
  normalizedUrlStr: string,
  dependencies: {
    safeExternalFetch: (
      rawUrl: unknown,
      options?: {
        timeoutMs?: number;
        maxRedirects?: number;
      }
    ) => Promise<SafeExternalFetchResultLike>;

    makeErrorResponse: (
      code: "VALIDATION" | "SCRAPING" | "PARSING" | "GEMINI" | "TIMEOUT" | "UNKNOWN",
      message: string,
      details?: any,
      step?: string
    ) => any;

    logInfo?: (step: string, msg: string, data?: any) => void;
    logWarn?: (step: string, msg: string, data?: any) => void;
  }
): Promise<
  | {
      ok: true;
      html: string;
    }
  | {
      ok: false;
      response: any;
    }
> {
  const { safeExternalFetch, makeErrorResponse, logInfo, logWarn } = dependencies;

  try {
    const safeFetchResult = await safeExternalFetch(normalizedUrlStr, {
      timeoutMs: 8000,
      maxRedirects: 5
    });

    if (safeFetchResult.ok) {
      if (logInfo) {
        logInfo("3_NETWORK_FETCH", "Safe external fetch succeeded", {
          hostname: safeFetchResult.hostname,
          bytes: safeFetchResult.bytes,
          redirectsFollowed: safeFetchResult.redirectsFollowed,
          contentType: safeFetchResult.contentType
        });
      }
      return {
        ok: true,
        html: safeFetchResult.body
      };
    } else {
      const failedResult = safeFetchResult as any;
      if (logWarn) {
        logWarn("3_NETWORK_FETCH", "Safe external fetch failed", {
          error: failedResult.error,
          statusCode: failedResult.statusCode,
          timedOut: failedResult.timedOut === true
        });
      }
      const response = mapSafeExternalFetchErrorToAiImportResponse(safeFetchResult, makeErrorResponse);
      return {
        ok: false,
        response
      };
    }
  } catch (err: any) {
    if (logWarn) {
      logWarn("3_NETWORK_FETCH", "Safe external fetch failed", {
        error: "SOURCE_FETCH_FAILED",
        statusCode: 502,
        timedOut: false
      });
    }
    const response = makeErrorResponse(
      "SCRAPING",
      "Incapaz de acessar a página. Verifique se o link está acessível ou se há instabilidade de rede.",
      null,
      "3_NETWORK_FETCH"
    );
    return {
      ok: false,
      response
    };
  }
}
