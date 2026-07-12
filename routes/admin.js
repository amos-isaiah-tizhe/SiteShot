const express = require('express');
const { requireAdmin } = require('../middleware/adminAuth');
const User = require('../models/User');
const Contact = require('../models/Contact');
const logger = require('../utils/logger');

const router = express.Router();

// ---- Admin dashboard ----
router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      freeUsers,
      proUsers,
      businessUsers,
      totalContacts,
      recentUsers,
      recentContacts,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ plan: 'free' }),
      User.countDocuments({ plan: 'pro' }),
      User.countDocuments({ plan: 'business' }),
      Contact.countDocuments(),
      User.find().sort({ createdAt: -1 }).limit(10).select('-password -apiKey'),
      Contact.find().sort({ createdAt: -1 }).limit(10),
    ]);

    res.render('admin/dashboard', {
      title: 'Admin — OneXp SiteShot',
      description: '',
      stats: { totalUsers, freeUsers, proUsers, businessUsers, totalContacts },
      recentUsers,
      recentContacts,
    });
  } catch (err) {
    logger.error(`Admin dashboard error: ${err.message}`);
    res.redirect('/');
  }
});

// ---- Users list ----
router.get('/admin/users', requireAdmin, async (req, res) => {
  try {
    const page  = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip  = (page - 1) * limit;
    const search = req.query.search || '';

    const query = search
      ? { $or: [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }] }
      : {};

    const [users, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).select('-password'),
      User.countDocuments(query),
    ]);

    res.render('admin/users', {
      title: 'Users — Admin',
      description: '',
      users,
      total,
      page,
      pages: Math.ceil(total / limit),
      search,
    });
  } catch (err) {
    logger.error(`Admin users error: ${err.message}`);
    res.redirect('/admin');
  }
});

// ---- Update user plan ----
router.post('/admin/users/:id/plan', requireAdmin, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!['free', 'pro', 'business'].includes(plan)) {
      return res.status(400).json({ success: false, error: 'Invalid plan' });
    }
    await User.findByIdAndUpdate(req.params.id, { plan });
    logger.info(`Admin: Updated user ${req.params.id} plan to ${plan}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---- Delete user ----
router.post('/admin/users/:id/delete', requireAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    logger.info(`Admin: Deleted user ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---- Contacts list ----
router.get('/admin/contacts', requireAdmin, async (req, res) => {
  try {
    const page  = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip  = (page - 1) * limit;

    const [contacts, total] = await Promise.all([
      Contact.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      Contact.countDocuments(),
    ]);

    res.render('admin/contacts', {
      title: 'Contacts — Admin',
      description: '',
      contacts,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    logger.error(`Admin contacts error: ${err.message}`);
    res.redirect('/admin');
  }
});

// ---- Delete contact ----
router.post('/admin/contacts/:id/delete', requireAdmin, async (req, res) => {
  try {
    await Contact.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
