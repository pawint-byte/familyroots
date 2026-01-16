import { getUncachableStripeClient } from '../server/stripeClient';

async function createProducts() {
  const stripe = await getUncachableStripeClient();

  console.log('Checking for existing products...');
  
  const existingProducts = await stripe.products.list({ limit: 100 });
  const freeExists = existingProducts.data.find(p => p.name === 'Free Plan');
  const premiumExists = existingProducts.data.find(p => p.name === 'Premium Plan');

  if (freeExists && premiumExists) {
    console.log('Products already exist. Skipping creation.');
    return;
  }

  if (!freeExists) {
    console.log('Creating Free Plan product...');
    const freeProduct = await stripe.products.create({
      name: 'Free Plan',
      description: 'Basic family tree features - 1 tree, up to 20 members',
      metadata: {
        tier: 'free',
        maxTrees: '1',
        maxMembers: '20',
      },
    });

    await stripe.prices.create({
      product: freeProduct.id,
      unit_amount: 0,
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    console.log('Free Plan created:', freeProduct.id);
  }

  if (!premiumExists) {
    console.log('Creating Premium Plan product...');
    const premiumProduct = await stripe.products.create({
      name: 'Premium Plan',
      description: 'Unlimited family trees, unlimited members, timeline view, collaboration features, priority support',
      metadata: {
        tier: 'premium',
        maxTrees: 'unlimited',
        maxMembers: 'unlimited',
      },
    });

    await stripe.prices.create({
      product: premiumProduct.id,
      unit_amount: 999,
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    console.log('Premium Plan created:', premiumProduct.id);
  }

  console.log('Product seeding complete!');
}

createProducts().catch(console.error);
