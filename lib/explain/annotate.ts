export type ExplainTag = "recursive-union" | "hnsw" | "gist";

export type AnnotatedLine = {
  index: number;
  text: string;
  depth: number;
  tag: ExplainTag | null;
};

export type ExplainNode = {
  type: string;
  detail: string;
  tag: ExplainTag;
  line: number;
};

export type AnnotatedPlan = {
  lines: AnnotatedLine[];
  nodes: ExplainNode[];
  found: Record<ExplainTag, boolean>;
};

const labels: Record<ExplainTag, string> = {
  "recursive-union": "Recursive Union",
  hnsw: "HNSW Index Scan",
  gist: "GiST Spatial Path",
};

const tagOrder: ExplainTag[] = ["recursive-union", "hnsw", "gist"];

const matchers: { tag: ExplainTag; test: (line: string) => boolean }[] = [
  {
    tag: "recursive-union",
    test: (line) => /recursive union/i.test(line),
  },
  {
    tag: "hnsw",
    test: (line) =>
      /idx_incidents_hnsw/i.test(line) ||
      (/index scan/i.test(line) && /incidents/i.test(line)) ||
      (/order by/i.test(line) && /<=>/.test(line)),
  },
  {
    tag: "gist",
    test: (line) =>
      /idx_stores_geom/i.test(line) ||
      (/index scan|bitmap (index|heap) scan/i.test(line) &&
        /stores/i.test(line) &&
        /(st_|geom|&&|@>|<->)/i.test(line)),
  },
];

function lineDepth(rawLine: string): number {
  return Math.floor((rawLine.length - rawLine.trimStart().length) / 3);
}

export function annotateExplain(planText: string): AnnotatedPlan {
  const found: Record<ExplainTag, boolean> = {
    "recursive-union": false,
    hnsw: false,
    gist: false,
  };
  const nodes: ExplainNode[] = [];

  const lines = planText.replace(/\r\n/g, "\n").split("\n").map((text, index) => {
    const trimmed = text.trim();
    let tag: ExplainTag | null = null;

    for (const matcher of matchers) {
      if (!found[matcher.tag] && matcher.test(trimmed)) {
        tag = matcher.tag;
        found[matcher.tag] = true;
        nodes.push({
          type: labels[matcher.tag],
          detail: trimmed,
          tag,
          line: index,
        });
        break;
      }
    }

    return { index, text, depth: lineDepth(text), tag };
  });

  nodes.sort((left, right) => tagOrder.indexOf(left.tag) - tagOrder.indexOf(right.tag));

  return { lines, nodes, found };
}

export function explainNodes(planText: string): { type: string; detail: string }[] {
  return annotateExplain(planText).nodes.map((node) => ({
    type: node.type,
    detail: node.detail,
  }));
}
