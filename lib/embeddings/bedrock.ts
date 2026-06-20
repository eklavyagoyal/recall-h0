import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { AWS_REGION, BEDROCK_MODEL_ID, EMBED_DIM } from "@/lib/config";

const client = new BedrockRuntimeClient({ region: AWS_REGION });

type TitanEmbeddingResponse = {
  embedding: number[];
};

async function embedOne(text: string): Promise<number[]> {
  const command = new InvokeModelCommand({
    modelId: BEDROCK_MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({ inputText: text, dimensions: EMBED_DIM, normalize: true }),
  });

  const response = await client.send(command);
  const parsed = JSON.parse(new TextDecoder().decode(response.body)) as TitanEmbeddingResponse;

  if (parsed.embedding.length !== EMBED_DIM) {
    throw new Error(
      `Bedrock returned dim ${parsed.embedding.length} !== EMBED_DIM ${EMBED_DIM}. Set EMBED_DIM to match Titan v2 and re-migrate.`,
    );
  }

  return parsed.embedding;
}

export async function embedBedrock(texts: string[]): Promise<number[][]> {
  const concurrency = 8;
  const out: number[][] = new Array<number[]>(texts.length);

  for (let offset = 0; offset < texts.length; offset += concurrency) {
    const slice = texts.slice(offset, offset + concurrency);
    const vectors = await Promise.all(slice.map(embedOne));
    vectors.forEach((vector, index) => {
      out[offset + index] = vector;
    });
  }

  return out;
}
