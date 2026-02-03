// src/components/dashboard/QuoteEditor.jsx
// Placez ce fichier dans : src/components/dashboard/QuoteEditor.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Plus,
  Trash2,
  Save,
  Send,
  Download,
  Loader2,
  FileText,
  Building2,
  Calendar,
  Megaphone,
} from 'lucide-react';

// Configuration des entreprises
const COMPANIES = {
  'Altitude-Vision': {
    name: 'Altitude-Vision',
    type: 'Agence Immobilière',
    icon: Building2,
    color: 'blue',
    address: 'Avenue de la Paix, Brazzaville, Congo',
    phone: '+242 06 123 4567',
    email: 'contact@altitude-vision.cg',
    rccm: 'CG-BZV-01-2024-B12-00001',
    nif: '123456789',
  },
  'Mila Events': {
    name: 'Mila Events',
    type: 'Agence Événementielle',
    icon: Calendar,
    color: 'pink',
    address: 'Boulevard Denis Sassou N\'Guesso, Brazzaville, Congo',
    phone: '+242 06 234 5678',
    email: 'contact@mila-events.cg',
    rccm: 'CG-BZV-01-2024-B12-00002',
    nif: '987654321',
  },
  'Altcom': {
    name: 'Altcom',
    type: 'Agence de Communication',
    icon: Megaphone,
    color: 'green',
    address: 'Rue de la Liberté, Brazzaville, Congo',
    phone: '+242 06 345 6789',
    email: 'contact@altcom.cg',
    rccm: 'CG-BZV-01-2024-B12-00003',
    nif: '456789123',
  },
};

