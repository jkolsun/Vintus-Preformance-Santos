/** Standard API response wrapper */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** JWT token payload */
export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

/** Pagination params */
export interface PaginationParams {
  page: number;
  limit: number;
}

/** Paginated response */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
