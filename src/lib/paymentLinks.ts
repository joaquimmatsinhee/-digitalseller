/**
 * Map of price tiers to Walled checkout URLs
 */
export const PAYMENT_LINKS: Record<number, string> = {
  5: 'https://pay.trywalled.com/18e51104-a9f5-4d1e-9c6a-e90b90bda8d3',
  10: 'https://pay.trywalled.com/10d7830d-98ed-4ae5-a1c7-e1d2b9803c5d',
  15: 'https://pay.trywalled.com/b05c54d1-a9ca-4bf0-8829-2fed6bf3e3b1',
  25: 'https://pay.trywalled.com/3b3dcc87-15a0-4775-bf61-9e5eb49a5846',
  30: 'https://pay.trywalled.com/56ad3d76-33f0-4e4b-b11b-2abaefebb7d8',
  35: 'https://pay.trywalled.com/fc16edb5-d9ab-46e7-bf2f-d854531fdfb6',
  40: 'https://pay.trywalled.com/48173dd8-f799-47e9-8ef0-8df8e1785ee1',
  45: 'https://pay.trywalled.com/6c8a1ebe-27df-477a-b9f8-3b0c96a467e7',
  50: 'https://pay.trywalled.com/643aba9e-072b-47d9-9978-8630b0e64ba5',
  55: 'https://pay.trywalled.com/e6e3a829-2ad7-4d00-ac75-80b2ba7135b3',
  60: 'https://pay.trywalled.com/2a368967-2356-4940-b20c-2c8553feefe1',
  65: 'https://pay.trywalled.com/4ab71b06-e9d2-4d10-8fca-c133b63f480f',
  70: 'https://pay.trywalled.com/5366ffad-9767-43bc-85de-c949e3786acf',
  75: 'https://pay.trywalled.com/2a01fe63-da42-49a9-94df-bf118a3eadce',
  80: 'https://pay.trywalled.com/8d943004-5ca2-41bf-b362-b2203b20006c',
  85: 'https://pay.trywalled.com/161f369b-966d-4702-80ae-b6e512ba803f',
  100: 'https://pay.trywalled.com/334ea898-3980-4ddd-bc5f-76c9727ea20a',
  110: 'https://pay.trywalled.com/a5f27d0a-dfb5-4676-b3f0-d66d7963c55e',
  125: 'https://pay.trywalled.com/1adf096e-8b81-4f45-a6df-cc56fba5631a',
  150: 'https://pay.trywalled.com/3400dcce-113a-4c91-881d-efd0f01cd596',
  180: 'https://pay.trywalled.com/94ac1bdf-74bf-434d-9627-f736a8005355',
  250: 'https://pay.trywalled.com/8f674064-9f83-4e8e-9789-f4aee26a6306',
  350: 'https://pay.trywalled.com/5de120e6-eb83-4919-9ea9-b64008f69cc1',
};

/**
 * Returns the exact Walled link matching the price, or matches to the nearest available price tier.
 */
export function getPaymentUrlForPrice(rawPrice: number | string): string {
  const num = typeof rawPrice === 'string' ? parseFloat(rawPrice.replace(/[^0-9.]/g, '')) : rawPrice;
  if (isNaN(num) || num <= 5) {
    return PAYMENT_LINKS[5];
  }

  // Exact tier match
  if (PAYMENT_LINKS[num]) {
    return PAYMENT_LINKS[num];
  }

  const tiers = Object.keys(PAYMENT_LINKS)
    .map(Number)
    .sort((a, b) => a - b);

  const minTier = tiers[0];
  const maxTier = tiers[tiers.length - 1];

  if (num <= minTier) {
    return PAYMENT_LINKS[minTier];
  }
  if (num >= maxTier) {
    return PAYMENT_LINKS[maxTier];
  }

  // Find the closest available tier
  let closestTier = tiers[0];
  let minDiff = Math.abs(num - closestTier);
  for (const tier of tiers) {
    const diff = Math.abs(num - tier);
    if (diff < minDiff) {
      minDiff = diff;
      closestTier = tier;
    }
  }

  return PAYMENT_LINKS[closestTier] || PAYMENT_LINKS[5];
}
