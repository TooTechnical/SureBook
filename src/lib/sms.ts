export type SmsMessage = { to: string; body: string; idempotencyKey: string };
export type SmsProvider = { configured: boolean; name: string; send(message: SmsMessage): Promise<{ providerMessageId: string }> };

export function getSmsProvider(): SmsProvider {
  return {
    configured: false,
    name: "not configured",
    async send() { throw new Error("SMS provider not configured"); },
  };
}
