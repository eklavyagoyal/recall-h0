"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type MutableRefObject,
} from "react";
import dynamic from "next/dynamic";
import type {
  ForceGraphMethods,
  ForceGraphProps,
  LinkObject,
  NodeObject,
} from "react-force-graph-2d";
import type { ConsoleSelection, Edge } from "@/lib/types";
import { PaneShell } from "./PaneShell";

type GraphNode = { id: number; depth: number };
type GraphLink = { source: number; target: number; transform: string; depth: number };
type ForceGraphRef = ForceGraphMethods<NodeObject<GraphNode>, LinkObject<GraphNode, GraphLink>>;
type ForceGraphComponent = ComponentType<
  ForceGraphProps<GraphNode, GraphLink> & {
    ref?: MutableRefObject<ForceGraphRef | undefined>;
  }
>;

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => <GraphSkeleton />,
}) as unknown as ForceGraphComponent;

function GraphSkeleton() {
  return (
    <div className="flex h-full min-h-[280px] w-full items-center justify-center bg-neutral-950">
      <div className="relative size-44 rounded-full border border-neutral-800">
        <div className="absolute inset-8 animate-pulse rounded-full border border-red-900/60" />
        <div className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 shadow-[0_0_16px_4px_rgba(239,68,68,0.45)]" />
      </div>
    </div>
  );
}

function LoadingVeil() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 border border-red-950/40 bg-neutral-950/20">
      <div className="h-1 w-full overflow-hidden bg-neutral-900">
        <div className="h-full w-1/2 animate-pulse bg-red-500/70" />
      </div>
    </div>
  );
}

function buildGraph(edges: Edge[]): {
  nodes: NodeObject<GraphNode>[];
  links: LinkObject<GraphNode, GraphLink>[];
  maxDepth: number;
} {
  if (edges.length === 0) return { nodes: [], links: [], maxDepth: 0 };

  const ids = new Set<number>();
  const childIds = new Set<number>();
  const adjacency = new Map<number, number[]>();

  for (const edge of edges) {
    ids.add(edge.parent);
    ids.add(edge.child);
    childIds.add(edge.child);
    const children = adjacency.get(edge.parent) ?? [];
    children.push(edge.child);
    adjacency.set(edge.parent, children);
  }

  const root = edges.find((edge) => !childIds.has(edge.parent))?.parent ?? edges[0]?.parent;
  const depth = new Map<number, number>();
  if (root !== undefined) {
    depth.set(root, 0);
    const queue = [root];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;
      const nextDepth = (depth.get(current) ?? 0) + 1;
      for (const child of adjacency.get(current) ?? []) {
        if (!depth.has(child)) {
          depth.set(child, nextDepth);
          queue.push(child);
        }
      }
    }
  }

  let maxDepth = 0;
  const nodes: NodeObject<GraphNode>[] = [...ids].map((id) => {
    const nodeDepth = depth.get(id) ?? 1;
    maxDepth = Math.max(maxDepth, nodeDepth);
    return { id, depth: nodeDepth };
  });

  const links: LinkObject<GraphNode, GraphLink>[] = edges.map((edge) => {
    const parentDepth = depth.get(edge.parent) ?? 0;
    const childDepth = depth.get(edge.child) ?? parentDepth + 1;
    return {
      source: edge.parent,
      target: edge.child,
      transform: edge.transform,
      depth: Math.max(parentDepth, childDepth),
    };
  });

  return { nodes, links, maxDepth };
}

export function GraphPane({
  edges,
  seedTlc,
  loading,
  onSelect,
}: {
  edges: Edge[];
  seedTlc: string;
  loading: boolean;
  onSelect?: (selection: ConsoleSelection) => void;
}) {
  const graphRef = useRef<ForceGraphRef | undefined>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [wave, setWave] = useState(0);
  const { nodes, links, maxDepth } = useMemo(() => buildGraph(edges), [edges]);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      setSize({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height)),
      });
    };

    const frameId = window.requestAnimationFrame(measure);
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({
        width: Math.max(0, Math.floor(entry.contentRect.width)),
        height: Math.max(0, Math.floor(entry.contentRect.height)),
      });
    });
    observer.observe(element);
    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    let depth = 0;
    const resetId = window.setTimeout(() => setWave(0), 0);
    if (maxDepth === 0) {
      return () => window.clearTimeout(resetId);
    }

    const intervalId = window.setInterval(() => {
      depth += 1;
      setWave(depth);
      if (depth >= maxDepth) window.clearInterval(intervalId);
    }, 220);
    return () => {
      window.clearTimeout(resetId);
      window.clearInterval(intervalId);
    };
  }, [maxDepth, edges]);

  useEffect(() => {
    if (nodes.length === 0) return;
    const id = window.setTimeout(() => graphRef.current?.zoomToFit(600, 42), 500);
    return () => window.clearTimeout(id);
  }, [nodes.length]);

  return (
    <PaneShell
      title="Supply graph"
      subtitle={loading && nodes.length === 0 ? "loading" : `${nodes.length} lots / ${links.length} edges`}
    >
      <div ref={wrapperRef} className="relative h-full min-h-[320px] w-full">
        {loading && nodes.length === 0 && <GraphSkeleton />}
        {!loading && nodes.length === 0 && (
          <div className="flex h-full min-h-[280px] items-center justify-center px-6 text-center text-sm text-neutral-600">
            Enter a Traceability Lot Code to build the contaminated lot graph.
          </div>
        )}
        {nodes.length > 0 && size.width > 0 && size.height > 0 && (
          <ForceGraph2D
            ref={graphRef}
            width={size.width}
            height={size.height}
            graphData={{ nodes, links }}
            backgroundColor="#0a0a0a"
            cooldownTicks={80}
            d3VelocityDecay={0.3}
            nodeRelSize={4}
            nodeLabel={(node) => `Lot #${node.id} / depth ${node.depth}`}
            onNodeClick={(node) => {
              const id = Number(node.id);
              if (Number.isFinite(id)) onSelect?.({ kind: "lot", id, label: `Lot #${id}` });
            }}
            nodeColor={(node) => (node.depth <= wave ? "#ef4444" : "#52525b")}
            linkLabel={(link) => link.transform}
            linkColor={(link) =>
              link.depth <= wave ? "rgba(239,68,68,0.86)" : "rgba(113,113,122,0.32)"
            }
            linkWidth={(link) => (link.depth <= wave ? 1.7 : 0.5)}
            linkDirectionalParticles={(link) => (link.depth <= wave ? 2 : 0)}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleColor={() => "#fecaca"}
          />
        )}
        {loading && <LoadingVeil />}
        {nodes.length > 0 && (
          <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 font-mono text-[10px] text-red-300">
            igniting from {seedTlc}
          </span>
        )}
      </div>
    </PaneShell>
  );
}
