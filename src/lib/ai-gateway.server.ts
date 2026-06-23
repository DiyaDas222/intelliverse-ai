import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  GATEWAY_BASE_URL,
  GATEWAY_RUN_ID_HEADER,
  gatewayHeaders,
} from "@/lib/gateway-config.server";

const RUN_ID_HEADER = GATEWAY_RUN_ID_HEADER;

export function createGatewayProvider(apiKey: string, initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  let resolveRunId: (value: string | undefined) => void = () => {};
  let runIdResolved = false;
  const runIdReady = new Promise<string | undefined>((resolve) => {
    resolveRunId = resolve;
  });

  const publishRunId = (value?: string) => {
    const nextRunId = value?.trim() || undefined;
    if (!runId && nextRunId) runId = nextRunId;
    if (!runIdResolved) {
      runIdResolved = true;
      resolveRunId(runId);
    }
  };
  if (runId) publishRunId(runId);

  const provider = createOpenAICompatible({
    name: "intelliverse-gateway",
    baseURL: GATEWAY_BASE_URL,
    headers: gatewayHeaders(apiKey),
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(RUN_ID_HEADER)) {
        headers.set(RUN_ID_HEADER, runId);
      }
      try {
        const response = await fetch(input, { ...init, headers });
        publishRunId(response.headers.get(RUN_ID_HEADER) ?? undefined);
        return response;
      } catch (error) {
        publishRunId(undefined);
        throw error;
      }
    },
  });

  return Object.assign(provider, {
    getRunId: () => runId,
    waitForRunId: () => (runId ? Promise.resolve(runId) : runIdReady),
  });
}
