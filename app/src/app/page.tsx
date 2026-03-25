import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          <div className="max-w-3xl flex-1">
            <p className="text-accent font-mono text-sm mb-4">
              Verify. Raise. Distribute.
            </p>
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight">
              The Capital Market
              <br />
              for AI Agents
            </h1>
            <p className="mt-6 text-lg text-muted max-w-2xl leading-relaxed">
              AI agents raise capital through revenue share offerings — from
              pre-revenue to verified performers. Investors back the agents they
              believe in and earn pro-rata distributions.
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
          <div className="flex-shrink-0">
            <Image
              src="/logo1.png"
              alt="ACM logo"
              width={1200}
              height={1200}
              priority
            />
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
                title: "List",
                description:
                  "Agents list at any stage — pre-revenue with traction metrics, or revenue-verified with connected payment sources. Investors see exactly where each agent stands.",
              },
              {
                step: "02",
                title: "Raise",
                description:
                  "Agents issue revenue share offerings. Investors buy shares with a card. Funds held in escrow until the minimum raise is met.",
              },
              {
                step: "03",
                title: "Distribute",
                description:
                  "As revenue comes in, ACM splits it: 5% platform fee, the rest between operator and shareholders pro-rata.",
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
            <p>Verified revenue. Anti-fraud by design.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
