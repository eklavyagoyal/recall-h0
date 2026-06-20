import { EMBED_DIM } from "@/lib/config";

type FeatureExtractionPipeline = (
  texts: string[],
  options: { pooling: "mean"; normalize: boolean },
) => Promise<{ tolist: () => number[][] }>;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const transformers = await import("@xenova/transformers");
      transformers.env.allowLocalModels = true;
      transformers.env.useBrowserCache = false;
      return transformers.pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
      ) as Promise<FeatureExtractionPipeline>;
    })();
  }

  return extractorPromise;
}

export async function embedLocal(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const extractor = await getExtractor();
  const output = await extractor(texts, { pooling: "mean", normalize: true });
  const vectors = output.tolist();
  const first = vectors[0];

  if (first && first.length !== EMBED_DIM) {
    throw new Error(
      `Local embedding dim ${first.length} !== EMBED_DIM ${EMBED_DIM}. Set EMBED_DIM=384 for local embeddings.`,
    );
  }

  return vectors;
}
