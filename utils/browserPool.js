const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Only use safe stealth evasions — skip ones that call bringToFront
const stealth = StealthPlugin();
stealth.enabledEvasions = new Set([
  'chrome.app',
  'chrome.csi',
  'chrome.loadTimes',
  'chrome.runtime',
  'defaultArgs',
  'navigator.hardwareConcurrency',
  'navigator.languages',
  'navigator.permissions',
  'navigator.plugins',
  'navigator.vendor',
  'navigator.webdriver',
  'sourceurl',
  'user-agent-override',
  'webgl.vendor',
  'window.outerdimensions',
]);
puppeteer.use(stealth);
const logger = require('./logger');



const isWindows = process.platform === 'win32';

function getChromePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (isWindows) {
    return 'C:\\Users\\USER\\.cache\\puppeteer\\chrome\\win64-150.0.7871.24\\chrome-win64\\chrome.exe';
  }
  // Auto-find on Linux
  const { execSync } = require('child_process');
  try {
    const found = execSync(
      'find /opt/render/project/.cache/puppeteer -name "chrome" -type f 2>/dev/null | head -1'
    ).toString().trim();
    if (found) return found;
  } catch {}
  return '/opt/render/project/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome';
}

const CHROME_PATH = getChromePath();

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-blink-features=AutomationControlled',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-ipc-flooding-protection',
  '--no-first-run',
  '--no-zygote',
  '--mute-audio',
  '--hide-scrollbars',
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
];

let browserInstance = null;
let browserLaunchPromise = null;
logger.info(`Using Chrome at: ${CHROME_PATH}`);
async function getBrowser() {
  // On Render free tier — always launch fresh to avoid OOM crashes
  if (!isWindows && process.env.NODE_ENV === 'production') {
    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath: CHROME_PATH,
      args: LAUNCH_ARGS,
    });
    logger.info('Browser launched (per-request mode)');
    return browser;
  }

  // Local dev — reuse single instance
  if (browserInstance) {
    try {
      await browserInstance.version();
      return browserInstance;
    } catch {
      logger.warn('Browser instance crashed, relaunching...');
      browserInstance = null;
    }
  }

  if (browserLaunchPromise) return browserLaunchPromise;

  browserLaunchPromise = puppeteer.launch({
    headless: 'new',
    executablePath: CHROME_PATH,
    args: LAUNCH_ARGS,
  }).then(browser => {
    browserInstance = browser;
    browserLaunchPromise = null;
    logger.info('Browser instance launched');
    browser.on('disconnected', () => {
      logger.warn('Browser disconnected, will relaunch on next request');
      browserInstance = null;
    });
    return browser;
  }).catch(err => {
    browserLaunchPromise = null;
    throw err;
  });

  return browserLaunchPromise;
}

async function createPage(width = 1440, height = 900) {
  const browser = await getBrowser();

  // Use existing blank page if available to avoid bringToFront conflict
  const page = await browser.newPage();

  const isPerRequest = !isWindows && process.env.NODE_ENV === 'production';
  page._browserInstance = browser;
  page._isPerRequest    = isPerRequest;

  // Stealth settings
  await page.setUserAgent(USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]);
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  await page.setViewport({ width, height, deviceScaleFactor: 1 });

  // Request interception
  try {
    await page.setRequestInterception(true);
    page.on('request', (interceptedReq) => {
      if (!interceptedReq.isInterceptResolutionHandled()) {
        const blocked = ['websocket', 'other'];
        blocked.includes(interceptedReq.resourceType())
          ? interceptedReq.abort()
          : interceptedReq.continue();
      }
    });
  } catch (err) {
    logger.warn('Request interception unavailable:', err.message);
  }

  return page;
}

async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    logger.info('Browser instance closed');
  }
}

module.exports = { getBrowser, createPage, closeBrowser, USER_AGENTS, CHROME_PATH, LAUNCH_ARGS };
