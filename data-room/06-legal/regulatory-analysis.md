# Regulatory Analysis

## Are Agent Shares Securities?

### Howey Test Analysis

Under the SEC's Howey Test, an instrument is a security if it involves:

| Prong | Test | Agent Shares | Result |
|-------|------|-------------|--------|
| 1 | Investment of money | Investors pay FDUSD/fiat for shares | YES |
| 2 | In a common enterprise | Capital pooled into agent operations | YES |
| 3 | Expectation of profits | Revenue share distributions | YES |
| 4 | From the efforts of others | Operator runs the agent | YES |

**Conclusion: Agent Shares are almost certainly securities under US law.**

This does NOT kill the business. It means we need a registration exemption or non-US structure.

## Regulatory Pathways

### Option A: Reg CF (Regulation Crowdfunding) — US
- **Cap:** $5M per agent per year
- **Investors:** Anyone (accredited and non-accredited)
- **Requirement:** Must use SEC-registered funding portal (Wefunder, Republic, etc.) OR become one
- **Public solicitation:** Allowed
- **Pros:** Open to everyone, designed for platforms like ACM, aligns with marketplace model
- **Cons:** $5M cap per agent, portal registration overhead
- **Timeline:** Can launch within 3-6 months of filing
- **Fit for ACM:** Strong for v1 — $5M cap is fine for early agents

### Option B: Reg D 506(c) — US
- **Cap:** Unlimited
- **Investors:** Accredited only, but public solicitation allowed
- **Pros:** No fundraising cap, can advertise publicly
- **Cons:** Limits investor pool to accredited only
- **Fit for ACM:** Possible but reduces addressable market

### Option C: Reg A+ — US
- **Cap:** $75M per year
- **Investors:** Anyone
- **Requirement:** SEC qualification required (expensive, slow)
- **Pros:** Best long-term structure — open to everyone, high cap
- **Cons:** $50-100K+ legal costs, 6-12 month qualification timeline
- **Fit for ACM:** Best option at scale, but too slow/expensive for v1

### Option D: Non-US First — UK / Singapore / UAE
- **UK FCA:** Crypto-friendly sandbox. Revenue share tokens may fall under regulated activities but the FCA has been pragmatic with innovation.
- **Singapore MAS:** Clear framework for digital payment tokens vs. securities tokens. Revenue share tokens likely classified as "capital markets products" — regulated but navigable.
- **UAE (ADGM/DIFC):** Most crypto-friendly jurisdiction. Virtual Asset Regulatory Authority (VARA) in Dubai has licensed multiple crypto exchanges.
- **Pros:** Launch faster, lighter regulatory burden, build traction, then enter US
- **Cons:** Distance from Binance Labs (Singapore-based, though CZ is UAE-based post-settlement)
- **Fit for ACM:** Strong option — especially UAE given CZ's presence

### Option E: Revenue Share ≠ Equity Argument
- Structure Agent Shares as revenue participation agreements, not equity
- No ownership, no governance rights, no residual claim on assets
- Argument: this is a commercial revenue-sharing contract, not a security
- **Risk:** SEC has historically looked through form to substance. Revenue participation with passive investors likely still a security.
- **Recommendation:** Don't rely on this alone. Use it as supporting argument within a proper exemption.

## Recommended Approach

### Phase 1 (v1 Launch): Crypto Rail — Offshore
- Launch crypto rail in UAE or Singapore
- Permissionless, wallet-based, no US persons in v1
- Geo-block US IP addresses
- Terms of service: "Not available to US persons"
- This is how most crypto platforms launch

### Phase 2: Fiat Rail — Reg CF (US)
- Partner with existing SEC-registered funding portal
- US persons invest via fiat rail with full compliance
- Dual-rail model: compliant fiat for US, permissionless crypto for global

### Phase 3: Scale — Reg A+ (US)
- Once platform has traction and revenue, qualify under Reg A+
- Opens US to unlimited investment, maintains crypto rail globally

## Crypto-Specific Regulatory Considerations

### Token Classification
- Agent Share tokens are likely "securities tokens" under most frameworks
- NOT utility tokens (they provide financial return, not platform access)
- This is fine — securities token frameworks exist in UAE, Singapore, and EU (MiCA)

### FDUSD Settlement
- FDUSD is a regulated stablecoin (First Digital Labs, Hong Kong)
- Using a regulated stablecoin strengthens compliance positioning
- Binance has existing compliance infrastructure around FDUSD

### Know Your Agent (KYA)
- Emerging standard for agent identity verification
- ACM should adopt KYA early — positions us as compliance-forward
- BNB Chain's ERC-8004 provides on-chain agent identity — regulatory advantage

### Anti-Money Laundering (AML)
- Agent revenue must be verifiable and non-circular
- Platform monitors for wash trading / revenue manipulation
- Operator KYC required on both rails
- Transaction monitoring for suspicious patterns

## Legal Workstreams Required

| Workstream | Status | Priority |
|------------|--------|----------|
| Token legal opinion (securities classification) | Not started | HIGH |
| Jurisdiction selection (UAE vs Singapore) | Not started | HIGH |
| Revenue share agreement template | Not started | HIGH |
| Terms of service | Not started | MEDIUM |
| Privacy policy (GDPR/PDPA compliant) | Not started | MEDIUM |
| Company incorporation (chosen jurisdiction) | Not started | HIGH |
| US Reg CF exploration | Not started | LOW (Phase 2) |
| Smart contract legal review | Not started | MEDIUM |

## Key Legal Risks

1. **Retroactive enforcement:** SEC could classify crypto-rail tokens as unregistered securities even if launched offshore. Mitigate with geo-blocking and clear US person exclusions.
2. **Revenue share vs. security:** Regulators may see through "revenue share" framing. Mitigate by seeking formal legal opinion and operating within established exemptions.
3. **Agent liability:** If an agent causes harm or generates illegal revenue, does ACM have liability? Need clear terms of service and operator liability agreements.
4. **Cross-border complexity:** Investors from multiple jurisdictions, each with different securities laws. Mitigate with clear jurisdiction-specific terms and geo-restrictions where needed.
