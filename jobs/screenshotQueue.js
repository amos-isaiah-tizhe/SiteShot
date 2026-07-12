const { Queue, Worker, QueueEvents } = require('bullmq');
const logger = require('../utils/logger');

// Redis connection config
const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

// ---- Queue ----
const screenshotQueue = new Queue('screenshots', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
});

// ---- Queue Events (for webhook notifications) ----
const queueEvents = new QueueEvents('screenshots', { connection: redisConnection });

// ---- Worker ----
let worker = null;

function startWorker() {
  const { createPage } = require('../utils/browserPool');
  const cloudinary = require('./cloudinaryUpload');

  worker = new Worker(
    'screenshots',
    async (job) => {
      const { url, width, height, fullPage, format, userId } = job.data;
      logger.info(`Processing screenshot job ${job.id} for ${url}`);

      const page = await createPage(width, height);

      try {
        // Navigate
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 70000 });
          await new Promise(r => setTimeout(r, 2000));
        } catch (gotoErr) {
          if (!gotoErr.message.includes('timeout')) throw gotoErr;
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

        let fileBuffer;
        let mimeType;
        let ext;

        if (format === 'pdf') {
          fileBuffer = await page.pdf({ format: 'A4', printBackground: true });
          mimeType = 'application/pdf';
          ext = 'pdf';
        } else {
          const imgType = format === 'png' ? 'png' : 'jpeg';
          fileBuffer = await page.screenshot({
            type: imgType,
            fullPage: fullPage === true || fullPage === 'true',
            ...(imgType === 'jpeg' && { quality: 90 }),
          });
          mimeType = `image/${imgType}`;
          ext = imgType === 'jpeg' ? 'jpg' : 'png';
        }

     await page.close();
if (page._isPerRequest && page._browserInstance) {
  await page._browserInstance.close().catch(() => {});
}

        // Upload to Cloudinary if configured
        let imageUrl = null;
        if (process.env.CLOUDINARY_CLOUD_NAME) {
          imageUrl = await cloudinary.upload(fileBuffer, ext, userId);
        }

        logger.info(`Screenshot job ${job.id} completed`);

        return {
          success: true,
          imageUrl,
          file: `data:${mimeType};base64,${fileBuffer.toString('base64')}`,
          meta: { width, height, format: ext, fullPage },
        };

      } catch (err) {
        await page.close().catch(() => {});
        throw err;
      }
    },
    {
      connection: redisConnection,
      concurrency: 3, // Process up to 3 screenshots simultaneously
    }
  );

  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed: ${err.message}`);
  });

  logger.info('Screenshot worker started');
}

module.exports = { screenshotQueue, queueEvents, startWorker, redisConnection };
