import Link from "next/link";

export interface ChecklistStep {
  label: string;
  description: string;
  complete: boolean;
  href?: string;
}

export function OnboardingChecklist({
  steps,
  title = "Next Steps",
}: {
  steps: ChecklistStep[];
  title?: string;
}) {
  const completed = steps.filter((s) => s.complete).length;

  return (
    <div className="rounded-xl border border-card-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-xs text-muted">
          {completed}/{steps.length} complete
        </span>
      </div>
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                step.complete
                  ? "border-accent bg-accent text-background"
                  : "border-card-border"
              }`}
            >
              {step.complete && (
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              {step.href && !step.complete ? (
                <Link
                  href={step.href}
                  className="text-sm font-medium text-accent hover:underline"
                >
                  {step.label}
                </Link>
              ) : (
                <p
                  className={`text-sm font-medium ${step.complete ? "text-muted line-through" : ""}`}
                >
                  {step.label}
                </p>
              )}
              <p className="text-xs text-muted mt-0.5">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
