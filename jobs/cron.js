const cron = require('node-cron');
const User = require('../models/User');
const logger = require('../utils/logger');

function startCronJobs() {
  // ---- Monthly screenshot count reset ----
  // Runs at midnight on the 1st of every month
  cron.schedule('0 0 1 * *', async () => {
    logger.info('CRON: Running monthly screenshot count reset...');
    try {
      const result = await User.updateMany(
        {},
        {
          $set: {
            screenshotsThisMonth: 0,
            screenshotsResetDate: new Date(
              new Date().setMonth(new Date().getMonth() + 1)
            ),
          },
        }
      );
      logger.info(`CRON: Reset screenshot counts for ${result.modifiedCount} users`);
    } catch (err) {
      logger.error(`CRON: Monthly reset failed: ${err.message}`);
    }
  }, { timezone: 'Africa/Lagos' });

  // ---- Expired subscription downgrade ----
  // Runs every day at 1am — downgrades users whose subscription has expired
  cron.schedule('0 1 * * *', async () => {
    logger.info('CRON: Checking for expired subscriptions...');
    try {
      const now = new Date();
      const result = await User.updateMany(
        {
          subscriptionStatus: 'active',
          subscriptionEndDate: { $lt: now },
          plan: { $ne: 'free' },
        },
        {
          $set: {
            plan: 'free',
            subscriptionStatus: 'inactive',
            billingCycle: 'monthly',
          },
        }
      );
      if (result.modifiedCount > 0) {
        logger.info(`CRON: Downgraded ${result.modifiedCount} expired subscriptions to free`);
      }
    } catch (err) {
      logger.error(`CRON: Subscription downgrade failed: ${err.message}`);
    }
  }, { timezone: 'Africa/Lagos' });

  logger.info('CRON: Jobs scheduled (monthly reset + subscription expiry check)');
}

module.exports = { startCronJobs };
