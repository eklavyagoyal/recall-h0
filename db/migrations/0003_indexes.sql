CREATE INDEX IF NOT EXISTS idx_lot_links_parent ON lot_links (parent_lot_id);
CREATE INDEX IF NOT EXISTS idx_lot_links_child ON lot_links (child_lot_id);

CREATE INDEX IF NOT EXISTS idx_shipments_lot ON shipments (lot_id);
CREATE INDEX IF NOT EXISTS idx_shipments_store ON shipments (store_id);

CREATE INDEX IF NOT EXISTS idx_store_inventory ON store_inventory (store_id, lot_id);
CREATE INDEX IF NOT EXISTS idx_stores_geom ON stores USING gist (geom);

-- Deferred to Phase 02, after ~2,000 real embeddings are loaded:
--
-- CREATE INDEX IF NOT EXISTS idx_incidents_hnsw
--   ON incidents USING hnsw (embedding vector_cosine_ops)
--   WITH (m = 16, ef_construction = 64);
