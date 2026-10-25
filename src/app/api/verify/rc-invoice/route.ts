import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, createSupabaseAdminClient } from '@/lib/supabase/server';
import { ocrDocument } from '@/lib/gemini';
import { verifyRc } from '@/lib/vahan';
import { ownershipIdentityHash, maskIdentifier, sha256Bytes } from '@/lib/crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * POST /api/verify/rc-invoice
 * Body: { image_base64, mime }
 *
 * Pipeline (§3.2):
 *   1. Auth. SHA-256 of the raw image bytes (forensic fingerprint).
 *   2. Gemini Vision OCR + pixel-forensic tamper check.  Fail → 400 + flag.
 *   3. If vehicle_rc → Surepass/Cashfree Parivahan: status ACTIVE & maker match.
 *   4. Compute SHA-256 identity hash. Already present → 409 (duplicate asset).
 *   5. Insert ownership_verifications (unlocks badge, 3x vote weight, 20% pool).
 * Every rejection is logged to verification_flags.
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await getRequestUser();
    if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

    const body = await req.json();
    const imageB64: string = (body.image_base64 ?? '').replace(/^data:[^;]+;base64,/, '');
    const mime: string = body.mime ?? 'image/jpeg';
    if (!imageB64) return NextResponse.json({ error: 'NO_IMAGE' }, { status: 400 });

    const bytes = Buffer.from(imageB64, 'base64');
    if (bytes.length > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'IMAGE_TOO_LARGE' }, { status: 413 });
    }
    const imageSha = sha256Bytes(bytes);
    const admin = createSupabaseAdminClient();

    const flag = (reason: string, detail: unknown) =>
      admin.from('verification_flags').insert({
        user_id: user.id,
        image_sha256: imageSha,
        reason,
        detail,
      });

    // ── 2. OCR + tamper forensics ──
    const ocr = await ocrDocument(imageB64, mime);
    if (!ocr.tamper_check_passed) {
      await flag('TAMPER_DETECTED', { notes: ocr.tamper_notes, confidence: ocr.ocr_confidence });
      return NextResponse.json(
        {
          error: 'TAMPER_DETECTED',
          tamper_check_passed: false,
          tamper_notes: ocr.tamper_notes,
          ocr_confidence: ocr.ocr_confidence,
        },
        { status: 400 },
      );
    }

    const cleanId = (ocr.registration_or_invoice_no || '').toUpperCase().replace(/[\s-]/g, '');
    const uniqueSerial = (ocr.chassis_or_gstin || '').toUpperCase().replace(/[\s-]/g, '');
    if (!cleanId || !uniqueSerial) {
      return NextResponse.json({ error: 'OCR_INCOMPLETE', ocr }, { status: 422 });
    }

    // ── 3. Government source-of-truth for vehicle RC ──
    if (ocr.doc_type === 'vehicle_rc') {
      const vahan = await verifyRc(cleanId);
      const makerMatches =
        !ocr.make ||
        vahan.maker.toLowerCase().includes(ocr.make.toLowerCase()) ||
        ocr.make.toLowerCase().includes(vahan.maker.toLowerCase());
      if (!vahan.verified || vahan.status !== 'ACTIVE' || !makerMatches) {
        await flag('VAHAN_MISMATCH', { status: vahan.status, maker: vahan.maker, ocr_make: ocr.make });
        return NextResponse.json(
          { error: 'VAHAN_MISMATCH', status: vahan.status, maker: vahan.maker },
          { status: 422 },
        );
      }
    }

    // ── 4/5. Identity hash + insert. The UNIQUE(document_hash) constraint is
    //         the real duplicate guard, so concurrent submissions can't race. ──
    const docHash = ownershipIdentityHash(ocr.doc_type, cleanId, uniqueSerial);
    const { data: inserted, error: insErr } = await admin
      .from('ownership_verifications')
      .insert({
        user_id: user.id,
        document_type: ocr.doc_type,
        product_category: ocr.product_category || (ocr.doc_type === 'vehicle_rc' ? 'Vehicle' : 'Other'),
        brand_model: `${ocr.make} ${ocr.model}`.trim(),
        document_hash: docHash,
        image_sha256: imageSha,
        masked_identifier: maskIdentifier(cleanId),
        purchase_date: ocr.purchase_date,
        ocr_confidence: ocr.ocr_confidence,
        tamper_check_passed: true,
      })
      .select('id, product_category, brand_model, masked_identifier')
      .single();

    if (insErr) {
      if (insErr.code === '23505') {
        await flag('DUPLICATE_ASSET', { document_hash: docHash });
        return NextResponse.json({ error: 'DUPLICATE_ASSET' }, { status: 409 });
      }
      return NextResponse.json({ error: 'INSERT_FAILED', detail: insErr.message }, { status: 500 });
    }

    // Badge + tier bump (never downgrades a sentinel).
    const { data: prof } = await admin.from('profiles').select('tier').eq('id', user.id).single();
    await admin
      .from('profiles')
      .update({
        badge: 'Verified Owner',
        ...(prof?.tier === 'sentinel_t1' ? {} : { tier: 'validator_t2' }),
      })
      .eq('id', user.id);

    return NextResponse.json({
      verification: inserted,
      perks: {
        verified_owner_badge: true,
        vote_weight_multiplier: 3,
        affiliate_pool_pct: 20,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    return NextResponse.json({ error: 'SERVER_ERROR', detail: msg }, { status: 500 });
  }
}
