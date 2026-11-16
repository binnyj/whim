// Public entry point for @whim/shared: domain types and validation schemas used by web and api.
export {
  type ErrorCode,
  errorCodeSchema,
  type ErrorResponse,
  errorResponseSchema,
  type ValidationIssue,
  validationIssueSchema,
} from './errors.js';
export { type HealthResponse, healthResponseSchema } from './health.js';
