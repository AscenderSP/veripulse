import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { DEMO_PRODUCTS, isSupabaseConfigured } from '@/lib/demoData';
import { buildSubId } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/affiliate/click?product=<productId>
 *
 * The Sub-ID (vp_{productId}_{reviewerId}_{timestamp}) is minted HERE from
 * the product's server-side primary reviewer — never taken from the client,
 * or a shopper could route the 20% reviewer share to themselves. The click
 * is logged to affiliate_clicks and the shopper is 302'd to the merchant with
 * the Sub-ID attached, which the merchant echoes back on its postback.
 */
export async function GET(req: NextRequest) {
  const productId = new URL(req.url).searchParams.get('product') ?? '';
  if (!/^[a-z0-9-]{1,80}$/i.test(productId)) {
    return NextResponse.json({ error: 'BAD_PRODUCT' }, { status: 400 });
  }

  let merchant = 'amazon';
  let merchantUrl = '';
  let reviewerId: string | null = null;

  if (isSupabaseConfigured()) {
    const admin = createSupabaseAdminClient();
    const { data: product } = await admin
      .from('products')
      .select('merchant, merchant_url, primary_reviewer_id')
      .eq('id', productId)
      .maybeSingle();
    if (!product) return NextResponse.json({ error: 'UNKNOWN_PRODUCT' }, { status: 404 });
    merchant = product.merchant;
    merchantUrl = product.merchant_url;
    reviewerId = product.primary_reviewer_id;
  } else {
    const demo = DEMO_PRODUCTS.find((p) => p.id === productId);
    if (!demo) return NextResponse.json({ error: 'UNKNOWN_PRODUCT' }, { status: 404 });
    merchant = demo.merchant.toLowerCase();
    merchantUrl = demo.merchantUrl;
  }

  const subId = buildSubId(productId, reviewerId ?? 'none');

  if (isSupabaseConfigured()) {
    try {
      await createSupabaseAdminClient().from('affiliate_clicks').insert({
        sub_id: subId,
        product_id: productId,
        primary_reviewer_id: reviewerId,
        merchant,
        conversion_status: 'clicked',
      });
    } catch {
      /* non-fatal — still redirect the shopper */
    }
  }

  const target = new URL(merchantUrl);
  // Each network's sub-id parameter.
  const param = { amazon: 'ascsubtag', flipkart: 'affExtParam1', cuelinks: 'subid' }[merchant] ?? 'subid';
  target.searchParams.set(param, subId);
  return NextResponse.redirect(target.toString(), 302);
}
