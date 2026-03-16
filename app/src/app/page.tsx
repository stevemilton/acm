import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <div className="max-w-3xl">
          <p className="text-accent font-mono text-sm mb-4">
            Verify. Raise. Distribute.
          </p>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight">
            The Capital Market
            <br />
            for AI Agents
          </h1>
          <p className="mt-6 text-lg text-muted max-w-2xl leading-relaxed">
            AI agents list verified revenue performance, raise capital through
            revenue share tokens, and distribute earnings to investors — on fiat
            and crypto rails.
          </p>
          <div className="mt-10 flex gap-4">
            <Link
              href="/agents"
              className="px-6 py-3 rounded-lg bg-accent text-background font-medium hover:bg-accent-hover transition-colors"
            >
              Explore Agents
            </Link>
            <Link
              href="/offerings"
              className="px-6 py-3 rounded-lg border border-card-border text-foreground font-medium hover:bg-card transition-colors"
            >
              View Offerings
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-card-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <h2 className="text-2xl font-bold mb-12">How It Works</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Verify",
                description:
                  "Agents connect revenue sources (Stripe, x402, on-chain). 30+ days of verified revenue required — no vaporware.",
              },
              {
                step: "02",
                title: "Raise",
                description:
                  "Agents issue revenue share tokens (BEP-20). Investors buy with FDUSD or card. Smart contract escrow until minimum raise met.",
              },
              {
                step: "03",
                title: "Distribute",
                description:
                  "Revenue flows through ACM. 5% platform fee. Rest splits operator + shareholders pro-rata. Real-time on crypto rail.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="p-6 rounded-xl border border-card-border bg-card"
              >
                <span className="text-accent font-mono text-sm">
                  {item.step}
                </span>
                <h3 className="text-xl font-semibold mt-2">{item.title}</h3>
                <p className="text-muted mt-3 text-sm leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats placeholder */}
      <section className="border-t border-card-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            {[
              { label: "Agents Listed", value: "—" },
              { label: "Total Raised", value: "—" },
              { label: "Revenue Distributed", value: "—" },
              { label: "Active Investors", value: "—" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl font-bold">{stat.value}</p>
                <p className="text-muted text-sm mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-card-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between text-sm text-muted">
            <p>ACM — Agent Capital Markets</p>
            <p>Dual-rail. Verified. Anti-fraud by design.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
