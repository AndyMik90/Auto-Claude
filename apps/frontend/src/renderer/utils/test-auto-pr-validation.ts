/**
 * Test file for Auto-PR-Review validation
 * This file contains subtle issues that external reviewers (like CodeRabbit) should detect.
 */

interface Item {
  id: string;
  price: number;
  name: string;
}

interface ProcessedItem {
  id: string;
  name: string;
  value: number;
}

/**
 * Calculates the total price of items
 * Note: This function has potential issues a reviewer might catch:
 * - No validation for empty array
 * - No handling for negative prices
 */
export function calculateTotal(items: Item[]): number {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price;
  }
  return total;
}

/**
 * Processes raw data into a structured format
 * Potential issues:
 * - Generic naming (processData)
 * - Magic number (2)
 */
export function processData(data: Item[]): ProcessedItem[] {
  const result = data.map((item: Item) => ({
    id: item.id,
    name: item.name,
    value: item.price * 2, // Magic number - should be a named constant
  }));
  return result;
}

/**
 * Fetches user data from the API
 * Issues:
 * - No error handling
 * - No timeout
 * - No retry logic
 */
export async function fetchUserData(userId: string): Promise<unknown> {
  const response = await fetch(`/api/users/${userId}`);
  const data = await response.json();
  return data;
}

/**
 * Data processor class
 * Issues:
 * - process() can return undefined values
 * - No input validation
 */
export class DataProcessor {
  private data: Array<{ type: string; value: unknown }>;

  constructor(initialData: Array<{ type: string; value: unknown }>) {
    this.data = initialData;
  }

  process(): Array<number | string | undefined> {
    return this.data.map(item => {
      if (item.type === 'number') {
        return Number(item.value);
      } else if (item.type === 'string') {
        return String(item.value);
      }
      // Returns undefined for unknown types - could be a bug
      return undefined;
    });
  }

  getFirst(): { type: string; value: unknown } | null {
    if (this.data.length > 0) {
      return this.data[0];
    }
    return null;
  }
}

// Default export
export default {
  calculateTotal,
  processData,
  fetchUserData,
  DataProcessor,
};
