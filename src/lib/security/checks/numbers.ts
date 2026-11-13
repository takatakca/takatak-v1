import { randomInt } from "node:crypto";

/**
 * "Match the number": one number to tap among three. Two digits (10–99) are
 * easy to read out on a call and to find on a phone; a random guess succeeds
 * one time in three, and a wrong tap counts as an attempt (see store.ts).
 */
export function matchChoices(): { matchNumber: number; choices: number[] } {
  const picked = new Set<number>();
  while (picked.size < 3) picked.add(randomInt(10, 100));
  const choices = [...picked];
  const matchNumber = choices[randomInt(0, choices.length)];
  // Sorted so the position of the right number tells nothing.
  return { matchNumber, choices: choices.sort((a, b) => a - b) };
}
