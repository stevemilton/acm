"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface MobileMenuProps {
  isLoggedIn: boolean;
  role?: string;
  email?: string;
}

export function MobileMenu({ isLoggedIn, role, email }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="sm:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 text-muted hover:text-foreground transition-colors"
        aria-label="Toggle menu"
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute top-16 left-0 right-0 border-b border-card-border bg-card/95 backdrop-blur-sm z-40">
          <div className="max-w-7xl mx-auto px-4 py-4 space-y-1">
            <MobileLink href="/agents">Agents</MobileLink>
            <MobileLink href="/offerings">Offerings</MobileLink>
            {isLoggedIn && (
              <>
                <MobileLink href="/dashboard">Dashboard</MobileLink>
                {role === "operator" && (
                  <MobileLink href="/operator">My Agents</MobileLink>
                )}
              </>
            )}
            {isLoggedIn && email && (
              <p className="text-xs text-muted pt-3 border-t border-card-border mt-3">
                {email}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MobileLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 rounded-lg text-sm text-muted hover:text-foreground hover:bg-card-border/30 transition-colors"
    >
      {children}
    </Link>
  );
}
