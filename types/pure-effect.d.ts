declare module 'pure-effect' {
  export type Result<T, E = string> =
    | { _tag: 'Success'; value: T; match: <U, V>(handlers: { Success: (v: T) => U; Failure: (e: E) => V }) => U | V }
    | { _tag: 'Failure'; error: E; match: <U, V>(handlers: { Success: (v: T) => U; Failure: (e: E) => V }) => U | V };

  export function Success<T>(value: T): Result<T, any>;
  export function Failure<E>(error: E): Result<any, E>;
}
