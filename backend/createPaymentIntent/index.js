const functions = require('@google-cloud/functions-framework');
const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');

// Initialize Secret Manager client outside the function handler for better performance
const secretClient = new SecretManagerServiceClient();

const STRIPE_SECRET_NAME = 'projects/YOUR_GCP_PROJECT_ID/secrets/stripe_secret_key/versions/latest'; // Update with your secret path

// Access the Stripe Secret
async function accessStripeSecret() {
  const [version] = await secretClient.accessSecretVersion({
    name: STRIPE_SECRET_NAME,
  });

  const payload = version.payload.data.toString();
  return payload;
}

// Cloud Function to create a Payment Intent
functions.http('createPaymentIntent', async (req, res) => {
  // Enable CORS for all origins
  res.set('Access-Control-Allow-Origin', '*');

  // Handle preflight requests for CORS
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }

  // Ensure the request method is POST
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { amount, customer } = req.body;

  try {
    const stripeSecret = await accessStripeSecret();
    const stripe = require('stripe')(stripeSecret);

    // Create a customer in Stripe (optional)
    const stripeCustomer = await stripe.customers.create({
        name: customer.name,
        email: customer.email,
        address: customer.address,
    });

    // Create a PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      payment_method_types: ['us_bank_account'],
      customer: stripeCustomer.id, // Associate the payment with the customer
      receipt_email: customer.email, // Send receipt to customer's email
    });

    res.json({ client_secret: paymentIntent.client_secret });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred' });
  }
});