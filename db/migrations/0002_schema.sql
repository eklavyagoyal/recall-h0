CREATE TABLE IF NOT EXISTS suppliers (
  supplier_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  region text NOT NULL,
  geom geography(Point, 4326)
);

CREATE TABLE IF NOT EXISTS facilities (
  facility_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('farm', 'processor', 'distributor', 'warehouse')),
  supplier_id bigint NOT NULL REFERENCES suppliers(supplier_id)
);

CREATE TABLE IF NOT EXISTS lots (
  lot_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tlc text UNIQUE NOT NULL,
  product_name text NOT NULL,
  lot_type text NOT NULL CHECK (lot_type IN ('ingredient', 'intermediate', 'finished')),
  produced_at timestamptz NOT NULL,
  facility_id bigint NOT NULL REFERENCES facilities(facility_id)
);

CREATE TABLE IF NOT EXISTS lot_links (
  parent_lot_id bigint NOT NULL REFERENCES lots(lot_id),
  child_lot_id bigint NOT NULL REFERENCES lots(lot_id),
  transform_event text NOT NULL,
  PRIMARY KEY (parent_lot_id, child_lot_id),
  CHECK (parent_lot_id <> child_lot_id)
);

CREATE TABLE IF NOT EXISTS stores (
  store_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  chain text NOT NULL,
  address text NOT NULL,
  geom geography(Point, 4326) NOT NULL
);

CREATE TABLE IF NOT EXISTS shipments (
  shipment_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lot_id bigint NOT NULL REFERENCES lots(lot_id),
  store_id bigint NOT NULL REFERENCES stores(store_id),
  units int NOT NULL CHECK (units > 0),
  shipped_at timestamptz NOT NULL,
  received_at timestamptz
);

CREATE TABLE IF NOT EXISTS store_inventory (
  store_id bigint NOT NULL REFERENCES stores(store_id),
  lot_id bigint NOT NULL REFERENCES lots(lot_id),
  units_on_hand int NOT NULL CHECK (units_on_hand >= 0),
  PRIMARY KEY (store_id, lot_id)
);

CREATE TABLE IF NOT EXISTS incidents (
  incident_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reported_at timestamptz NOT NULL,
  raw_text text NOT NULL,
  embedding vector(__EMBED_DIM__),
  suspected_lot_id bigint REFERENCES lots(lot_id),
  pathogen text
);

CREATE TABLE IF NOT EXISTS incident_lot_matches (
  incident_id bigint NOT NULL REFERENCES incidents(incident_id),
  lot_id bigint NOT NULL REFERENCES lots(lot_id),
  PRIMARY KEY (incident_id, lot_id)
);
