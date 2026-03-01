// ============================================================
// API Response Types
// ============================================================

export type ApiResponse<T> =
  | {
      success: true;
      data: T;
      message?: string;
    }
  | {
      success: false;
      error: string;
      details?: Record<string, string[]>;
    };

// ============================================================
// Paginated Response
// ============================================================

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// ============================================================
// Utility Types
// ============================================================

/**
 * Make selected keys of T optional.
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make selected keys of T required.
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> &
  Required<Pick<T, K>>;

/**
 * Extract the data type from a successful ApiResponse.
 */
export type ExtractData<T> = T extends { success: true; data: infer D }
  ? D
  : never;

/**
 * Search/filter params commonly used in list endpoints.
 */
export type ListQueryParams = {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};
