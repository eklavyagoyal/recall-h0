type Bucket = {
  inFlight: number;
  tokens: number;
  updatedAt: number;
};

type AdmissionOptions = {
  route: string;
  request: Request;
  maxConcurrentPerIp: number;
  maxGlobalConcurrent: number;
  burst: number;
  refillPerSecond: number;
};

type Admission =
  | { ok: true; release: () => void; ip: string }
  | { ok: false; response: Response; ip: string };

const buckets = new Map<string, Bucket>();
const globalInFlight = new Map<string, number>();

export function admitExpensiveRoute(options: AdmissionOptions): Admission {
  const ip = clientIp(options.request);
  const bucketKey = `${options.route}:${ip}`;
  const now = Date.now();
  const bucket = refillBucket(buckets.get(bucketKey), now, options);
  buckets.set(bucketKey, bucket);

  if ((globalInFlight.get(options.route) ?? 0) >= options.maxGlobalConcurrent) {
    return {
      ok: false,
      ip,
      response: rejection(503, "route_saturated", "Trace capacity is saturated; retry shortly."),
    };
  }

  if (bucket.inFlight >= options.maxConcurrentPerIp) {
    return {
      ok: false,
      ip,
      response: rejection(429, "too_many_concurrent_requests", "A trace is already running for this client."),
    };
  }

  if (bucket.tokens < 1) {
    return {
      ok: false,
      ip,
      response: rejection(429, "rate_limited", "Too many trace requests; retry shortly."),
    };
  }

  bucket.tokens -= 1;
  bucket.inFlight += 1;
  globalInFlight.set(options.route, (globalInFlight.get(options.route) ?? 0) + 1);

  let released = false;
  return {
    ok: true,
    ip,
    release: () => {
      if (released) return;
      released = true;
      bucket.inFlight = Math.max(0, bucket.inFlight - 1);
      globalInFlight.set(options.route, Math.max(0, (globalInFlight.get(options.route) ?? 0) - 1));
    },
  };
}

export function resetAdmissionStateForTests(): void {
  buckets.clear();
  globalInFlight.clear();
}

function refillBucket(
  current: Bucket | undefined,
  now: number,
  options: Pick<AdmissionOptions, "burst" | "refillPerSecond">,
): Bucket {
  if (!current) return { inFlight: 0, tokens: options.burst, updatedAt: now };
  const elapsedSeconds = Math.max(0, (now - current.updatedAt) / 1000);
  current.tokens = Math.min(options.burst, current.tokens + elapsedSeconds * options.refillPerSecond);
  current.updatedAt = now;
  return current;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function rejection(status: number, error: string, message: string): Response {
  return Response.json(
    { error, message, retryable: true },
    { status, headers: { "Cache-Control": "no-store", "Retry-After": "2" } },
  );
}
