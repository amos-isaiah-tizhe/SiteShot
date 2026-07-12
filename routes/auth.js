const crypto = require('crypto');
const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { requireAuth, redirectIfAuth } = require('../middleware/auth');
const nodemailer = require('nodemailer');
// Create reusable transporter object using the default SMTP transport
const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const router = express.Router();

// GET /register
router.get('/register', redirectIfAuth, (req, res) => {
  res.render('register', {
    title: 'Create account — OneXp SiteShot',
    errors: [],
    old: {},
    flashError: req.flash('error'),
  });
});

// POST /register
router.post(
  '/register',
  redirectIfAuth,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('register', {
        title: 'Create account — OneXp SiteShot',
        errors: errors.array(),
        old: req.body,
        flashError: [],
      });
    }

    try {
      const existing = await User.findOne({ email: req.body.email });
      if (existing) {
        return res.render('register', {
          title: 'Create account — OneXp SiteShot',
          errors: [{ msg: 'An account with that email already exists.' }],
          old: req.body,
          flashError: [],
        });
      }

      const { v4: uuidv4 } = require('uuid');

// Generate email verification token
const verifyToken  = crypto.randomBytes(32).toString('hex');
const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

const user = await User.create({
  name:     req.body.name,
  email:    req.body.email,
  password: req.body.password,
  apiKey:   `sshot_${uuidv4().replace(/-/g, '')}`,
  isVerified:        false,
  verifyToken,
  verifyTokenExpiry: verifyExpiry,
});

// Send verification email
const verifyUrl = `${process.env.APP_URL}/verify-email?token=${verifyToken}`;

await mailer.sendMail({
  from:    `"OneXp SiteShot" <${process.env.MAIL_USER}>`,
  to:      user.email,
  subject: 'Verify your OneXp SiteShot email',
  html: `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#7c3aed">Verify your email</h2>
      <p>Hi ${user.name}, thanks for signing up!</p>
      <p>Click the button below to verify your email address. This link expires in 24 hours.</p>
      <a href="${verifyUrl}" style="display:inline-block;background:#7c3aed;color:white;padding:0.75rem 1.5rem;border-radius:8px;text-decoration:none;font-weight:600;margin:1rem 0">
        Verify email
      </a>
      <p style="color:#6b7280;font-size:0.85rem">Or copy this link: ${verifyUrl}</p>
      <p style="color:#6b7280;font-size:0.85rem">If you didn't create an account, ignore this email.</p>
    </div>
  `,
});

// Don't log them in yet — send to check-email page
res.redirect('/check-email');
   } catch (err) {
      console.error('REGISTER ERROR:', err.message);
      res.render('register', {
        title: 'Create account — OneXp SiteShot',
        errors: [{ msg: `Error: ${err.message}` }],
        old: req.body,
        flashError: [],
      });
    }
  }
);

// GET /login
router.get('/login', redirectIfAuth, (req, res) => {
  res.render('login', {
    title: 'Log in — OneXp SiteShot',
    errors: [],
    old: {},
    flashError: req.flash('error'),
  });
});

// POST /login
router.post(
  '/login',
  redirectIfAuth,
  [
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('login', {
        title: 'Log in — OneXp SiteShot',
        errors: errors.array(),
        old: req.body,
        flashError: [],
      });
    }

    try {
      const user = await User.findOne({ email: req.body.email });
      if (!user || !(await user.comparePassword(req.body.password))) {
        return res.render('login', {
          title: 'Log in — OneXp SiteShot',
          errors: [{ msg: 'Invalid email or password.' }],
          old: req.body,
          flashError: [],
        });
      }

      // Block unverified accounts
if (!user.isVerified) {
  return res.render('login', {
    title: 'Log in — OneXp SiteShot',
    errors: [{ msg: 'Please verify your email before logging in. Check your inbox.' }],
    old: req.body,
    flashError: [],
  });
}

      req.session.userId = user._id;
      req.session.userName = user.name;
      res.redirect('/');
    } catch (err) {
      console.error(err);
      res.render('login', {
        title: 'Log in — OneXp SiteShot',
        errors: [{ msg: 'Something went wrong. Please try again.' }],
        old: req.body,
        flashError: [],
      });
    }
  }
);

// POST /logout
router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// GET /check-email — shown after registration
router.get('/check-email', (req, res) => {
  res.render('check-email', {
    title: 'Check your email — OneXp SiteShot',
  });
});

// GET /verify-email — handles the link click
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;

  if (!token) return res.redirect('/login');

  try {
    const user = await User.findOne({
      verifyToken:        token,
      verifyTokenExpiry:  { $gt: new Date() },
    });

    if (!user) {
      return res.render('login', {
        title: 'Log in — OneXp SiteShot',
        errors: [{ msg: 'Verification link is invalid or has expired. Please register again.' }],
        old: {},
        flashError: [],
      });
    }

    // Mark verified and clear token
    user.isVerified        = true;
    user.verifyToken       = null;
    user.verifyTokenExpiry = null;
    await user.save();

    // Log them in automatically
    req.session.userId  = user._id;
    req.session.userName = user.name;
    req.session.isAdmin  = user.isAdmin || false;

    res.redirect('/?verified=1');

  } catch (err) {
    console.error('Email verify error:', err.message);
    res.redirect('/login');
  }
});

// POST /resend-verification
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email: email?.toLowerCase() });

    // Always show success to prevent email enumeration
    if (!user || user.isVerified) {
      return res.json({ success: true });
    }

    const verifyToken  = crypto.randomBytes(32).toString('hex');
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    user.verifyToken       = verifyToken;
    user.verifyTokenExpiry = verifyExpiry;
    await user.save();

    const verifyUrl = `${process.env.APP_URL}/verify-email?token=${verifyToken}`;

    await mailer.sendMail({
      from:    `"OneXp SiteShot" <${process.env.MAIL_USER}>`,
      to:      user.email,
      subject: 'Verify your OneXp SiteShot email',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#7c3aed">Verify your email</h2>
          <p>Hi ${user.name}, here's your new verification link.</p>
          <a href="${verifyUrl}" style="display:inline-block;background:#7c3aed;color:white;padding:0.75rem 1.5rem;border-radius:8px;text-decoration:none;font-weight:600;margin:1rem 0">
            Verify email
          </a>
          <p style="color:#6b7280;font-size:0.85rem">This link expires in 24 hours.</p>
        </div>
      `,
    });

    res.json({ success: true });
  } catch (err) {
    res.json({ success: false });
  }
});

module.exports = router;
