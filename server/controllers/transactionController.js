const Transaction = require('../models/Transaction');
const Property = require('../models/Property');
const Document = require('../models/Document');

// --- CREATE A NEW TRANSACTION ---
// This marks the beginning of a deal
exports.createTransaction = async (req, res) => {
    try {
        const { propertyId, clientId, finalAmount, transactionType } = req.body;
        
        const newTransaction = await Transaction.create({
            property: propertyId,
            client: clientId,
            agent: req.user.id, // The logged-in collaborator creates the transaction
            finalAmount,
            transactionType,
        });

        res.status(201).json({
            status: 'success',
            data: { transaction: newTransaction },
        });

    } catch (error) {
        res.status(400).json({ status: 'fail', message: error.message });
    }
};

// --- FINALIZE A TRANSACTION ---
// This is the most important function
exports.finalizeTransaction = async (req, res) => {
    try {
        const transactionId = req.params.id;
        const transaction = await Transaction.findById(transactionId).populate('property');

        if (!transaction) {
            return res.status(404).json({ status: 'fail', message: 'No transaction found with that ID' });
        }
        if (transaction.status === 'Réussie') {
            return res.status(400).json({ status: 'fail', message: 'This transaction is already finalized.' });
        }

        // 1. Update Property availability
        const newAvailability = transaction.transactionType === 'vente' ? 'Vendu' : 'Loué';
        await Property.findByIdAndUpdate(transaction.property._id, {
            availability: newAvailability,
            isPublished: false, // Unpublish the property
        });

        // 2. Calculate commissions
        // Assuming a global 10% agency commission for this example
        const agencyCommission = transaction.finalAmount * 0.10; 
        let ownerPayout = 0;

        if (transaction.property.hasSpecialCommission) {
            ownerPayout = agencyCommission * 0.30;
        }

        // 3. (Optional) Auto-generate an invoice
        const invoice = await Document.create({
            type: 'Facture',
            status: 'Envoyé',
            client: transaction.client,
            createdBy: req.user.id,
            relatedProperty: transaction.property._id,
            items: [{
                description: `Commission pour ${transaction.transactionType} du bien: ${transaction.property.title}`,
                quantity: 1,
                unitPrice: agencyCommission,
                total: agencyCommission,
            }],
            subTotal: agencyCommission,
            totalAmount: agencyCommission,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Due in 30 days
        });

        // 4. Update the transaction itself
        transaction.status = 'Réussie';
        transaction.commission = { total: agencyCommission, ownerPayout: ownerPayout };
        transaction.linkedInvoice = invoice._id;
        await transaction.save();

        res.status(200).json({
            status: 'success',
            message: 'Transaction finalized successfully!',
            data: { transaction }
        });

    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// Standard CRUD functions (get all, get one, etc.) can be added here as needed
exports.getAllTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.find(req.query)
            .populate('property', 'title')
            .populate('client', 'name')
            .populate('agent', 'name');

        res.status(200).json({
            status: 'success',
            results: transactions.length,
            data: { transactions },
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};