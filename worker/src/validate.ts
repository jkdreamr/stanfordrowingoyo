import { HttpError } from './http';
export function invalid(message: string): never {
  throw new HttpError(400, 'VALIDATION_ERROR', message);
}
export function string(
  value: unknown,
  label: string,
  min: number,
  max: number,
  trim = false,
): string {
  if (typeof value !== 'string') return invalid(`${label} must be a string.`);
  const result = trim ? value.trim() : value;
  if (result.length < min || result.length > max)
    return invalid(`${label} must contain between ${min} and ${max} characters.`);
  return result;
}
export function number(
  value: unknown,
  label: string,
  min: number,
  max: number,
  integer = false,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    return invalid(`${label} must be between ${min} and ${max}.`);
  return value;
}
export const int = (value: unknown, label: string, min: number, max: number) =>
  number(value, label, min, max, true);
export function enumeration<T extends string>(
  value: unknown,
  values: readonly T[],
  label: string,
): T {
  if (typeof value !== 'string' || !values.includes(value as T))
    return invalid(`${label} is invalid.`);
  return value as T;
}
export const nullable = <T>(value: unknown, validate: (value: unknown) => T): T | null =>
  value === null ? null : validate(value);
export function date(value: unknown): string {
  const result = string(value, 'Date', 10, 10);
  const parsed = new Date(result + 'T12:00:00Z');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(result) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== result
  )
    return invalid('Date must be a real YYYY-MM-DD date.');
  return result;
}
export function email(value: unknown): string {
  const result = string(value, 'Email', 3, 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) return invalid('Email is invalid.');
  return result;
}
