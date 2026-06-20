import { describe, expect, it } from "vitest";
import { annotateExplain } from "@/lib/explain/annotate";

const sample = `
Result  (cost=22701.78..22701.79 rows=1 width=144) (actual time=186.136..186.147 rows=1 loops=1)
  CTE contaminated
    ->  Recursive Union  (cost=0.42..193.04 rows=171 width=44) (actual time=0.077..0.494 rows=83 loops=1)
          ->  Index Scan using lots_tlc_key on lots l  (actual time=0.075..0.078 rows=1 loops=1)
          ->  Nested Loop  (actual time=0.163..0.190 rows=41 loops=2)
                ->  Index Only Scan using lot_links_pkey on lot_links ll  (actual time=0.003..0.003 rows=1 loops=83)
  CTE spatial_stores
    ->  Index Scan using idx_stores_geom on stores s  (actual time=0.160..3.834 rows=1400 loops=1)
  InitPlan 11
    ->  Aggregate  (actual time=0.394..0.394 rows=1 loops=1)
          ->  Limit  (actual time=0.370..0.381 rows=5 loops=1)
                ->  Index Scan using idx_incidents_hnsw on incidents i  (actual time=0.366..0.375 rows=5 loops=1)
                      Order By: (embedding <=> '[...]'::vector)
Planning Time: 5.182 ms
Execution Time: 190.342 ms
`.trim();

describe("annotateExplain", () => {
  it("finds the three hero nodes", () => {
    const annotated = annotateExplain(sample);
    expect(annotated.found["recursive-union"]).toBe(true);
    expect(annotated.found.hnsw).toBe(true);
    expect(annotated.found.gist).toBe(true);
    expect(annotated.nodes.map((node) => node.type)).toEqual([
      "Recursive Union",
      "HNSW Index Scan",
      "GiST Spatial Path",
    ]);
  });

  it("anchors each tag once", () => {
    const tagged = annotateExplain(sample).lines.filter((line) => line.tag);
    expect(tagged.filter((line) => line.tag === "recursive-union")).toHaveLength(1);
    expect(tagged.filter((line) => line.tag === "hnsw")).toHaveLength(1);
    expect(tagged.filter((line) => line.tag === "gist")).toHaveLength(1);
  });

  it("preserves the original line count", () => {
    expect(annotateExplain(sample).lines).toHaveLength(sample.split("\n").length);
  });

  it("reports missing nodes without throwing", () => {
    const annotated = annotateExplain("Seq Scan on lots  (actual time=1.0..2.0 rows=1)");
    expect(annotated.found["recursive-union"]).toBe(false);
    expect(annotated.found.hnsw).toBe(false);
    expect(annotated.found.gist).toBe(false);
    expect(annotated.nodes).toEqual([]);
  });
});
