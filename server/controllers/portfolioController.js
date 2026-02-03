const PortfolioItem = require('../models/portfolioItemModel');

// --- GET ALL PORTFOLIO ITEMS ---
// Can be filtered by pole and/or category
// e.g., /api/portfolio?pole=Altcom&category=Digital
exports.getAllPortfolioItems = async (req, res) => {
  try {
    const filter = {};
    if (req.query.pole) {
      filter.pole = req.query.pole;
    }
    if (req.query.category) {
      filter.category = req.query.category;
    }

    const items = await PortfolioItem.find(filter).sort({ projectDate: -1 });

    res.status(200).json({
      status: 'success',
      results: items.length,
      data: {
        items,
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// --- CREATE A NEW PORTFOLIO ITEM ---
// Accessible by: Admin, Collaborateur
exports.createPortfolioItem = async (req, res) => {
  try {
    const newItem = await PortfolioItem.create(req.body);
    res.status(201).json({
      status: 'success',
      data: {
        item: newItem,
      },
    });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

// --- GET A SINGLE PORTFOLIO ITEM ---
exports.getPortfolioItem = async (req, res) => {
    try {
        const item = await PortfolioItem.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ status: 'fail', message: 'No item found with that ID' });
        }
        res.status(200).json({
            status: 'success',
            data: { item }
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// --- UPDATE A PORTFOLIO ITEM ---
// Accessible by: Admin, Collaborateur
exports.updatePortfolioItem = async (req, res) => {
  try {
    const item = await PortfolioItem.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!item) {
      return res.status(404).json({ status: 'fail', message: 'No item found with that ID' });
    }

    res.status(200).json({
      status: 'success',
      data: {
        item,
      },
    });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

// --- DELETE A PORTFOLIO ITEM ---
// Accessible by: Admin
exports.deletePortfolioItem = async (req, res) => {
    try {
        const item = await PortfolioItem.findByIdAndDelete(req.params.id);

        if (!item) {
            return res.status(404).json({ status: 'fail', message: 'No item found with that ID' });
        }

        res.status(204).json({
            status: 'success',
            data: null,
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};