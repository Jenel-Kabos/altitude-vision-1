const mongoose = require('mongoose');

const portfolioItemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'A portfolio item must have a title'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'A portfolio item must have a description'],
      trim: true,
    },
    pole: {
      type: String,
      required: [true, 'A portfolio item must be associated with a pole'],
      enum: ['Mila Events', 'Altcom'],
    },
    category: {
      type: String,
      required: [true, 'A portfolio item must have a category (e.g., Branding, Mariage)'],
      trim: true,
    },
    images: {
        type: [String],
        required: [true, 'A portfolio item must have at least one image.'],
    },
    videoUrl: {
      type: String,
      trim: true,
    },
    projectDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const PortfolioItem = mongoose.model('PortfolioItem', portfolioItemSchema);

module.exports = PortfolioItem;