const functions = require('@google-cloud/functions-framework');
const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');

// Initialize Secret Manager client outside the function handler for better performance
const secretClient = new SecretManagerServiceClient();

const STRIPE_SECRET_NAME = 'projects/YOUR_GCP_PROJECT_ID/secrets/stripe_secret_key/versions/latest'; // Update with your secret path
const STRIPE_WEBHOOK_SECRET_NAME = 'projects/YOUR_GCP_PROJECT_ID/secrets/stripe_webhook_secret/versions/latest';

// Access the Stripe Secret
async function accessStripeSecret() {
  const [version] = await secretClient.accessSecretVersion({
    name: STRIPE_SECRET_NAME,
  });

  const payload = version.payload.data.toString();
  return payload;
}

async function accessStripeWebhookSecret() {
    const [version] = await secretClient.accessSecretVersion({
      name: STRIPE_WEBHOOK_SECRET_NAME,
    });
  
    const payload = version.payload.data.toString();
    return payload;
  }

// Cloud Function to handle Stripe webhooks
functions.http('handleStripeWebhook', async (req, res) => {

  const stripeSecret = await accessStripeSecret();
  const stripe = require('stripe')(stripeSecret);
  const webhookSecret = await accessStripeWebhookSecret();
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err) {
    console.error(err);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('PaymentIntent was successful!', paymentIntent);
      // Generate receipt, update database (e.g., Firestore), etc.
      break;
    // ... handle other event types
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});