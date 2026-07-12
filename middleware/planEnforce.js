const User = require('../models/User');

// BETA: All users get Pro access until payment is live
const BETA_MODE = true;

const PLAN_LIMITS = {
  free: BETA_MODE ? 100 : 100,
  pro: BETA_MODE ? 100 : 100,
  business: BETA_MODE ? Infinity : Infinity,
};

const PLAN_FORMATS = {
  free: BETA_MODE ? ['jpg', 'png', 'pdf'] : ['jpg'],
  pro: ['jpg', 'png', 'pdf'],
  business: ['jpg', 'png', 'pdf'],
};

module.exports = {
  PLAN_LIMITS,
  PLAN_FORMATS,

  // For session-based web routes
  async enforceWebLimit(req, res, next) {
    try {
      const user = await User.findById(req.session.userId);
      if (!user) return next();

      // Reset monthly count if needed
      if (new Date() > new Date(user.screenshotsResetDate)) {
        user.screenshotsThisMonth = 0;
        user.screenshotsResetDate = new Date(
          new Date().setMonth(new Date().getMonth() + 1)
        );
        await user.save();
      }

      const limit = PLAN_LIMITS[user.plan];
      if (user.screenshotsThisMonth >= limit) {
        return res.status(403).json({
          success: false,
          error: `Monthly limit of ${limit} screenshots reached. Please upgrade your plan.`,
          upgradeUrl: '/pricing'
        });
      }

      // Check format
      const format = req.query.format || 'jpg';
      if (!PLAN_FORMATS[user.plan].includes(format)) {
        return res.status(403).json({
          success: false,
          error: `${format.toUpperCase()} format is not available on your current plan.`,
          upgradeUrl: '/pricing'
        });
      }

      req.captureUser = user;
      next();
    } catch (err) {
      console.error('Plan enforce error:', err.message);
      next();
    }
  },

  // For API key-based routes
  async enforceApiLimit(req, res, next) {
    try {
      const user = req.apiUser;

      // Reset monthly count if needed
      if (new Date() > new Date(user.screenshotsResetDate)) {
        user.screenshotsThisMonth = 0;
        user.screenshotsResetDate = new Date(
          new Date().setMonth(new Date().getMonth() + 1)
        );
        await user.save();
      }

      const limit = PLAN_LIMITS[user.plan];
      if (user.screenshotsThisMonth >= limit) {
        return res.status(403).json({
          success: false,
          error: `Monthly limit of ${limit} screenshots reached.`,
          upgradeUrl: 'https://siteshot.onexportalhq.com/pricing'
        });
      }

      const format = req.body.format || 'jpg';
      if (!PLAN_FORMATS[user.plan].includes(format)) {
        return res.status(403).json({
          success: false,
          error: `${format.toUpperCase()} format not available on your plan.`,
          upgradeUrl: 'https://siteshot.onexportalhq.com/pricing'
        });
      }

      next();
    } catch (err) {
      console.error('API plan enforce error:', err.message);
      next();
    }
  },

  // Increment screenshot count after successful capture
  async incrementCount(userId) {
    await User.findByIdAndUpdate(userId, {
      $inc: { screenshotsThisMonth: 1 }
    });
  }
};