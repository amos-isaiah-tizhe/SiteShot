const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const User     = require('../models/User');
const { PLAN_LIMITS } = require('../middleware/planEnforce');

const router   = express.Router();

router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);

    const limit     = PLAN_LIMITS[user.plan];
    const used      = user.screenshotsThisMonth;
    const remaining = limit === Infinity ? 'Unlimited' : Math.max(0, limit - used);
    const percent   = limit === Infinity ? 0 : Math.min(100, Math.round((used / limit) * 100));

    res.render('dashboard', {
      title:       'Dashboard — OneXp SiteShot',
      description: 'Manage your account, API key and subscription.',
      user,
      limit:       limit === Infinity ? 'Unlimited' : limit,
      used,
      remaining,
      percent,
      paymentSuccess: req.query.payment === 'success',
      paymentFailed:  req.query.payment === 'failed',
    });
  } catch (err) {
    console.error('Dashboard error:', err.message);
    res.redirect('/');
  }
});

// Rotate API key
router.post('/dashboard/rotate-key', requireAuth, async (req, res) => {
  try {
    const newKey = `sshot_${uuidv4().replace(/-/g, '')}`;
    await User.findByIdAndUpdate(req.session.userId, { apiKey: newKey });
    res.json({ success: true, apiKey: newKey });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to rotate API key.' });
  }
});

module.exports = router;