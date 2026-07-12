const User = require('../models/User');

exports.requireAdmin = async (req, res, next) => {
  if (!req.session?.userId) {
    return res.redirect('/login');
  }

  try {
    // Always verify from DB — session may be stale
    const user = await User.findById(req.session.userId).select('isAdmin');
    if (!user || !user.isAdmin) {
      return res.status(403).render('404', { title: '403 — Forbidden' });
    }
    // Sync session
    req.session.isAdmin = true;
    next();
  } catch (err) {
    return res.redirect('/login');
  }
};