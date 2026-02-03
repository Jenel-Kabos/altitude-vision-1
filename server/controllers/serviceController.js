const Service = require('../models/Service');

// --- GET ALL SERVICES ---
// Can be filtered by pole, e.g., /api/services?pole=Altcom
exports.getAllServices = async (req, res) => {
  try {
    const filter = {};
    if (req.query.pole) {
      filter.pole = req.query.pole;
    }

    const services = await Service.find(filter);

    res.status(200).json({
      status: 'success',
      results: services.length,
      data: {
        services,
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// --- CREATE A NEW SERVICE ---
// Accessible by: Admin, Collaborateur
exports.createService = async (req, res) => {
  try {
    const newService = await Service.create(req.body);
    res.status(201).json({
      status: 'success',
      data: {
        service: newService,
      },
    });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

// --- GET A SINGLE SERVICE ---
exports.getService = async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ status: 'fail', message: 'No service found with that ID' });
        }
        res.status(200).json({
            status: 'success',
            data: { service }
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// --- UPDATE A SERVICE ---
// Accessible by: Admin, Collaborateur
exports.updateService = async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!service) {
      return res.status(404).json({ status: 'fail', message: 'No service found with that ID' });
    }

    res.status(200).json({
      status: 'success',
      data: {
        service,
      },
    });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

// --- DELETE A SERVICE ---
// Accessible by: Admin
exports.deleteService = async (req, res) => {
    try {
        const service = await Service.findByIdAndDelete(req.params.id);

        if (!service) {
            return res.status(404).json({ status: 'fail', message: 'No service found with that ID' });
        }

        res.status(204).json({
            status: 'success',
            data: null,
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};