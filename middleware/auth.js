exports.requireAuth = (req, res, next) => {
  if (req.session && req.session.userId) return next();
  req.flash('error', 'Please log in to access that page.');
  res.redirect('/login');
};

exports.redirectIfAuth = (req, res, next) => {
  if (req.session && req.session.userId) return res.redirect('/');
  next();
};
