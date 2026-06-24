import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMBED_DIM } from "@/lib/config";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  embed: vi.fn(),
  poolQuery: vi.fn(),
}));

vi.mock("@/lib/db/pool", () => ({
  pool: {
    connect: mocks.connect,
    query: mocks.poolQuery,
  },
}));

vi.mock("@/lib/embeddings", () => ({
  embed: mocks.embed,
  toVectorLiteral: (vector: number[]) => `[${vector.join(",")}]`,
}));

type TraceClient = {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
};

function zeroVector(): number[] {
  return new Array<number>(EMBED_DIM).fill(0);
}

function serializationError(): Error & { code: string } {
  return Object.assign(new Error("serialization failure"), { code: "40001" });
}

function rawRow() {
  return {
    lot_count: 1,
    edges: null,
    stores: null,
    total_units: 0,
    store_count: 0,
    incidents: null,
  };
}

function makeClient(
  runTraceSql: (params: unknown[]) => Promise<unknown> | unknown,
): TraceClient {
  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    if (
      sql === "BEGIN ISOLATION LEVEL SERIALIZABLE" ||
      sql === "COMMIT" ||
      sql === "ROLLBACK" ||
      sql.startsWith("SET LOCAL")
    ) {
      return { rows: [] };
    }
    if (sql.includes("WITH RECURSIVE")) {
      return runTraceSql(params ?? []);
    }
    throw new Error(`Unexpected query in trace retry test: ${sql}`);
  });
  return { query, release: vi.fn() };
}

describe("runTrace retry and embedding degradation", () => {
  beforeEach(() => {
    mocks.connect.mockReset();
    mocks.embed.mockReset();
    mocks.poolQuery.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("backs off and retries serialization failures before succeeding", async () => {
    const delays: number[] = [];
    const first = makeClient(async () => {
      throw serializationError();
    });
    const second = makeClient(async () => {
      throw serializationError();
    });
    const third = makeClient(async () => ({ rows: [rawRow()] }));
    mocks.connect.mockResolvedValueOnce(first).mockResolvedValueOnce(second).mockResolvedValueOnce(third);

    const { runTrace } = await import("@/lib/db/queries/trace");
    const result = await runTrace("PRD-OUTBREAK-0001", {
      queryEmbedding: zeroVector(),
      retryDelay: async (ms) => {
        delays.push(ms);
      },
      retryRandom: () => 0,
    });

    expect(delays).toEqual([40, 80]);
    expect(mocks.connect).toHaveBeenCalledTimes(3);
    expect(first.release).toHaveBeenCalledOnce();
    expect(second.release).toHaveBeenCalledOnce();
    expect(third.release).toHaveBeenCalledOnce();
    expect(result.meta).toMatchObject({ lotCount: 1, edgeCount: 0, storeCount: 0, totalUnits: 0 });
  });

  it("throws after the retry budget is exhausted", async () => {
    const delays: number[] = [];
    mocks.connect
      .mockResolvedValueOnce(
        makeClient(async () => {
          throw serializationError();
        }),
      )
      .mockResolvedValueOnce(
        makeClient(async () => {
          throw serializationError();
        }),
      )
      .mockResolvedValueOnce(
        makeClient(async () => {
          throw serializationError();
        }),
      );

    const { runTrace } = await import("@/lib/db/queries/trace");
    await expect(
      runTrace("PRD-OUTBREAK-0001", {
        queryEmbedding: zeroVector(),
        retryDelay: async (ms) => {
          delays.push(ms);
        },
        retryRandom: () => 0,
      }),
    ).rejects.toMatchObject({ code: "40001" });

    expect(delays).toEqual([40, 80]);
    expect(mocks.connect).toHaveBeenCalledTimes(3);
  });

  it("degrades unavailable Bedrock embeddings to a zero vector", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let traceParams: unknown[] = [];
    mocks.poolQuery.mockResolvedValueOnce({ rows: [{ product_name: "Romaine Lettuce" }] });
    mocks.embed.mockRejectedValueOnce(
      Object.assign(new Error("Bedrock unavailable"), {
        name: "EmbeddingUnavailableError",
        dependency: "bedrock",
      }),
    );
    mocks.connect.mockResolvedValueOnce(
      makeClient(async (params) => {
        traceParams = params;
        return { rows: [rawRow()] };
      }),
    );

    const { runTrace } = await import("@/lib/db/queries/trace");
    await expect(runTrace("PRD-OUTBREAK-0001")).resolves.toMatchObject({
      meta: { lotCount: 1 },
    });

    expect(mocks.poolQuery).toHaveBeenCalledWith("SELECT product_name FROM lots WHERE tlc = $1", [
      "PRD-OUTBREAK-0001",
    ]);
    expect(mocks.embed).toHaveBeenCalledWith(["Romaine Lettuce"]);
    expect(traceParams[1]).toBe(`[${zeroVector().join(",")}]`);
    const [line] = logged.mock.calls[0] ?? [];
    expect(JSON.parse(String(line))).toMatchObject({
      level: "error",
      event: "embedding.degraded",
      dependency: "bedrock",
      failureClass: "dependency_error",
      error: {
        name: "EmbeddingUnavailableError",
        message: "Bedrock unavailable",
      },
    });
  });
});
