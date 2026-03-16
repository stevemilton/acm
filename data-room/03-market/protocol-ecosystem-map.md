# Agent Payment Protocol Ecosystem Map

## Overview

The agent payment infrastructure went live in 2025-2026. ACM builds on top of these protocols — they verify agent revenue, ACM turns that into investable assets.

## Tier 1 — Card Network Protocols

### Visa Intelligent Commerce (VIC)
- **Owner:** Visa
- **What:** Developer platform opening VisaNet to AI agent builders. Tokenized agent credentials with configurable spending limits.
- **Key primitives:** AI-Ready Card credentials, payment passkeys, payment instructions, real-time monitoring
- **Agent identity:** Trusted Agent Protocol (co-developed with Cloudflare) — merchants verify agent legitimacy and consumer authorization
- **MCP Server:** Open source on GitHub (visa/mcp)
- **Stage:** Hundreds of secure transactions in US pilots (Dec 2025). 100+ global partners. Asia-Pacific and Europe pilots early 2026.
- **ACM relevance:** Revenue verification for agents earning via Visa-based commerce

### Mastercard Agent Pay
- **Owner:** Mastercard
- **What:** Agentic Payments Programme with scoped Agentic Tokens built on existing tokenization infrastructure
- **Key primitives:** Agent Pay Acceptance Framework, governance rules per agent interaction
- **Partnerships:** Stripe, Google, PayPal, Fiserv, Ant International
- **Stage:** Live. Santander + Mastercard completed Europe's first live agent-initiated payment (March 2026). All US Mastercard holders enabled by 2025 holiday season.
- **ACM relevance:** Revenue verification for agents transacting via Mastercard rails

## Tier 2 — Agent Commerce Protocols (Open Source)

### ACP — Agentic Commerce Protocol
- **Owner:** Stripe + OpenAI
- **What:** Protocol powering ChatGPT Instant Checkout. Defines how agents, consumers, and merchants complete purchases.
- **Key primitive:** Shared Payment Token (SPT) — scoped to specific merchant + cart total. Agent never sees raw credentials.
- **Stage:** Live. US ChatGPT users can buy from Etsy sellers in-chat. 1M+ Shopify merchants coming online.
- **Open source:** GitHub (agentic-commerce-protocol/agentic-commerce-protocol)
- **ACM relevance:** Revenue verification for agents in commerce flows

### AP2 — Agent Payments Protocol
- **Owner:** Google
- **What:** Payment-agnostic open protocol for agent-initiated transactions
- **Key primitives:** Two-step mandate system (intent mandate + cart mandate) with cryptographic proof of user intent. x402 extension for crypto.
- **Collaborators:** 60+ organizations including Mastercard, American Express, Coinbase, PayPal
- **Open source:** GitHub (google-agentic-commerce/AP2)
- **ACM relevance:** Cross-protocol revenue verification, crypto bridge via x402 extension

### UCP — Universal Commerce Protocol
- **Owner:** Google
- **What:** Commerce layer for discovery, catalog, and post-purchase flows. Works with AP2 for payments.
- **Partners:** Shopify, Etsy, Wayfair, Target, Walmart
- **ACM relevance:** Agent discoverability and commerce context

## Tier 3 — Agent-Native / Crypto Protocols

### x402 Protocol
- **Owner:** Coinbase
- **What:** HTTP 402 "Payment Required" for native machine-to-machine payments via stablecoins
- **How:** Agent sends HTTP request → receives 402 with payment terms → pays via crypto → receives resource
- **Stage:** Live. 50M+ transactions. Stripe uses x402 for USDC on Base. Cloudflare uses for pay-per-use APIs.
- **ACM relevance:** PRIMARY crypto revenue verification. Agent-to-agent payment tracking. BNB Chain compatible (EVM).

### Coinbase Agentic Wallets
- **Owner:** Coinbase
- **What:** Non-custodial wallets in Trusted Execution Environments (TEEs). Agents hold funds, send payments, trade, earn yield autonomously.
- **Chains:** EVM, Solana, Base L2
- **ACM relevance:** Enables agent-to-agent investment (v2). Agents can hold and spend FDUSD.

## Tier 4 — Identity & Verification

### Know Your Agent (KYA)
- **What:** Emerging identity/verification/governance framework — KYC for agents
- **Covers:** Identity, authority verification, auditability
- **ACM relevance:** Agent listing verification, trust scoring

### ERC-8004
- **What:** On-chain standard for verifiable AI agent identities
- **Chain:** Live on BNB Chain (February 2026)
- **ACM relevance:** On-chain agent identity verification native to BNB

### BAP-578 — Non-Fungible Agents
- **What:** BNB Chain standard for agents as on-chain assets that own wallets and spend funds
- **ACM relevance:** Agents as first-class on-chain entities — directly compatible with ACM agent listings

### Prove Verified Agent
- **What:** Trust and verification layer — end-to-end chain of custody linking identity, intent, payment credentials, and consent
- **ACM relevance:** Additional trust layer for high-value agent listings

### NIST AI Agent Standards Initiative
- **What:** US federal standards body initiative for interoperability and security across agent ecosystem
- **Launched:** February 2026
- **ACM relevance:** Regulatory alignment and future compliance

## Tier 5 — Payment Infrastructure (Multi-Protocol)

### PayPal Agentic Commerce Services
- **What:** Multi-protocol approach — supports ACP, AP2, UCP, Mastercard Agent Pay
- **Stage:** Rolling out through 2026. "Agent Ready" merchant onboarding available early 2026.
- **ACM relevance:** Additional revenue verification source, wallet integration

### FIS Agentic Commerce for Banks
- **What:** First platform enabling issuing banks to participate in agentic commerce. Know Your Agent (KYA) data handling.
- **Integrated with:** Both Visa VIC and Mastercard Agent Pay
- **Stage:** Available to all FIS bank clients by Q1 2026
- **ACM relevance:** Bank-side verification of agent transactions

## Protocol Stack for ACM

```
┌──────────────────────────────────────────┐
│              ACM PLATFORM                 │
│    Verify · Raise · Distribute            │
├──────────────────────────────────────────┤
│         REVENUE VERIFICATION              │
│  Stripe Connect │ x402 │ On-chain monitor │
├──────────────────────────────────────────┤
│         AGENT IDENTITY                    │
│    KYA │ ERC-8004 │ BAP-578 │ Prove       │
├──────────────────────────────────────────┤
│         SETTLEMENT                        │
│    FDUSD │ Smart contracts │ BEP-20       │
├──────────────────────────────────────────┤
│         BNB CHAIN                         │
└──────────────────────────────────────────┘
```
