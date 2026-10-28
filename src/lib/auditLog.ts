// ════════════════════════════════════════════════════════════════════════
//  VeriPulse — admin audit log writer
//  Writes to public.admin_actions via service-role client. RLS blocks all
//  non-service writes, so this file must only be imported from server code.
// ════════════════════════════════════════════════════════════════════════

import type { SupabaseClient, User } from '@supabase/supabase-js';
import { headers } from 'next/headers';

export interface AuditEntry {
  action: string;                  // takedown | restore | suspend | ...
  target_table: 'stories' | 'profiles' | 'products' | 'product_reviews';
  target_id: string;
  reason?: string | null;
  before_data?: unknown;
  after_data?: unknown;
}

/**
 * Record one admin action. Non-fatal — a failed audit must never prevent
 * the underlying action, but it is logged to the server console so ops
 * can backfill.
 */
export async function writeAudit(
  admin: SupabaseClient,
  actor: User,
  entry: AuditEntry,
): Promise<void> {
  try {
    const h = await headers();
    const ip =
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      h.get('x-real-ip') ??
      null;
    const ua = h.get('user-agent');
    const row = {
      actor_id: actor.id,
      actor_email: actor.email ?? null,
      action: entry.action,
      target_table: entry.target_table,
      target_id: entry.target_id,
      reason: entry.reason ?? null,
      before_data: entry.before_data ?? null,
      after_data: entry.after_data ?? null,
      ip_address: ip,
      user_agent: ua,
    };
    const { error } = await admin.from('admin_actions').insert(row);
    if (error) {
      console.error('[audit] insert failed', error.message, { entry });
    }
  } catch (err) {
    console.error('[audit] fatal', err, { entry });
  }
}
