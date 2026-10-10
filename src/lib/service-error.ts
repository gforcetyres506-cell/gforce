/** Configuration and persistence failures must never become business success. */
export class ServiceUnavailableError extends Error {
  constructor(message = 'Service unavailable. Please try again later.') {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}
