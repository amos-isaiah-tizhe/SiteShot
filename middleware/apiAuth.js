const User = require('../models/User');

module.exports = async (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Missing or invalid Authorization header. Expected: Bearer YOUR_API_KEY'
    });
  }

  const apiKey = authHeader.split(' ')[1];

  try {
    const user = await User.findOne({ apiKey });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key.'
      });
    }
    req.apiUser = user;
    next();
  } catch (err) {
    console.error('API auth error:', err.message);
    res.status(500).json({ success: false, error: 'Server error during authentication.' });
  }
};