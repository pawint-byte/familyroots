export interface CryptoCheckoutOptions {
  paymentMethodTypes: ['crypto'];
  metadata: {
    requestedChain: string;
    paymentChannel: 'crypto';
  };
}

export class CryptoPaymentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoPaymentValidationError';
  }
}

export async function createCryptoPayment<TSession>(params: {
  chain: unknown;
  createCheckout: (options: CryptoCheckoutOptions) => Promise<TSession>;
}): Promise<{ session: TSession; requestedChain: string }> {
  const requestedChain =
    typeof params.chain === 'string' ? params.chain.trim().toLowerCase() : '';

  // Stripe presents the networks actually available to the customer. This
  // value is a preference only and is never treated as a wallet address.
  if (!/^[a-z0-9][a-z0-9_-]{1,31}$/.test(requestedChain)) {
    throw new CryptoPaymentValidationError('Valid chain preference required');
  }

  const session = await params.createCheckout({
    paymentMethodTypes: ['crypto'],
    metadata: {
      requestedChain,
      paymentChannel: 'crypto',
    },
  });

  return { session, requestedChain };
}