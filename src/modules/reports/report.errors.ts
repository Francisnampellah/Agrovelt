export class ReportApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public details: Record<string, unknown> = {}
  ) {
    super(message)
    this.name = 'ReportApiError'
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      details: this.details
    }
  }
}
