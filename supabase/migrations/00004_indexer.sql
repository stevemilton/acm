-- Track indexing progress per contract
CREATE TABLE IF NOT EXISTS indexer_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_address text NOT NULL UNIQUE,
  last_indexed_block bigint NOT NULL DEFAULT 0,
  last_indexed_at timestamptz DEFAULT now(),
  event_count integer NOT NULL DEFAULT 0
);

-- Store raw on-chain events for audit trail and reprocessing
CREATE TABLE IF NOT EXISTS on_chain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_address text NOT NULL,
  event_name text NOT NULL,
  block_number bigint NOT NULL,
  tx_hash text NOT NULL UNIQUE,
  log_index integer NOT NULL,
  args jsonb NOT NULL DEFAULT '{}',
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_events_contract ON on_chain_events(contract_address);
CREATE INDEX idx_events_unprocessed ON on_chain_events(processed) WHERE NOT processed;
