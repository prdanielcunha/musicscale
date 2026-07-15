import { resolve4 as defaultResolve4, resolve6 as defaultResolve6 } from "node:dns/promises";
import { isIPv4, isIPv6 } from "node:net";
import { validateExternalIpAddress } from "./safeExternalUrlPolicy.js";

export type SafeResolvedAddress = {
  address: string;
  family: 4 | 6;
};

export type SafeExternalDnsSuccess = {
  ok: true;
  hostname: string;
  addresses: SafeResolvedAddress[];
  selectedAddress: SafeResolvedAddress;
};

export type SafeExternalDnsFailure = {
  ok: false;
  statusCode: 403 | 502 | 504;
  error: "UNSAFE_SOURCE_URL" | "SOURCE_DNS_FAILED" | "SOURCE_TIMEOUT";
};

export type SafeExternalDnsResult = SafeExternalDnsSuccess | SafeExternalDnsFailure;

export interface SafeExternalDnsResolverOptions {
  resolve4?: (hostname: string) => Promise<string[]>;
  resolve6?: (hostname: string) => Promise<string[]>;
}

export function createSafeExternalDnsResolver(deps: SafeExternalDnsResolverOptions = {}) {
  const resolve4 = deps.resolve4 || defaultResolve4;
  const resolve6 = deps.resolve6 || defaultResolve6;

  return async function resolveSafeExternalHost(
    hostname: unknown,
    options?: { signal?: AbortSignal }
  ): Promise<SafeExternalDnsResult> {
    let abortListener: (() => void) | undefined;
    let isAborted = false;

    const cleanup = () => {
      if (options?.signal && abortListener) {
        options.signal.removeEventListener("abort", abortListener);
      }
    };

    try {
      if (options?.signal?.aborted) {
        return { ok: false, statusCode: 504, error: "SOURCE_TIMEOUT" };
      }

      if (typeof hostname !== "string") {
        return { ok: false, statusCode: 502, error: "SOURCE_DNS_FAILED" };
      }

      let cleaned = hostname.trim();
      if (!cleaned) {
        return { ok: false, statusCode: 502, error: "SOURCE_DNS_FAILED" };
      }

      cleaned = cleaned.toLowerCase();

      if (cleaned.endsWith(".")) {
        cleaned = cleaned.slice(0, -1);
      }

      if (!cleaned || cleaned.includes("/") || cleaned.includes("?") || cleaned.includes("#") || /\s/.test(cleaned) || cleaned.includes("@")) {
        return { ok: false, statusCode: 502, error: "SOURCE_DNS_FAILED" };
      }

      if (cleaned.includes(":")) {
        let isV6 = isIPv6(cleaned);
        if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
          const withoutBrackets = cleaned.slice(1, -1);
          if (isIPv6(withoutBrackets)) {
            cleaned = withoutBrackets;
            isV6 = true;
          }
        }
        if (!isV6) {
          return { ok: false, statusCode: 502, error: "SOURCE_DNS_FAILED" };
        }
      }

      if (isIPv4(cleaned) || isIPv6(cleaned)) {
        const validation = validateExternalIpAddress(cleaned);
        if (!validation.ok) {
          return { ok: false, statusCode: 403, error: "UNSAFE_SOURCE_URL" };
        }
        
        let normalizedAddr = validation.address;
        if (validation.family === 6) {
          try {
            normalizedAddr = new URL(`http://[${normalizedAddr}]`).hostname.slice(1, -1);
          } catch {}
        }

        const addr: SafeResolvedAddress = {
          address: normalizedAddr,
          family: validation.family
        };
        return {
          ok: true,
          hostname: cleaned,
          addresses: [addr],
          selectedAddress: addr
        };
      }

      const abortPromise = new Promise<SafeExternalDnsResult>((resolve) => {
        if (!options?.signal) return;
        abortListener = () => {
          isAborted = true;
          resolve({ ok: false, statusCode: 504, error: "SOURCE_TIMEOUT" });
        };
        options.signal.addEventListener("abort", abortListener);
      });

      if (options?.signal?.aborted) {
        isAborted = true;
        return { ok: false, statusCode: 504, error: "SOURCE_TIMEOUT" };
      }

      const settleFamily = async (
        resolver: (hostname: string) => Promise<string[]>
      ): Promise<{ addresses: string[] | null; error: any }> => {
        try {
          return { addresses: await resolver(cleaned), error: null };
        } catch (error) {
          return { addresses: null, error };
        }
      };

      const runDns = async (): Promise<SafeExternalDnsResult> => {
        const [res4, res6] = await Promise.all([
          settleFamily(resolve4),
          settleFamily(resolve6)
        ]);

        if (isAborted) {
          return { ok: false, statusCode: 504, error: "SOURCE_TIMEOUT" };
        }

        const isIgnorableError = (err: any) => {
          if (!err) return false;
          const code = err.code;
          return code === "ENOTFOUND" || code === "ENODATA" || code === "EAI_NONAME";
        };

        if (res4.error && !isIgnorableError(res4.error)) {
          return { ok: false, statusCode: 502, error: "SOURCE_DNS_FAILED" };
        }
        if (res6.error && !isIgnorableError(res6.error)) {
          return { ok: false, statusCode: 502, error: "SOURCE_DNS_FAILED" };
        }

        const pAddrs4 = res4.addresses || [];
        const pAddrs6 = res6.addresses || [];

        if (!Array.isArray(pAddrs4) || !Array.isArray(pAddrs6)) {
          return { ok: false, statusCode: 502, error: "SOURCE_DNS_FAILED" };
        }

        if (pAddrs4.length === 0 && pAddrs6.length === 0) {
          return { ok: false, statusCode: 502, error: "SOURCE_DNS_FAILED" };
        }

        const rawAddrs = [
          ...pAddrs4.map((a: any) => ({ address: a, expectedFamily: 4 })),
          ...pAddrs6.map((a: any) => ({ address: a, expectedFamily: 6 }))
        ];

        if (rawAddrs.length > 32) {
          return { ok: false, statusCode: 502, error: "SOURCE_DNS_FAILED" };
        }

        const validatedAddresses: SafeResolvedAddress[] = [];
        for (const item of rawAddrs) {
          if (typeof item.address !== "string" || !item.address) {
            return { ok: false, statusCode: 502, error: "SOURCE_DNS_FAILED" };
          }
          
          const familyCheck = isIPv4(item.address) ? 4 : (isIPv6(item.address) ? 6 : 0);
          if (familyCheck !== item.expectedFamily) {
            return { ok: false, statusCode: 502, error: "SOURCE_DNS_FAILED" };
          }

          const validation = validateExternalIpAddress(item.address);
          if (!validation.ok) {
             return { ok: false, statusCode: 403, error: "UNSAFE_SOURCE_URL" };
          }
          
          let normalizedAddr = validation.address;
          if (validation.family === 6) {
            try {
              normalizedAddr = new URL(`http://[${normalizedAddr}]`).hostname.slice(1, -1);
            } catch {}
          }

          validatedAddresses.push({
            address: normalizedAddr,
            family: validation.family
          });
        }

        const uniqueMap = new Map<string, SafeResolvedAddress>();
        for (const addr of validatedAddresses) {
          const key = `${addr.family}-${addr.address}`;
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, addr);
          }
        }

        const finalAddresses = Array.from(uniqueMap.values());
        if (finalAddresses.length === 0) {
          return { ok: false, statusCode: 502, error: "SOURCE_DNS_FAILED" };
        }

        finalAddresses.sort((a, b) => {
          if (a.family !== b.family) {
            return a.family - b.family;
          }
          return a.address.localeCompare(b.address);
        });

        return {
          ok: true,
          hostname: cleaned,
          addresses: finalAddresses,
          selectedAddress: finalAddresses[0]
        };
      };

      if (options?.signal) {
        return await Promise.race([runDns(), abortPromise]);
      }
      return await runDns();
    } catch {
      return { ok: false, statusCode: 502, error: "SOURCE_DNS_FAILED" };
    } finally {
      cleanup();
    }
  };
}
