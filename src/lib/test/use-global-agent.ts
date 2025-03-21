import { defineFactory } from 'test-fixture-factory';
import type { Interceptable as GlobalAgent } from 'undici';
import { MockAgent, setGlobalDispatcher } from 'undici';

import { once } from '$lib/utils/once.js';

const getGlobalMockAgent = once(() => {
	const agent = new MockAgent();
	agent.disableNetConnect();
	setGlobalDispatcher(agent);
	return agent;
});

/*
 * really useful for testing api calls
 *
 * const test = anyTest.extend({
 *   agent: useGlobalAgent('https://example.com'),
 * })
 *
 * test('should fetch data', async ({ agent }) => {
 *   mock.intercept({ method: 'GET', path: '/api' }).reply(200, 'hello world')
 *
 *   const response = await fetch('https://example.com/api')
 *   const data = await response.text()
 *   console.log(data) // 'hello world'
 * })
 */

type Dependencies = Record<string, unknown>;
type Attributes = string;

const globalAgentFactory = defineFactory<Dependencies, Attributes, GlobalAgent>(
	async (
		/* eslint-disable-next-line no-empty-pattern */
		{},
		origin
	) => {
		const globalMockAgent = getGlobalMockAgent();
		const agent = globalMockAgent.get(origin);
		return {
			value: agent,
			destroy: async () => {
				await agent.destroy();
			}
		};
	}
);

const useGlobalAgent = globalAgentFactory.useValueFn;

export type { GlobalAgent };
export { globalAgentFactory, useGlobalAgent };
