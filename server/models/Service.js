const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'A service must have a title'],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      required: [true, 'A service must have a description'],
      trim: true,
    },
    pole: {
      type: String,
      required: [true, 'A service must be associated with a pole'],
      enum: ['Altimmo', 'Mila Events', 'Altcom'],
    },
    // For Mila Events, price could be a starting price "à partir de"
    price: {
      type: Number,
      required: [true, 'A service must have a price or a starting price'],
    },
    // Optional: add an image or icon for better presentation on the frontend
    imageUrl: {
        type: String,
    },
    // For Mila Events, this could hold detailed options for the quote generator
    options: [
        {
            name: String,
            price: Number,
            description: String,
        }
    ]
  },
  {
    timestamps: true,
  }
);

const Service = mongoose.model('Service', serviceSchema);

module.exports = Service;