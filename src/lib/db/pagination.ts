export interface PageArgs {
  page?: number;
  pageSize?: number;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export function normalizePage(args: PageArgs, defaultPageSize = 20, maxPageSize = 100) {
  const page = Number.isInteger(args.page) && (args.page ?? 0) > 0 ? args.page! : 1;
  const requestedSize =
    Number.isInteger(args.pageSize) && (args.pageSize ?? 0) > 0 ? args.pageSize! : defaultPageSize;
  return {
    page,
    pageSize: Math.min(requestedSize, maxPageSize),
    offset: (page - 1) * Math.min(requestedSize, maxPageSize),
  };
}
