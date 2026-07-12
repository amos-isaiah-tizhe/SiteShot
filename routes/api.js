const express   = require('express');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const apiAuth   = require('../middleware/apiAuth');
const { createPage } = require('../utils/browserPool');
const cloudinary = require('../jobs/cloudinaryUpload');
const logger    = require('../utils/logger');

const router = express.Router();

// ---- Rate limiters per plan ----
const freeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.apiUser?._id.toString(),
  handler: (req, res) => res.status(429).json({
    success: false,
    error: 'Rate limit exceeded. Free plan allows 60 requests/hour.'
  }),
});

const proLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 1000,
  keyGenerator: (req) => req.apiUser?._id.toString(),
  handler: (req, res) => res.status(429).json({
    success: false,
    error: 'Rate limit exceeded. Pro plan allows 1,000 requests/hour.'
  }),
});

function planLimiter(req, res, next) {
  const plan = req.apiUser?.plan || 'free';
  if (plan === 'business') return next();
  if (plan === 'pro')      return proLimiter(req, res, next);
  return freeLimiter(req, res, next);
}

// ---- POST /api/v1/screenshot ----
router.post('/v1/screenshot', apiAuth, planLimiter, async (req, res) => {
  const { url, width, height, fullPage, format } = req.body;

  if (!url) return res.status(400).json({ success: false, error: 'url is required.' });
  try { new URL(url); } catch {
    return res.status(400).json({ success: false, error: 'Invalid URL.' });
  }

  const w          = parseInt(width)  || 1280;
  const h          = parseInt(height) || 1024;
  const isFullPage = fullPage === true || fullPage === 'true';
  const fmt        = ['jpg', 'png', 'pdf'].includes(format) ? format : 'jpg';
  const startMs    = Date.now();

  let page;
  try {
    page = await createPage(w, h);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 70000 });
      await new Promise(r => setTimeout(r, 2000));
    } catch (gotoErr) {
      if (!gotoErr.message.includes('timeout')) {
        await page.close();
        return res.status(500).json({ success: false, error: 'Failed to load the page.' });
      }
    }

    let fileBuffer;
    let mimeType;

    if (fmt === 'pdf') {
      fileBuffer = await page.pdf({ format: 'A4', printBackground: true });
      mimeType   = 'application/pdf';
    } else {
      const imgType = fmt === 'png' ? 'png' : 'jpeg';
      fileBuffer = await page.screenshot({
        type: imgType,
        fullPage: isFullPage,
        ...(imgType === 'jpeg' && { quality: 90 }),
      });
      mimeType = `image/${imgType}`;
    }

    await page.close();

    const tookMs = Date.now() - startMs;
    const shotId = uuidv4();

    // Upload to Cloudinary if configured — returns real URL
    let imageUrl = `https://siteshot.onexportalhq.com/api/v1/shots/${shotId}`;
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      const uploaded = await cloudinary.upload(fileBuffer, fmt, req.apiUser._id);
      if (uploaded) imageUrl = uploaded;
    }

    logger.info(`API screenshot: ${url} by user ${req.apiUser._id} in ${tookMs}ms`);

    res.status(200).json({
      success: true,
      imageUrl,
      file: `data:${mimeType};base64,${fileBuffer.toString('base64')}`,
      meta: { width: w, height: h, tookMs, format: fmt, fullPage: isFullPage },
    });

  } catch (err) {
    logger.error(`API screenshot error: ${err.message}`);
    if (page) await page.close().catch(() => {});
    res.status(500).json({ success: false, error: 'Failed to capture screenshot.' });
  }
});

module.exports = router;
