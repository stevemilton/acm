import Link from "next/link";
import { getUser } from "@/lib/auth";
import { SignOutButton } from "./sign-out-button";
import { MobileMenu } from "./mobile-menu";

export async function Navbar() {
  const user = await getUser();

  return (
    <nav className="border-b border-card-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-lg font-bold tracking-tight">
              <span className="text-accent">ACM</span>
            </Link>
            <div className="hidden sm:flex items-center gap-6 text-sm">
              <Link
                href="/agents"
                className="text-muted hover:text-foreground transition-colors"
              >
                Agents
              </Link>
              <Link
                href="/offerings"
                className="text-muted hover:text-foreground transition-colors"
              >
                Offerings
              </Link>
              {user && (
                <>
                  <Link
                    href="/dashboard"
                    className="text-muted hover:text-foreground transition-colors"
                  >
                    Dashboard
                  </Link>
                  {user.user_metadata?.role === "operator" && (
                    <Link
                      href="/operator"
                      className="text-muted hover:text-foreground transition-colors"
                    >
                      My Agents
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted hidden sm:inline">
                  {user.email}
                </span>
                <SignOutButton />
              </div>
            ) : (
              <Link
                href="/login"
                className="text-sm px-4 py-2 rounded-lg bg-accent text-background font-medium hover:bg-accent-hover transition-colors"
              >
                Sign In
              </Link>
            )}
            <MobileMenu
              isLoggedIn={!!user}
              role={user?.user_metadata?.role}
              email={user?.email}
            />
          </div>
        </div>
      </div>
    </nav>
  );
}
