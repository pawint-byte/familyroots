import assert from "node:assert/strict";
import test from "node:test";
import {
  createCryptoPayment,
  CryptoPaymentValidationError,
  type CryptoPaymentRepository,
} from "../server/lib/crypto-payment-creator";

const env = {
  CRYPTO_PAYMENT_PROVIDER: "configured-provider",
  CRYPTO_PAYMENT_WALLETS_JSON: JSON.stringify({
    testchain: {
      address: "configured-address",
      asset: "TEST",
      usdPerAsset: 2,
      destinationTag: "configured-tag",
    },
  }),
  CRYPTO_PAYMENT_EXPIRY_MINUTES: "30",
};

function repository(): CryptoPaymentRepository {
  return {
    async create(record) {
      return { id: "pending-id", ...record };
    },
  };
}

test("returns the exact normalized pending shape for a plan", async () => {
  const pending = await createCryptoPayment({
    userId: "user",
    purchaseType: "plan",
    purchaseKey: "cultivator",
    chain: " TESTCHAIN ",
    usdAmount: 5,
    env,
    repository: repository(),
    now: new Date("2026-01-01T00:00:00.000Z"),
  });

  assert.deepEqual(pending, {
    id: "pending-id",
    status: "pending",
    toAddress: "configured-address",
    expectedAmount: "2.5",
    expectedAsset: "TEST",
    usdAmount: 5,
    destinationTag: "configured-tag",
    expiresAt: "2026-01-01T00:30:00.000Z",
  });
});

test("returns the same normalized pending shape for an addon", async () => {
  const pending = await createCryptoPayment({
    userId: "user",
    purchaseType: "addon",
    purchaseKey: "starter_10",
    chain: "testchain",
    usdAmount: 8,
    env,
    repository: repository(),
    now: new Date("2026-01-01T00:00:00.000Z"),
  });

  assert.deepEqual(Object.keys(pending), [
    "id", "status", "toAddress", "expectedAmount", "expectedAsset",
    "usdAmount", "destinationTag", "expiresAt",
  ]);
});

test("fails safely when provider or wallet configuration is missing", async () => {
  await assert.rejects(
    createCryptoPayment({
      userId: "user",
      purchaseType: "plan",
      purchaseKey: "cultivator",
      chain: "testchain",
      usdAmount: 5,
      env: {},
      repository: repository(),
    }),
    CryptoPaymentValidationError,
  );
});