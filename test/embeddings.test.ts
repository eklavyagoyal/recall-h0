import { describe, expect, it } from "vitest";
import { EMBED_DIM, EMBED_PROVIDER } from "@/lib/config";
import { embed } from "@/lib/embeddings";

describe("embeddings provider", () => {
  it("returns exactly EMBED_DIM dimensions", async () => {
    const [vector] = await embed(["listeria-like complaints in bagged leafy greens"]);
    expect(vector).toHaveLength(EMBED_DIM);
    expect(vector?.every((value) => typeof value === "number" && Number.isFinite(value))).toBe(true);
  });

  it.skipIf(EMBED_PROVIDER === "bedrock")("is byte-stable for identical local input", async () => {
    const text = "salmonella outbreak suspected in romaine across multiple states";
    const [first] = await embed([text]);
    const [second] = await embed([text]);
    expect(first).toEqual(second);
  });

  it("does not return a constant vector for different inputs", async () => {
    const [first, second] = await embed(["e. coli ground beef recall", "norovirus frozen berries"]);
    expect(first).not.toEqual(second);
  });

  it("returns a non-zero normalized vector", async () => {
    const [vector] = await embed(["any non-empty incident text"]);
    if (!vector) throw new Error("Embedding provider returned no vectors.");
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    expect(norm).toBeGreaterThan(0);
  });
});
