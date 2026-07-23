const dashboardService = require('../services/finance/hotelFinancialDashboardService');

exports.getSummary = async (req, res, next) => { try {
  const filters = dashboardService.validateDashboardFilters(req.query);
  const summary = await dashboardService.getHotelFinancialDashboardSummary({ user: req.user, filters });
  res.json({ status: 'success', data: { filters, summary } });
} catch (e) { next(e); } };

exports.getTrends = async (req, res, next) => { try {
  const filters = dashboardService.validateDashboardFilters(req.query);
  const trends = await dashboardService.getHotelFinancialDashboardTrends({ user: req.user, filters });
  res.json({ status: 'success', data: { filters, trends } });
} catch (e) { next(e); } };

exports.getBreakdown = async (req, res, next) => { try {
  const filters = dashboardService.validateDashboardFilters(req.query);
  const dimension = String(req.query.dimension || 'hotel');
  const breakdown = await dashboardService.getHotelFinancialDashboardBreakdown({ user: req.user, filters, dimension });
  res.json({ status: 'success', data: { filters, breakdown } });
} catch (e) { next(e); } };

exports.getAging = async (req, res, next) => { try {
  const filters = dashboardService.validateDashboardFilters(req.query);
  const aging = await dashboardService.getHotelFinancialDashboardAging({ user: req.user, filters });
  res.json({ status: 'success', data: { filters, aging } });
} catch (e) { next(e); } };

exports.getAlerts = async (req, res, next) => { try {
  const filters = dashboardService.validateDashboardFilters(req.query);
  const alerts = await dashboardService.getHotelFinancialDashboardAlerts({ user: req.user, filters });
  res.json({ status: 'success', data: { filters, ...alerts } });
} catch (e) { next(e); } };
