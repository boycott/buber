export type Result<T, E = string> =
  | { _tag: 'Success'; value: T; match: <U, V>(handlers: { Success: (v: T) => U; Failure: (e: E) => V }) => U | V }
  | { _tag: 'Failure'; error: E; match: <U, V>(handlers: { Success: (v: T) => U; Failure: (e: E) => V }) => U | V };

export const Success = <T, E = string>(value: T): Result<T, E> => ({
  _tag: 'Success',
  value,
  match: (handlers) => handlers.Success(value)
});

export const Failure = <T, E = string>(error: E): Result<T, E> => ({
  _tag: 'Failure',
  error,
  match: (handlers) => handlers.Failure(error)
});
