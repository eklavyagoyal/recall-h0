import { EMBED_PROVIDER } from "@/lib/config";

export async function embed(texts: string[]): Promise<number[][]> {
  if (EMBED_PROVIDER === "bedrock") {
    const { embedBedrock } = await import("./bedrock");
    return embedBedrock(texts);
  }

  const { embedLocal } = await import("./local");
  return embedLocal(texts);
}

export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}
