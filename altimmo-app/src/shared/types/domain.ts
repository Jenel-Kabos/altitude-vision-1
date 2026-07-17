export type Id = string;

export interface User {
  _id: Id;
  name?: string;
  email?: string;
  role: 'client' | 'proprietaire' | 'collaborateur' | 'admin' | string;
}

export interface Property {
  _id: Id;
  title: string;
  status?: string;
  images?: string[];
}

export interface Visit {
  _id: Id;
  property: Id | Property;
  status: string;
  displayStatus?: string;
  allowedActions?: string[];
}

export interface AppNotification {
  _id: Id;
  type: string;
  read: boolean;
  data?: Record<string, unknown>;
}

export interface Conversation {
  _id: Id;
  participants: User[];
}

export interface Message {
  _id: Id;
  conversation: Id;
  sender: Id | User;
  body: string;
  createdAt: string;
  localStatus?: 'sending' | 'sent' | 'failed';
}

export interface RentalManagement {
  _id: Id;
  property: Id | Property;
  status: string;
  allowedActions?: string[];
}

export interface Payment {
  _id: Id;
  status: string;
  amount?: number;
  currency?: string;
}

export interface Contract {
  _id: Id;
  status: string;
  allowedActions?: string[];
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages?: number;
}

export interface ApiResponse<T> {
  data: T;
  pagination?: Pagination;
  message?: string;
}

export interface NormalizedApiError {
  code: string;
  status: number | null;
  message: string;
  isNetworkError: boolean;
  isTimeout: boolean;
  retryable: boolean;
}