const QuoteEditor = ({ quote, onClose, onSave, onSend }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('edit'); // 'edit' ou 'preview'

  // Fonction pour mapper le service à l'entreprise
  const mapServiceToCompany = (service) => {
    if (!service) return 'Altitude-Vision';
    
    if (service.toLowerCase().includes('immob') || service.toLowerCase().includes('altimmo')) {
      return 'Altitude-Vision';
    }
    if (service.toLowerCase().includes('event') || service.toLowerCase().includes('événement') || service.toLowerCase().includes('mila')) {
      return 'Mila Events';
    }
    if (service.toLowerCase().includes('communication') || service.toLowerCase().includes('altcom') || service.toLowerCase().includes('pub')) {
      return 'Altcom';
    }
    
    return 'Mila Events'; // Par défaut, car la plupart des demandes de devis viennent de Mila Events
  };

  // Génération du numéro de devis
  const generateQuoteNumber = (company) => {
    const prefix = company === 'Altitude-Vision' ? 'AV' : company === 'Mila Events' ? 'ME' : 'AC';
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 9000) + 1000;
    return `${prefix}-${year}-${random}`;
  };

  const mappedCompany = mapServiceToCompany(quote?.service);

  const [quoteData, setQuoteData] = useState({
    quoteNumber: generateQuoteNumber(mappedCompany),
    company: mappedCompany,
    clientName: quote?.name || '',
    clientEmail: quote?.email || '',
    clientPhone: quote?.phone || '',
    clientAddress: '',
    date: new Date().toISOString().split('T')[0],
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    items: [
      {
        id: 1,
        description: quote?.eventType || 'Service',
        quantity: 1,
        unitPrice: '',
        total: 0,
      },
    ],
    subtotal: 0,
    taxRate: 18,
    taxAmount: 0,
    total: 0,
    notes: `Conditions de paiement :\n- 50% à la signature du contrat\n- 50% à la livraison/réalisation\n\nModes de paiement acceptés :\n- Virement bancaire\n- Espèces\n- Mobile Money (Airtel Money, MTN Money)`,
    paymentTerms: '30 jours',
  });

  // Calcul automatique des totaux
  React.useEffect(() => {
    const subtotal = quoteData.items.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = (subtotal * quoteData.taxRate) / 100;
    const total = subtotal + taxAmount;

    setQuoteData((prev) => ({
      ...prev,
      subtotal,
      taxAmount,
      total,
    }));
  }, [quoteData.items, quoteData.taxRate]);

  const handleCompanyChange = (company) => {
    setQuoteData({
      ...quoteData,
      company,
      quoteNumber: generateQuoteNumber(company),
    });
  };

  const handleItemChange = (id, field, value) => {
    setQuoteData((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'quantity' || field === 'unitPrice') {
            const qty = parseFloat(updatedItem.quantity) || 0;
            const price = parseFloat(updatedItem.unitPrice) || 0;
            updatedItem.total = qty * price;
          }
          return updatedItem;
        }
        return item;
      }),
    }));
  };

  const addItem = () => {
    const newId = Math.max(...quoteData.items.map((i) => i.id), 0) + 1;
    setQuoteData({
      ...quoteData,
      items: [
        ...quoteData.items,
        { id: newId, description: '', quantity: 1, unitPrice: '', total: 0 },
      ],
    });
  };

  const removeItem = (id) => {
    if (quoteData.items.length > 1) {
      setQuoteData({
        ...quoteData,
        items: quoteData.items.filter((item) => item.id !== id),
      });
    }
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    await onSave(quoteData);
    setIsSubmitting(false);
  };

  const handleSend = async () => {
    setIsSubmitting(true);
    await onSend(quoteData);
    setIsSubmitting(false);
  };

  const selectedCompany = COMPANIES[quoteData.company] || COMPANIES['Mila Events'];
  const CompanyIcon = selectedCompany.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl my-8 relative"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-t-2xl">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="absolute top-4 right-4 text-white hover:bg-white/20 transition p-2 rounded-full"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8" />
            <div>
              <h2 className="text-3xl font-bold">Créer un Devis Professionnel</h2>
              <p className="text-blue-100 mt-1">Client : {quote?.name || 'Nouveau client'}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50">
          <button
            onClick={() => setActiveTab('edit')}
            className={`flex-1 py-4 px-6 font-semibold transition ${
              activeTab === 'edit'
                ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Éditer le Devis
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex-1 py-4 px-6 font-semibold transition ${
              activeTab === 'preview'
                ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Aperçu
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
          {activeTab === 'edit' ? (
            <EditTab
              quoteData={quoteData}
              setQuoteData={setQuoteData}
              handleCompanyChange={handleCompanyChange}
              handleItemChange={handleItemChange}
              addItem={addItem}
              removeItem={removeItem}
              selectedCompany={selectedCompany}
              CompanyIcon={CompanyIcon}
            />
          ) : (
            <PreviewTab quoteData={quoteData} selectedCompany={selectedCompany} CompanyIcon={CompanyIcon} />
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t bg-gray-50 p-6 rounded-b-2xl">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-100 transition"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              Enregistrer
            </button>
            <button
              onClick={handleSend}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              Envoyer au Client
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// Onglet Édition
const EditTab = ({
  quoteData,
  setQuoteData,
  handleCompanyChange,
  handleItemChange,
  addItem,
  removeItem,
  selectedCompany,
  CompanyIcon,
}) => {
  return (
    <div className="p-6 space-y-6">
      {/* Sélection Entreprise */}
      <div className="bg-blue-50 p-6 rounded-xl border-2 border-blue-200">
        <label className="block text-gray-800 font-bold mb-3 text-lg">
          Entreprise Émettrice
        </label>
        <div className="grid grid-cols-3 gap-4">
          {Object.values(COMPANIES).map((company) => {
            const Icon = company.icon;
            const isSelected = quoteData.company === company.name;
            return (
              <button
                key={company.name}
                onClick={() => handleCompanyChange(company.name)}
                className={`p-4 rounded-xl border-2 transition ${
                  isSelected
                    ? 'border-blue-600 bg-blue-100 shadow-lg'
                    : 'border-gray-300 bg-white hover:border-blue-400'
                }`}
              >
                <Icon className={`w-8 h-8 mx-auto mb-2 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} />
                <p className="font-bold text-gray-800 text-sm">{company.name}</p>
                <p className="text-xs text-gray-600">{company.type}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Informations Client */}
      <div className="bg-gray-50 p-6 rounded-xl">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Informations Client</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Nom complet *</label>
            <input
              type="text"
              value={quoteData.clientName}
              onChange={(e) => setQuoteData({ ...quoteData, clientName: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Email *</label>
            <input
              type="email"
              value={quoteData.clientEmail}
              onChange={(e) => setQuoteData({ ...quoteData, clientEmail: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Téléphone</label>
            <input
              type="tel"
              value={quoteData.clientPhone}
              onChange={(e) => setQuoteData({ ...quoteData, clientPhone: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Adresse</label>
            <input
              type="text"
              value={quoteData.clientAddress}
              onChange={(e) => setQuoteData({ ...quoteData, clientAddress: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Dates et Validité */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-gray-700 font-semibold mb-2">N° Devis</label>
          <input
            type="text"
            value={quoteData.quoteNumber}
            onChange={(e) => setQuoteData({ ...quoteData, quoteNumber: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100"
          />
        </div>
        <div>
          <label className="block text-gray-700 font-semibold mb-2">Date</label>
          <input
            type="date"
            value={quoteData.date}
            onChange={(e) => setQuoteData({ ...quoteData, date: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-gray-700 font-semibold mb-2">Valide jusqu'au</label>
          <input
            type="date"
            value={quoteData.validUntil}
            onChange={(e) => setQuoteData({ ...quoteData, validUntil: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      {/* Lignes de Services */}
      <div className="bg-gray-50 p-6 rounded-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800">Services / Prestations</h3>
          <button
            onClick={addItem}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            Ajouter une ligne
          </button>
        </div>

        <div className="space-y-3">
          {quoteData.items.map((item) => (
            <div key={item.id} className="grid grid-cols-12 gap-3 items-start bg-white p-3 rounded-lg">
              <div className="col-span-5">
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                  placeholder="Description du service"
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                  placeholder="Qté"
                  min="1"
                  step="1"
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  value={item.unitPrice}
                  onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)}
                  placeholder="Prix unitaire"
                  min="0"
                  step="1000"
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="text"
                  value={`${item.total.toLocaleString('fr-FR')} FCFA`}
                  disabled
                  className="w-full p-2 border border-gray-300 rounded bg-gray-100 font-semibold"
                />
              </div>
              <div className="col-span-1 flex items-center justify-center">
                <button
                  onClick={() => removeItem(item.id)}
                  disabled={quoteData.items.length === 1}
                  className="p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-30"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Totaux */}
        <div className="mt-6 bg-blue-50 p-4 rounded-lg">
          <div className="flex justify-between mb-2">
            <span className="text-gray-700 font-semibold">Sous-total :</span>
            <span className="text-gray-900 font-bold">{quoteData.subtotal.toLocaleString('fr-FR')} FCFA</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-700 font-semibold">TVA :</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={quoteData.taxRate}
                onChange={(e) => setQuoteData({ ...quoteData, taxRate: parseFloat(e.target.value) })}
                className="w-16 p-1 border border-gray-300 rounded text-center"
                min="0"
                max="100"
              />
              <span className="text-gray-700">%</span>
              <span className="text-gray-900 font-bold ml-4">{quoteData.taxAmount.toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>
          <div className="border-t-2 border-blue-300 pt-2 flex justify-between">
            <span className="text-gray-900 font-bold text-lg">TOTAL :</span>
            <span className="text-blue-600 font-bold text-2xl">{quoteData.total.toLocaleString('fr-FR')} FCFA</span>
          </div>
        </div>
      </div>

      {/* Notes et Conditions */}
      <div>
        <label className="block text-gray-700 font-semibold mb-2">Notes et Conditions</label>
        <textarea
          value={quoteData.notes}
          onChange={(e) => setQuoteData({ ...quoteData, notes: e.target.value })}
          rows="6"
          className="w-full p-3 border border-gray-300 rounded-lg"
          placeholder="Conditions de paiement, modalités, etc."
        />
      </div>
    </div>
  );
};

// Onglet Aperçu
const PreviewTab = ({ quoteData, selectedCompany, CompanyIcon }) => {
  return (
    <div className="bg-gray-100 p-8">
      <div className="bg-white max-w-4xl mx-auto p-12 rounded-xl shadow-2xl" id="quote-preview">
        {/* Header */}
        <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-blue-600">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <CompanyIcon className="w-10 h-10 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{selectedCompany.name}</h1>
                <p className="text-blue-600 font-semibold">{selectedCompany.type}</p>
              </div>
            </div>
            <div className="text-sm text-gray-600 mt-3 space-y-1">
              <p>{selectedCompany.address}</p>
              <p>Tél : {selectedCompany.phone}</p>
              <p>Email : {selectedCompany.email}</p>
              <p>RCCM : {selectedCompany.rccm}</p>
              <p>NIF : {selectedCompany.nif}</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-4xl font-bold text-blue-600 mb-2">DEVIS</h2>
            <p className="text-gray-700 font-semibold">N° {quoteData.quoteNumber}</p>
            <p className="text-sm text-gray-600 mt-2">Date : {new Date(quoteData.date).toLocaleDateString('fr-FR')}</p>
            <p className="text-sm text-gray-600">Valide jusqu'au : {new Date(quoteData.validUntil).toLocaleDateString('fr-FR')}</p>
          </div>
        </div>

        {/* Client Info */}
        <div className="mb-8 bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-bold text-gray-800 mb-3">Client</h3>
          <p className="font-semibold text-gray-900">{quoteData.clientName}</p>
          <p className="text-gray-700">{quoteData.clientEmail}</p>
          {quoteData.clientPhone && <p className="text-gray-700">{quoteData.clientPhone}</p>}
          {quoteData.clientAddress && <p className="text-gray-700">{quoteData.clientAddress}</p>}
        </div>

        {/* Items Table */}
        <table className="w-full mb-8">
          <thead className="bg-blue-600 text-white">
            <tr>
              <th className="text-left p-3 font-semibold">Description</th>
              <th className="text-center p-3 font-semibold w-24">Qté</th>
              <th className="text-right p-3 font-semibold w-32">P.U.</th>
              <th className="text-right p-3 font-semibold w-32">Total</th>
            </tr>
          </thead>
          <tbody>
            {quoteData.items.map((item, index) => (
              <tr key={item.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="p-3 text-gray-800">{item.description}</td>
                <td className="p-3 text-center text-gray-800">{item.quantity}</td>
                <td className="p-3 text-right text-gray-800">{item.unitPrice.toLocaleString('fr-FR')} FCFA</td>
                <td className="p-3 text-right font-semibold text-gray-900">{item.total.toLocaleString('fr-FR')} FCFA</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-80 space-y-2">
            <div className="flex justify-between text-gray-700">
              <span>Sous-total :</span>
              <span className="font-semibold">{quoteData.subtotal.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>TVA ({quoteData.taxRate}%) :</span>
              <span className="font-semibold">{quoteData.taxAmount.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t-2 border-blue-600">
              <span>TOTAL :</span>
              <span className="text-blue-600">{quoteData.total.toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {quoteData.notes && (
          <div className="bg-blue-50 p-6 rounded-lg">
            <h3 className="font-bold text-gray-800 mb-2">Notes et Conditions</h3>
            <p className="text-gray-700 text-sm whitespace-pre-line">{quoteData.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t text-center text-sm text-gray-600">
          <p className="font-semibold">Merci de votre confiance !</p>
          <p className="mt-2">Pour toute question, contactez-nous : {selectedCompany.email} | {selectedCompany.phone}</p>
        </div>
      </div>
    </div>
  );
};

export default QuoteEditor;