import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({ title: 'Sécurité du compte', noIndex: true });

export default function Page() {
  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-sm p-10">
        <h1 className="text-3xl font-bold mb-4">Sécurité</h1>
        <p className="text-gray-600 leading-relaxed">
          Cet espace récapitule les paramètres de sécurité de votre compte. Ajoutez les contrôles et fonctionnalités que vous souhaitez afficher ici.
        </p>
      </div>
    </div>
  );
}
