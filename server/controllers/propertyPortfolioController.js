const asyncHandler = require('express-async-handler');
const { getPropertyPortfolio } = require('../services/propertyPortfolioService');

exports.list = asyncHandler(async (req, res) => {
  const portfolio = await getPropertyPortfolio({ scopeUserIds: req.tenantScopeUserIds });
  res.status(200).json({ status: 'success', results: portfolio.items.length, data: portfolio });
});
