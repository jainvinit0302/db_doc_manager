import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate user initials from a name
 * - If name has multiple words: first character of first word + first character of last word
 * - If name has one word: first and last character of that word
 * - Returns uppercase initials
 */
export function getUserInitials(name: string | undefined | null): string {
  if (!name || !name.trim()) {
    return "U"; // Default for unknown user
  }

  const trimmedName = name.trim();
  const words = trimmedName.split(/\s+/).filter(word => word.length > 0);

  if (words.length === 0) {
    return "U";
  }

  if (words.length === 1) {
    // Single word: use first and last character
    const word = words[0];
    if (word.length === 1) {
      return word.toUpperCase();
    }
    return (word[0] + word[word.length - 1]).toUpperCase();
  }

  // Multiple words: first character of first word + first character of last word
  const firstWord = words[0];
  const lastWord = words[words.length - 1];
  return (firstWord[0] + lastWord[0]).toUpperCase();
}
