import { auth, signOut } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui"
import { HeaderLogo } from "@/components/layout/HeaderLogo"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/")
  }

  // Check user status
  if (session.user.status !== "ACTIVE") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-xl border-2 border-icc-violet/20 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-icc-violet mb-2">
            {session.user.status === "PENDING"
              ? "Compte en attente d'approbation"
              : "Accès refusé"}
          </h2>
          <p className="text-gray-700 mb-6">
            {session.user.status === "PENDING"
              ? "Votre compte est en attente d'approbation par un administrateur. Vous recevrez un email lorsque votre compte sera activé."
              : "Votre compte a été rejeté. Veuillez contacter un administrateur pour plus d'informations."}
          </p>
          <form
            action={async () => {
              "use server"
              await signOut({ redirectTo: "/" })
            }}
          >
            <Button type="submit" variant="primary" className="w-full">
              Se déconnecter
            </Button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b-2 border-icc-violet/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <HeaderLogo />

            {/* Navigation */}
            <div className="flex items-center gap-6">
              <Link
                href="/churches"
                className="text-sm font-medium text-icc-violet hover:text-icc-violet-dark transition-colors"
              >
                Églises
              </Link>
              <Link
                href="/users"
                className="text-sm font-medium text-icc-violet hover:text-icc-violet-dark transition-colors"
              >
                Utilisateurs
              </Link>
              <Link
                href="/settings"
                className="text-sm font-medium text-icc-violet hover:text-icc-violet-dark transition-colors"
              >
                Paramètres
              </Link>
            </div>

            {/* User menu */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {session.user.image && (
                  <img
                    src={session.user.image}
                    alt={session.user.name || ""}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <span className="text-sm text-gray-700 hidden sm:block">
                  {session.user.name || session.user.email}
                </span>
              </div>
              <form
                action={async () => {
                  "use server"
                  await signOut({ redirectTo: "/" })
                }}
              >
                <Button variant="ghost" size="sm" type="submit">
                  Déconnexion
                </Button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main>{children}</main>
    </div>
  )
}
