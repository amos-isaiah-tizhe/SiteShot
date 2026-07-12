const express = require('express');
const { body, validationResult } = require('express-validator');
const Contact = require('../models/Contact');
const nodemailer = require('nodemailer');
const { createPage } = require('../utils/browserPool');
const { incrementCount } = require('../middleware/planEnforce');
const logger = require('../utils/logger');

const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const router = express.Router();

const DEVICE_PRESETS = {
  desktop: { width: 1440, height: 900 },
  tablet:  { width: 768,  height: 1024 },
  mobile:  { width: 390,  height: 844 },
};

// Home
router.get('/', (req, res) => {
  res.render('index', {
    title: 'OneXp SiteShot — Instant Website Screenshots',
    description: 'Generate full-page, device-accurate website screenshots from any URL. Free, fast and developer friendly.',
  });
});

// API docs
router.get('/api', (req, res) => {
  res.render('api', {
    title: 'API — OneXp SiteShot',
    description: 'Automate website screenshots with the OneXp SiteShot REST API.',
  });
});

// Pricing
router.get('/pricing', (req, res) => {
  res.render('pricing', {
    title: 'Pricing — OneXp SiteShot',
    description: 'Simple, transparent pricing. Start free and scale with Pro or Business plans.',
  });
});

// FAQ
router.get('/faq', (req, res) => {
  res.render('faq', {
    title: 'FAQ — OneXp SiteShot',
    description: 'Frequently asked questions about OneXp SiteShot screenshots, API and billing.',
  });
});

// Contact GET
router.get('/contact', (req, res) => {
  res.render('contact', {
    title: 'Contact — OneXp SiteShot',
    description: 'Talk to the OneXp SiteShot team about plans, integrations or enterprise support.',
    sent: false,
    errors: [],
    old: {},
  });
});

// Contact POST
router.post(
  '/contact',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('subject').trim().notEmpty().withMessage('Subject is required'),
    body('message').trim().notEmpty().withMessage('Message is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('contact', {
        title: 'Contact — OneXp SiteShot',
        description: 'Talk to the OneXp SiteShot team.',
        sent: false,
        errors: errors.array(),
        old: req.body,
      });
    }

    try {
      await Contact.create({
        name: req.body.name,
        email: req.body.email,
        subject: req.body.subject,
        message: req.body.message,
      });

      await mailer.sendMail({
        from: `"OneXp SiteShot" <${process.env.MAIL_USER}>`,
        to: process.env.MAIL_USER,
        replyTo: req.body.email,
        subject: `[Contact] ${req.body.subject}`,
        html: `
          <p><strong>Name:</strong> ${req.body.name}</p>
          <p><strong>Email:</strong> ${req.body.email}</p>
          <p><strong>Subject:</strong> ${req.body.subject}</p>
          <p><strong>Message:</strong><br>${req.body.message.replace(/\n/g, '<br>')}</p>
        `,
      });

      res.render('contact', {
        title: 'Contact — OneXp SiteShot',
        description: 'Talk to the OneXp SiteShot team.',
        sent: true,
        errors: [],
        old: {},
      });
    } catch (err) {
      logger.error(`Contact form error: ${err.message}`);
      res.render('contact', {
        title: 'Contact — OneXp SiteShot',
        description: 'Talk to the OneXp SiteShot team.',
        sent: false,
        errors: [{ msg: 'Something went wrong. Please try again.' }],
        old: req.body,
      });
    }
  }
);

// ---- Screenshot API (web capture) ----
router.get('/api/screenshot', async (req, res) => {
  const { url, width, height, fullPage, format } = req.query;

  if (!url) return res.status(400).json({ error: 'URL is required' });
  try { new URL(url); } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  // ---- Guest rate limiting (5 captures per 24 hours) ----
  if (!req.session.userId) {
    const now        = Date.now();
    const windowMs   = 24 * 60 * 60 * 1000; // 24 hours
    const guestLimit = 5;

    if (!req.session.guestCaptures) {
      req.session.guestCaptures = { count: 0, windowStart: now };
    }

    const guest = req.session.guestCaptures;

    // Reset window if 24 hours have passed
    if (now - guest.windowStart > windowMs) {
      guest.count       = 0;
      guest.windowStart = now;
    }

    if (guest.count >= guestLimit) {
      return res.status(429).json({
        error:       'guest_limit',
        message:     'You have used all 5 free captures for today.',
        registerUrl: '/register',
      });
    }

    guest.count++;
    req.session.guestCaptures = guest;
  }

  const device = DEVICE_PRESETS[req.query.device] || null;
  const w = device ? device.width  : (parseInt(width)  || 1440);
  const h = device ? device.height : (parseInt(height) || 900);

  let page;
  try {
    page = await createPage(w, h);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 70000 });
      await new Promise(r => setTimeout(r, 2000));
    } catch (gotoErr) {
      if (!gotoErr.message.includes('timeout')) {
        await page.close();
        return res.status(500).json({ error: 'Failed to load the page.' });
      }
    }

    if (format === 'pdf') {
      const pdf = await page.pdf({ format: 'A4', printBackground: true });
      await page.close();
      if (req.session?.userId) await incrementCount(req.session.userId);
      res.setHeader('Content-Type', 'application/pdf');
      return res.send(pdf);
    }

    // Scroll to trigger lazy content
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 300;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            resolve();
          }
        }, 100);
      });
    });
    await new Promise(r => setTimeout(r, 1000));

    const imgFormat = format === 'png' ? 'png' : 'jpeg';
    const image = await page.screenshot({
      type: imgFormat,
      fullPage: fullPage === 'true',
      ...(imgFormat === 'jpeg' && { quality: 90 }),
    });

    await page.close();
    if (req.session?.userId) await incrementCount(req.session.userId);

    res.setHeader('Content-Type', `image/${imgFormat}`);
    res.send(image);

  } catch (err) {
    logger.error(`Screenshot error: ${err.message}`);
    if (page) await page.close().catch(() => {});
    res.status(500).json({ error: 'Failed to capture screenshot' });
  }
});

module.exports = router;
