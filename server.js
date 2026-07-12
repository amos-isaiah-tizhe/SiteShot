require('dotenv').config();
const express      = require('express');
const session      = require('express-session');
const MongoStore   = require('connect-mongo');
const flash        = require('connect-flash');
const path         = require('path');
const helmet       = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
const rateLimit    = require('express-rate-limit');

const connectDB    = require('./config/db');
const logger       = require('./utils/logger');
const { startCronJobs } = require('./jobs/cron');
const { getBrowser } = require('./utils/browserPool');

const app  = express();
const PORT = process.env.PORT || 3000;

// Connect MongoDB
connectDB();

// ---- Security: Helmet (HTTP headers) ----
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", 'cdnjs.cloudflare.com', 'fonts.googleapis.com'],
      styleSrc:    ["'self'", "'unsafe-inline'", 'fonts.googleapis.com', 'cdnjs.cloudflare.com'],
      fontSrc:     ["'self'", 'fonts.gstatic.com', 'cdnjs.cloudflare.com'],
      imgSrc:      ["'self'", 'data:', 'blob:', '*.cloudinary.com', 'v6.exchangerate-api.com'],
      connectSrc:  ["'self'", 'v6.exchangerate-api.com'],
      frameSrc:    ["'self'", 'blob:'],
      workerSrc:   ["'self'"],
      manifestSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ---- Security: MongoDB injection sanitize ----
app.use(mongoSanitize());

// ---- Cookie parser ----
app.use(cookieParser());

// ---- View engine ----
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ---- Body parsing ----
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '10mb' }));

// ---- Static files ----
app.use(express.static(path.join(__dirname, 'public')));

// ---- Global rate limit (anti-abuse) ----
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests, please slow down.' },
  skip: (req) => req.path.startsWith('/admin'), // Don't limit admin
}));

// ---- Session (stored in MongoDB) ----
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 60 * 60 * 24 * 7, // 7 days
    touchAfter: 24 * 3600,  // Lazy session update
  }),
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge:   1000 * 60 * 60 * 24 * 7,
  },
}));

// ---- Flash messages ----
app.use(flash());

// ---- Global locals ----
app.use((req, res, next) => {
  res.locals.isLoggedIn  = !!req.session.userId;
  res.locals.isAdmin     = !!req.session.isAdmin;
  res.locals.userName    = req.session.userName || '';
  res.locals.currentPath = req.path;
  res.locals.title       = 'OneXp SiteShot';
  res.locals.description = 'Instant website screenshots — free, fast and developer friendly.';
  res.locals.query = req.query;
  next();
});

// ---- Request logging ----
app.use((req, res, next) => {
  if (!req.path.includes('/api/screenshot')) {
    logger.debug(`${req.method} ${req.path}`);
  }
  next();
});

// ---- PWA / SEO / GEO static routes ----
app.get('/offline',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'offline.html')));
app.get('/sitemap.xml', (req, res) => { res.setHeader('Content-Type', 'application/xml'); res.sendFile(path.join(__dirname, 'public', 'sitemap.xml')); });
app.get('/robots.txt',  (req, res) => { res.setHeader('Content-Type', 'text/plain'); res.sendFile(path.join(__dirname, 'public', 'robots.txt')); });
app.get('/llms.txt',    (req, res) => { res.setHeader('Content-Type', 'text/plain'); res.sendFile(path.join(__dirname, 'public', 'llms.txt')); });

// ---- Routes ----
app.use('/',     require('./routes/pages'));
app.use('/',     require('./routes/auth'));
app.use('/',     require('./routes/dashboard'));
app.use('/',     require('./routes/payment'));
app.use('/',     require('./routes/admin'));
app.use('/api',  require('./routes/api'));

// ---- 404 ----
app.use((req, res) => {
  res.status(404).render('404', { title: '404 — Page Not Found' });
});

// ---- Error handler ----
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.stack}`);
  res.status(500).render('500', { title: '500 — Server Error' });
});

// ---- Start server ----
app.listen(PORT, async () => {
  logger.info(`OneXp SiteShot running at http://localhost:${PORT}`);

  // Pre-warm browser on startup
  try {
    await getBrowser();
    logger.info('Browser pre-warmed and ready');
  } catch (err) {
    logger.warn(`Browser pre-warm failed (will retry on first request): ${err.message}`);
  }

  // Start cron jobs
  startCronJobs();
});

// ---- Graceful shutdown ----
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  const { closeBrowser } = require('./utils/browserPool');
  await closeBrowser();
  process.exit(0);
});
