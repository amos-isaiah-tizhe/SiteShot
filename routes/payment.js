const express = require('express');
const axios = require('axios');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

const PLANS = {
  pro: {
    monthly: { ngn: 150000, name: 'Pro Monthly' },   // in kobo for Paystack
    annual: { ngn: 1440000, name: 'Pro Annual' },
  },
  business: {
    monthly: { ngn: 250000, name: 'Business Monthly' },
    annual: { ngn: 2400000, name: 'Business Annual' },
  },
};

// ---- Paystack: Initialize payment ----
router.post('/payment/paystack/initialize', requireAuth, async (req, res) => {
  const { plan, cycle } = req.body;

  if (!PLANS[plan] || !PLANS[plan][cycle]) {
    return res.status(400).json({ success: false, error: 'Invalid plan or cycle.' });
  }

  const user = await User.findById(req.session.userId);
  const amount = PLANS[plan][cycle].ngn;
  const name = PLANS[plan][cycle].name;

  try {
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: user.email,
        amount,
        currency: 'NGN',
        metadata: {
          userId: user._id.toString(),
          plan,
          cycle,
          name,
        },
        callback_url: `${process.env.APP_URL || 'https://siteshot.onexportalhq.com'}/payment/paystack/callback`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({ success: true, authorizationUrl: response.data.data.authorization_url });
  } catch (err) {
    console.error('Paystack init error:', err.message);
    res.status(500).json({ success: false, error: 'Payment initialization failed.' });
  }
});

// ---- Paystack: Callback after payment ----
router.get('/payment/paystack/callback', async (req, res) => {
  const { reference } = req.query;

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      }
    );

    const data = response.data.data;

    if (data.status !== 'success') {
      return res.redirect('/dashboard?payment=failed');
    }

    const { userId, plan, cycle } = data.metadata;

    const endDate = new Date();
    if (cycle === 'annual') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    await User.findByIdAndUpdate(userId, {
      plan,
      billingCycle: cycle,
      subscriptionStatus: 'active',
      paymentProvider: 'paystack',
      paystackCustomerId: data.customer.customer_code,
      subscriptionStartDate: new Date(),
      subscriptionEndDate: endDate,
    });

    res.redirect('/dashboard?payment=success');
  } catch (err) {
    console.error('Paystack callback error:', err.message);
    res.redirect('/dashboard?payment=failed');
  }
});

// ---- Stripe: Create checkout session ----
router.post('/payment/stripe/initialize', requireAuth, async (req, res) => {
  const { plan, cycle } = req.body;

  if (!PLANS[plan] || !PLANS[plan][cycle]) {
    return res.status(400).json({ success: false, error: 'Invalid plan or cycle.' });
  }

  const user = await User.findById(req.session.userId);
  const amount = PLANS[plan][cycle].ngn;
  const name = PLANS[plan][cycle].name;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: user.email,
      line_items: [{
        price_data: {
          currency: 'ngn',
          unit_amount: amount,
          product_data: { name },
        },
        quantity: 1,
      }],
      metadata: {
        userId: user._id.toString(),
        plan,
        cycle,
      },
      success_url: `${process.env.APP_URL || 'https://siteshot.onexportalhq.com'}/payment/stripe/callback?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL || 'https://siteshot.onexportalhq.com'}/pricing`,
    });

    res.json({ success: true, authorizationUrl: session.url });
  } catch (err) {
    console.error('Stripe init error:', err.message);
    res.status(500).json({ success: false, error: 'Stripe payment initialization failed.' });
  }
});

// ---- Stripe: Callback after payment ----
router.get('/payment/stripe/callback', async (req, res) => {
  const { session_id } = req.query;

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== 'paid') {
      return res.redirect('/dashboard?payment=failed');
    }

    const { userId, plan, cycle } = session.metadata;

    const endDate = new Date();
    if (cycle === 'annual') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    await User.findByIdAndUpdate(userId, {
      plan,
      billingCycle: cycle,
      subscriptionStatus: 'active',
      paymentProvider: 'stripe',
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      subscriptionStartDate: new Date(),
      subscriptionEndDate: endDate,
    });

    res.redirect('/dashboard?payment=success');
  } catch (err) {
    console.error('Stripe callback error:', err.message);
    res.redirect('/dashboard?payment=failed');
  }
});

// ---- Cancel subscription ----
router.post('/payment/cancel', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);

    await User.findByIdAndUpdate(user._id, {
      plan: 'free',
      billingCycle: 'monthly',
      subscriptionStatus: 'cancelled',
      subscriptionEndDate: new Date(),
    });

    res.json({ success: true, message: 'Subscription cancelled. You have been moved to the Free plan.' });
  } catch (err) {
    console.error('Cancel error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to cancel subscription.' });
  }
});

module.exports = router;