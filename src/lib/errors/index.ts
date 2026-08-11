export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, code = "INTERNAL_SERVER_ERROR", details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 404, "NOT_FOUND", details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, "CONFLICT", details);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 413, "PAYLOAD_TOO_LARGE", details);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 422, "UNPROCESSABLE_ENTITY", details);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 429, "RATE_LIMIT_EXCEEDED", details);
  }
}

export class ProviderError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 502, "BAD_GATEWAY", details);
  }
}

export class InsufficientEvidenceError extends AppError {
  constructor(message = "Insufficient evidence retrieved to support claim", details?: unknown) {
    super(message, 422, "INSUFFICIENT_EVIDENCE", details);
  }
}

export class UnsupportedCapabilityError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 500, "UNSUPPORTED_CAPABILITY", details);
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 500, "CONFIGURATION_ERROR", details);
  }
}
