export type ApiError = {
  status: number;
  body: {
    message?: string;
    error?: string;
  };
};