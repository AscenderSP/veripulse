/**
 * Vehicle RC verification adapter. Supports Surepass and Cashfree Parivahan.
 * Select via VAHAN_PROVIDER. Returns a normalized result either way.
 *
 * NOTE: endpoint paths and payload shapes follow each provider's public RC
 * API at time of writing; confirm against your account's current docs and
 * adjust the two provider functions if they version their API.
 */

export interface VahanResult {
  verified: boolean;
  status: string; // e.g. ACTIVE
  maker: string;
  model: string;
  owner_name_masked: string;
  raw: unknown;
}

async function verifySurepass(rcNumber: string): Promise<VahanResult> {
  const token = process.env.SUREPASS_API_TOKEN;
  if (!token) throw new Error('SUREPASS_API_TOKEN not set');
  const res = await fetch('https://kyc-api.surepass.io/api/v1/rc/rc-full', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id_number: rcNumber }),
  });
  const data = await res.json();
  const d = data?.data ?? {};
  const owner: string = d.owner_name ?? '';
  return {
    verified: res.ok && Boolean(d.rc_number),
    status: (d.rc_status ?? d.status ?? 'UNKNOWN').toString().toUpperCase(),
    maker: d.maker_description ?? d.maker_model ?? '',
    model: d.maker_model ?? d.vehicle_manufacturer_name ?? '',
    owner_name_masked: owner ? `${owner.slice(0, 1)}••••` : '',
    raw: data,
  };
}

async function verifyCashfree(rcNumber: string): Promise<VahanResult> {
  const clientId = process.env.CASHFREE_CLIENT_ID;
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Cashfree creds not set');
  const res = await fetch('https://api.cashfree.com/verification/vehicle-rc', {
    method: 'POST',
    headers: {
      'x-client-id': clientId,
      'x-client-secret': clientSecret,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ vehicle_number: rcNumber }),
  });
  const data = await res.json();
  return {
    verified: res.ok && (data?.status ?? '').toUpperCase() === 'VALID',
    status: (data?.rc_status ?? data?.status ?? 'UNKNOWN').toString().toUpperCase(),
    maker: data?.maker_description ?? '',
    model: data?.maker_model ?? '',
    owner_name_masked: data?.owner_name ? `${data.owner_name.slice(0, 1)}••••` : '',
    raw: data,
  };
}

export async function verifyRc(rcNumber: string): Promise<VahanResult> {
  const provider = (process.env.VAHAN_PROVIDER || 'surepass').toLowerCase();
  return provider === 'cashfree'
    ? verifyCashfree(rcNumber)
    : verifySurepass(rcNumber);
}
