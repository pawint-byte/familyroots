export const PRODUCT_MARKUP_PERCENT = 100;
export const SHIPPING_BUFFER_PERCENT = 20;
export const FALLBACK_TAX_RATE = 0.0955;

const STATE_TAX_RATES: Record<string, number> = {
  AL: 0.04,
  AK: 0.0,
  AZ: 0.056,
  AR: 0.065,
  CA: 0.0725,
  CO: 0.029,
  CT: 0.0635,
  DE: 0.0,
  DC: 0.06,
  FL: 0.06,
  GA: 0.04,
  HI: 0.04,
  ID: 0.06,
  IL: 0.0625,
  IN: 0.07,
  IA: 0.06,
  KS: 0.065,
  KY: 0.06,
  LA: 0.0445,
  ME: 0.055,
  MD: 0.06,
  MA: 0.0625,
  MI: 0.06,
  MN: 0.06875,
  MS: 0.07,
  MO: 0.04225,
  MT: 0.0,
  NE: 0.055,
  NV: 0.0685,
  NH: 0.0,
  NJ: 0.06625,
  NM: 0.05125,
  NY: 0.04,
  NC: 0.0475,
  ND: 0.05,
  OH: 0.0575,
  OK: 0.045,
  OR: 0.0,
  PA: 0.06,
  RI: 0.07,
  SC: 0.06,
  SD: 0.042,
  TN: 0.07,
  TX: 0.0625,
  UT: 0.0610,
  VT: 0.06,
  VA: 0.053,
  WA: 0.065,
  WV: 0.06,
  WI: 0.05,
  WY: 0.04,
};

export function getRetailPrice(printfulCostCents: number): number {
  return Math.round(printfulCostCents * (1 + PRODUCT_MARKUP_PERCENT / 100));
}

export function getBufferedShipping(printfulShippingCents: number): number {
  return Math.round(printfulShippingCents * (1 + SHIPPING_BUFFER_PERCENT / 100));
}

export function getStateTaxRate(stateCode: string): number {
  if (!stateCode) return FALLBACK_TAX_RATE;
  const rate = STATE_TAX_RATES[stateCode.toUpperCase()];
  return rate !== undefined ? rate : FALLBACK_TAX_RATE;
}

export function getRetailPriceFromDollars(printfulCostDollars: number): number {
  return Math.round(printfulCostDollars * 100 * (1 + PRODUCT_MARKUP_PERCENT / 100));
}
