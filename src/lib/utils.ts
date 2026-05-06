import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatBytes = (bytes: number) => {
  if (bytes === 0 || isNaN(bytes)) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const isNegative = bytes < 0;
  const absBytes = Math.abs(bytes);
  let i = Math.floor(Math.log(absBytes) / Math.log(k));
  
  // Safe-guard i for very small values (less than k)
  if (i < 0) i = 0;
  // Safe-guard for extremely large values
  if (i >= sizes.length) i = sizes.length - 1;
  
  const value = (absBytes / Math.pow(k, i));
  return (isNegative ? '-' : '') + parseFloat(value.toFixed(2)) + ' ' + sizes[i];
};
