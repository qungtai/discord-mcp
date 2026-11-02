export class PToolError extends Error {
  constructor(
    message: string,
    public readonly category: string,
    public readonly retryable: boolean,
    public readonly remediation: string,
    public readonly operationId?: string,
    public readonly resourceIds: Record<string, string> = {},
  ) {
    super(message);
    this.name = "PToolError";
  }
}
