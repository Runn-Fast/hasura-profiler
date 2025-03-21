/**
 * Storage interface (subset of Web Storage API)
 */
interface Storage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export type { Storage };
