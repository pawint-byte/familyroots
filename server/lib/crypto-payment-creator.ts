import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { cryptoPayments } from '@shared/models/auth';

export interface PendingCryptoPayment {
  id: string;
  status: string;
  toAddress: string;
  expectedAmount: string;
  expectedAsset: string;
  usdAmount: number;
  destinationTag?: string;
  expiresAt: string;
}

interface WalletConfiguration {
  address: string;
  asset: string;
  usdPerAsset: number;
  destinationTag?: string;
}

interface CryptoPaymentRecord extends PendingCryptoPayment {
  userId: string;
  purchaseType: 'plan' | 'addon';
  purchaseKey: string;
  chain: string;
}

export interface CryptoPaymentRepository {
  create(record: Omit<CryptoPaymentRecord, 'id'>): Promise<CryptoPaymentRecord>;
}

const databaseRepository: CryptoPaymentRepository = {
  async create(record) {
    const [created] = await db.insert(cryptoPayments).values({
      userId: record.userId,
      purchaseType: record.purchaseType,
      purchaseKey: record.purchaseKey,
      chain: record.chain,
      status: record.status,
      toAddress: record.toAddress,
      expectedAmount: record.expectedAmount,
      expectedAsset: record.expectedAsset,
      usdAmount: record.usdAmount.toFixed(2),
      destinationTag: record.destinationTag,
      expiresAt: new Date(record.expiresAt),
    }).returning();

    return {
      ...record,
      id: created.id,
    };
  },
};

export class CryptoPaymentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoPaymentValidationError';
  }
}

function readWallets(env: NodeJS.ProcessEnv): Record<string, WalletConfiguration> {
  if (!env.CRYPTO_PAYMENT_PROVIDER) {
    throw new CryptoPaymentValidationError('CRYPTO_PAYMENT_PROVIDER is not configured');
  }
  if (!env.CRYPTO_PAYMENT_WALLETS_JSON) {
    throw new CryptoPaymentValidationError('CRYPTO_PAYMENT_WALLETS_JSON is not configured');
  }

  try {
    const parsed = JSON.parse(env.CRYPTO_PAYMENT_WALLETS_JSON);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('wallet map required');
    }
    return parsed;
  } catch {
    throw new CryptoPaymentValidationError('CRYPTO_PAYMENT_WALLETS_JSON is invalid');
  }
}

export function getConfiguredCryptoAddresses(env: NodeJS.ProcessEnv = process.env) {
  const wallets = readWallets(env);
  return Object.entries(wallets).map(([chain, wallet]) => ({
    chain,
    toAddress: wallet.address,
    expectedAsset: wallet.asset,
    ...(wallet.destinationTag ? { destinationTag: wallet.destinationTag } : {}),
  }));
}

export async function createCryptoPayment(params: {
  userId: string;
  purchaseType: 'plan' | 'addon';
  purchaseKey: string;
  chain: unknown;
  usdAmount: number;
  env?: NodeJS.ProcessEnv;
  repository?: CryptoPaymentRepository;
  now?: Date;
}): Promise<PendingCryptoPayment> {
  const requestedChain =
    typeof params.chain === 'string' ? params.chain.trim().toLowerCase() : '';

  // Stripe presents the networks actually available to the customer. This
  // value is a preference only and is never treated as a wallet address.
  if (!/^[a-z0-9][a-z0-9_-]{1,31}$/.test(requestedChain)) {
    throw new CryptoPaymentValidationError('Valid chain preference required');
  }

  if (!Number.isInteger(params.usdAmount) || params.usdAmount <= 0) {
    throw new CryptoPaymentValidationError('Valid USD amount required');
  }

  const env = params.env || process.env;
  const wallet = readWallets(env)[requestedChain];
  if (
    !wallet ||
    typeof wallet.address !== 'string' ||
    !wallet.address.trim() ||
    typeof wallet.asset !== 'string' ||
    !wallet.asset.trim() ||
    typeof wallet.usdPerAsset !== 'number' ||
    !Number.isFinite(wallet.usdPerAsset) ||
    wallet.usdPerAsset <= 0
  ) {
    throw new CryptoPaymentValidationError(`Crypto payments are not configured for chain: ${requestedChain}`);
  }

  const expiryMinutes = Number(env.CRYPTO_PAYMENT_EXPIRY_MINUTES || '30');
  if (!Number.isInteger(expiryMinutes) || expiryMinutes <= 0) {
    throw new CryptoPaymentValidationError('CRYPTO_PAYMENT_EXPIRY_MINUTES is invalid');
  }

  const expectedAmount = (params.usdAmount / wallet.usdPerAsset)
    .toFixed(8)
    .replace(/\.?0+$/, '');
  const now = params.now || new Date();
  const expiresAt = new Date(now.getTime() + expiryMinutes * 60_000).toISOString();
  const repository = params.repository || databaseRepository;
  const created = await repository.create({
    userId: params.userId,
    purchaseType: params.purchaseType,
    purchaseKey: params.purchaseKey,
    chain: requestedChain,
    status: 'pending',
    toAddress: wallet.address.trim(),
    expectedAmount,
    expectedAsset: wallet.asset.trim(),
    usdAmount: params.usdAmount,
    ...(wallet.destinationTag ? { destinationTag: wallet.destinationTag } : {}),
    expiresAt,
  });

  return {
    id: created.id,
    status: created.status,
    toAddress: created.toAddress,
    expectedAmount: created.expectedAmount,
    expectedAsset: created.expectedAsset,
    usdAmount: created.usdAmount,
    ...(created.destinationTag ? { destinationTag: created.destinationTag } : {}),
    expiresAt: created.expiresAt,
  };
}

export async function getCryptoPaymentStatus(
  id: string,
  userId: string,
): Promise<PendingCryptoPayment | null> {
  const [payment] = await db.select().from(cryptoPayments).where(
    and(eq(cryptoPayments.id, id), eq(cryptoPayments.userId, userId)),
  );
  if (!payment) return null;

  let status = payment.status;
  if (status === 'pending' && payment.expiresAt.getTime() <= Date.now()) {
    status = 'expired';
    await db.update(cryptoPayments)
      .set({ status, updatedAt: new Date() })
      .where(eq(cryptoPayments.id, payment.id));
  }

  return {
    id: payment.id,
    status,
    toAddress: payment.toAddress,
    expectedAmount: payment.expectedAmount,
    expectedAsset: payment.expectedAsset,
    usdAmount: Number(payment.usdAmount),
    ...(payment.destinationTag ? { destinationTag: payment.destinationTag } : {}),
    expiresAt: payment.expiresAt.toISOString(),
  };
}