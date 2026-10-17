export function normalizeBase(value: string): string;
export function resolveDeployment(
  env?: Record<string, string | undefined>,
  overrides?: { mountPath?: string; cookiePrefix?: string },
): { mountPath: string; cookiePrefix: string };
