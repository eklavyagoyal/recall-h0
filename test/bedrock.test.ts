import { describe, expect, it } from "vitest";
import {
  bedrockClientConfig,
  bedrockRequestHandler,
  EmbeddingUnavailableError,
  withEmbeddingDeadline,
} from "@/lib/embeddings/bedrock";

describe("Bedrock embedding reliability bounds", () => {
  it("uses bounded SDK retries and bounded HTTP waits", () => {
    expect(bedrockClientConfig.maxAttempts).toBe(3);
    expect(bedrockClientConfig.retryMode).toBe("adaptive");
    expect(bedrockClientConfig.requestHandler).toBe(bedrockRequestHandler);
  });

  it("rejects with a typed provider error when the deadline wins", async () => {
    await expect(
      withEmbeddingDeadline(new Promise(() => undefined), 1, "embedding deadline exceeded"),
    ).rejects.toMatchObject({
      name: "EmbeddingUnavailableError",
      dependency: "bedrock",
      message: "embedding deadline exceeded",
    });
  });

  it("returns the embedding response when the provider wins the race", async () => {
    await expect(withEmbeddingDeadline(Promise.resolve([1, 2, 3]), 100)).resolves.toEqual([
      1, 2, 3,
    ]);
  });

  it("exposes a stable typed error for degraded trace fallback", () => {
    expect(new EmbeddingUnavailableError("down")).toMatchObject({
      name: "EmbeddingUnavailableError",
      dependency: "bedrock",
      message: "down",
    });
  });
});
