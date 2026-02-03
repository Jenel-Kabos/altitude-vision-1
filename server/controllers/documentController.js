const Document = require('../models/Document');

// --- GET ALL DOCUMENTS ---
// Can be filtered by type, client, status, etc.
// e.g., /api/documents?type=Facture&status=En retard
exports.getAllDocuments = async (req, res) => {
  try {
    const filter = { ...req.query };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach((el) => delete filter[el]);

    // Populate allows us to get details from referenced models
    const documents = await Document.find(filter)
      .populate('client', 'name email')
      .populate('createdBy', 'name');

    res.status(200).json({
      status: 'success',
      results: documents.length,
      data: {
        documents,
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// --- CREATE A NEW DOCUMENT ---
exports.createDocument = async (req, res) => {
  try {
    const docData = { ...req.body, createdBy: req.user.id };

    // --- Logic to calculate totals for Invoice/Quote ---
    if (docData.type === 'Devis' || docData.type === 'Facture') {
      let subTotal = 0;
      if (docData.items && docData.items.length > 0) {
        docData.items.forEach(item => {
          item.total = item.quantity * item.unitPrice;
          subTotal += item.total;
        });
      }
      docData.subTotal = subTotal;
      // Assuming a simple tax calculation for now
      docData.tax = docData.tax || 0; 
      docData.totalAmount = subTotal + docData.tax;
    }

    const newDocument = await Document.create(docData);
    res.status(201).json({
      status: 'success',
      data: {
        document: newDocument,
      },
    });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};


// --- GET A SINGLE DOCUMENT ---
exports.getDocument = async (req, res) => {
    try {
        const document = await Document.findById(req.params.id)
            .populate('client', 'name email phone')
            .populate('createdBy', 'name')
            .populate('relatedProperty', 'title address');

        if (!document) {
            return res.status(404).json({ status: 'fail', message: 'No document found with that ID' });
        }
        res.status(200).json({
            status: 'success',
            data: { document }
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// --- UPDATE A DOCUMENT ---
exports.updateDocument = async (req, res) => {
  try {
    const docData = { ...req.body };

     // Recalculate totals if items are updated for an Invoice/Quote
     if ((docData.type === 'Devis' || docData.type === 'Facture') && docData.items) {
        let subTotal = 0;
        docData.items.forEach(item => {
            item.total = item.quantity * item.unitPrice;
            subTotal += item.total;
        });
        docData.subTotal = subTotal;
        docData.tax = docData.tax || 0;
        docData.totalAmount = subTotal + docData.tax;
    }

    const document = await Document.findByIdAndUpdate(req.params.id, docData, {
      new: true,
      runValidators: true,
    });

    if (!document) {
      return res.status(404).json({ status: 'fail', message: 'No document found with that ID' });
    }

    res.status(200).json({
      status: 'success',
      data: {
        document,
      },
    });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};


// --- DELETE A DOCUMENT ---
exports.deleteDocument = async (req, res) => {
    try {
        const document = await Document.findByIdAndDelete(req.params.id);

        if (!document) {
            return res.status(404).json({ status: 'fail', message: 'No document found with that ID' });
        }

        res.status(204).json({
            status: 'success',
            data: null,
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};