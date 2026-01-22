import { Metadata } from "next"
import { LogoUploader } from "@/components/settings/LogoUploader"
import { FaviconUploader } from "@/components/settings/FaviconUploader"

export const metadata: Metadata = {
  title: "Paramètres - PicFlow",
}

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Paramètres</h1>
      <p className="text-gray-600 mb-8">
        Personnalisez l'apparence de votre application
      </p>

      <div className="space-y-8">
        {/* Logo Section */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Logo</h2>
          <p className="text-sm text-gray-600 mb-6">
            Le logo s'affiche dans l'en-tête de l'interface admin et sur la page
            de connexion
          </p>
          <LogoUploader />
        </section>

        {/* Favicon Section */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Favicon</h2>
          <p className="text-sm text-gray-600 mb-6">
            L'icône qui apparaît dans l'onglet du navigateur
          </p>
          <FaviconUploader />
        </section>
      </div>
    </div>
  )
}
