export class APIError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "APIError";
  }
}

export const BadRequest = (message: string) => new APIError(400, message);
export const NotFound = (message: string) => new APIError(404, message);
export const InternalError = (message = "Internal server error") =>
  new APIError(500, message);
