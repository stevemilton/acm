-- Add on-chain contract address columns to offerings
ALTER TABLE offerings ADD COLUMN IF NOT EXISTS escrow_address text;
ALTER TABLE offerings ADD COLUMN IF NOT EXISTS share_token_address text;
ALTER TABLE offerings ADD COLUMN IF NOT EXISTS distributor_address text;
ALTER TABLE offerings ADD COLUMN IF NOT EXISTS chain_id integer DEFAULT 97; -- BSC testnet
ALTER TABLE offerings ADD COLUMN IF NOT EXISTS factory_offering_id integer; -- ID from OfferingFactory contract

-- Update the first offering with deployed contract addresses
UPDATE offerings SET
  escrow_address = '0x0c50cc920489B3FE39670708071c4eC959BA867F',
  share_token_address = '0xa8b47e1f450a484c3D40622fB23C1e825A7A25F9',
  distributor_address = '0x3217ED63cB3ee9758c7b0D1047B73F83b9585fAF',
  factory_offering_id = 0,
  chain_id = 97
WHERE id = (SELECT id FROM offerings ORDER BY created_at LIMIT 1);
