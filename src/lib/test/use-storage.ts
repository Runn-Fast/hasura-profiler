import { defineFactory } from 'test-fixture-factory';

import type { Storage } from '$lib/utils/storage.js';

/**
 * MockStorage implements the Storage interface for testing
 */
class MockStorage implements Storage {
	private data: Record<string, string>;

	constructor(initialData: Record<string, string> = {}) {
		this.data = { ...initialData };
	}

	getItem(key: string): string | null {
		return this.data[key] || null;
	}

	setItem(key: string, value: string): void {
		this.data[key] = value;
	}

	removeItem(key: string): void {
		delete this.data[key];
	}

	clear(): void {
		this.data = {};
	}
}

type Dependencies = Record<string, unknown>;
type Attributes = void | {
	initialData: Record<string, string>;
};

/**
 * Factory for creating mock storage instances
 */
const storageFactory = defineFactory<Dependencies, Attributes, Storage>(
	async (
		 
		{},
		attrs
	) => {
		return {
			value: new MockStorage(attrs?.initialData)
		};
	}
);

/**
 * Hook for using mock storage in tests
 */
const useStorage = storageFactory.useValueFn;

export { useStorage, MockStorage };
