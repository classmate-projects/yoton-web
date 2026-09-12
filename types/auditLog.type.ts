export interface AuditLogType {
  auditLogId: string;
  userId: string | null;
  username: string;
  role: string | null;
  httpMethod: string;
  path: string;
  module: string | null;
  action: string;
  changes: string | null;
  statusCode: number;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditLogFilters {
  userId?: string;
  module?: string;
  method?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}
