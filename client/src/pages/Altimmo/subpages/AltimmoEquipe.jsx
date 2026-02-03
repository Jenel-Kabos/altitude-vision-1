import React from 'react';

const teamMembers = [
  { name: 'Jean Dupont', role: 'Directeur Général', email: 'j.dupont@altimmo.cg', image: 'https://placehold.co/400x400/EBF4FF/767676?text=JD' },
  { name: 'Marie Dubois', role: 'Directrice Générale Adjointe', email: 'm.dubois@altimmo.cg', image: 'https://placehold.co/400x400/EBF4FF/767676?text=MD' },
  { name: 'Pierre Martin', role: 'Responsable RH', email: 'p.martin@altimmo.cg', image: 'https://placehold.co/400x400/EBF4FF/767676?text=PM' },
  { name: 'Sophie Leroy', role: 'Secrétaire de Direction', email: 's.leroy@altimmo.cg', image: 'https://placehold.co/400x400/EBF4FF/767676?text=SL' },
  { name: 'Luc Moreau', role: 'Chargé de Communication', email: 'l.moreau@altimmo.cg', image: 'https://placehold.co/400x400/EBF4FF/767676?text=LM' },
  { name: 'Chloé Girard', role: 'Commerciale', email: 'c.girard@altimmo.cg', image: 'https://placehold.co/400x400/EBF4FF/767676?text=CG' },
  { name: 'Alice Petit', role: 'Commerciale', email: 'a.petit@altimmo.cg', image: 'https://placehold.co/400x400/EBF4FF/767676?text=AP' },
];

const AltimmoEquipe = () => {
  return (
    <div className="bg-gray-50 py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Notre Équipe d'Experts</h2>
          <p className="text-gray-600 mt-2">Des professionnels passionnés à votre service.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {teamMembers.map(member => (
            <div key={member.email} className="bg-white p-6 rounded-lg shadow-md text-center">
              <img src={member.image} alt={member.name} loading="lazy" className="w-32 h-32 rounded-full mx-auto mb-4 object-cover" />
              <h3 className="text-lg font-bold text-primary">{member.name}</h3>
              <p className="text-gray-600">{member.role}</p>
              <a href={`mailto:${member.email}`} className="text-sm text-blue-500 hover:underline">{member.email}</a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AltimmoEquipe;
