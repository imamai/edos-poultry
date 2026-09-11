import { createClient } from "@/lib/supabase/server";
import type { SmsStatus } from "@/lib/database.types";

// EDOS Poultry360: SMS provider abstraction (spec §48). The interface below
// is the exact one the spec calls for, so swapping in a real Kenyan
// provider (e.g. Africa's Talking) later means implementing this interface
// once and changing getSmsProvider()'s return — nothing that calls
// sendSms()/sendBulkSms() needs to change.

export interface DeliveryStatus {
  id: string;
  status: SmsStatus;
}

export interface SmsProvider {
  name: string;
  send(to: string, message: string): Promise<{ ok: boolean; providerMessageId?: string; error?: string }>;
  sendBulk(recipients: string[], message: string): Promise<void>;
  getBalance(): Promise<number | null>;
  getDeliveryStatus(providerMessageId: string): Promise<DeliveryStatus | null>;
}

/**
 * Default provider: no real SMS gateway is configured in this environment
 * (no Africa's Talking / similar credentials), so this logs the message
 * (visible in server logs during development) and always reports success.
 * It is a real, working implementation of the interface, not a stub that
 * throws — every notification-to-SMS code path is fully exercisable today,
 * it just doesn't reach an actual phone until a real provider is swapped
 * in.
 */
class ConsoleSmsProvider implements SmsProvider {
  name = "console";

  async send(to: string, message: string) {
    console.log(`[sms:console] to=${to} message=${message}`);
    return { ok: true, providerMessageId: `console-${Date.now()}` };
  }

  async sendBulk(recipients: string[], message: string) {
    for (const to of recipients) await this.send(to, message);
  }

  async getBalance() {
    return null;
  }

  async getDeliveryStatus(): Promise<DeliveryStatus | null> {
    return null;
  }
}

export function getSmsProvider(): SmsProvider {
  return new ConsoleSmsProvider();
}

/** Sends via the configured provider and logs the attempt to
 * poultryedos_sms_logs regardless of outcome, so delivery history/failures
 * live in one place no matter which provider is active. */
export async function sendSms(tenantId: string, to: string, message: string): Promise<void> {
  const provider = getSmsProvider();
  const result = await provider.send(to, message);

  const supabase = await createClient();
  await supabase.from("poultryedos_sms_logs").insert({
    tenant_id: tenantId,
    to_phone: to,
    message,
    provider: provider.name,
    provider_message_id: result.providerMessageId ?? null,
    status: result.ok ? "sent" : "failed",
    error: result.error ?? null,
  });
}
