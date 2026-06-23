// Internal AI gateway transport config. Strings here are required by the
// upstream service contract and intentionally isolated to this single file.
export const GATEWAY_BASE_URL = "https://ai.gateway.lovable.dev/v1";
export const GATEWAY_AUTH_HEADER = "Lovable-API-Key";
export const GATEWAY_SDK_HEADER = "X-Lovable-AIG-SDK";
export const GATEWAY_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";
export const GATEWAY_SDK_VALUE = "vercel-ai-sdk";

export function getGatewayApiKey(): string | undefined {
  return process.env.AI_GATEWAY_API_KEY ?? process.env.LOVABLE_API_KEY;
}

export function gatewayHeaders(apiKey: string): Record<string, string> {
  return {
    [GATEWAY_AUTH_HEADER]: apiKey,
    [GATEWAY_SDK_HEADER]: GATEWAY_SDK_VALUE,
  };
}
