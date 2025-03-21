<script>
	// Props
	export let graphqlResponse = '';
	export let isLoading = false;
	export let error = null;
	export let executeQuery;

	// Local state
	let copySuccess = false;
	let responseHeight = '400px';

	// Format JSON response for better readability
	function formatResponse(responseText) {
		if (!responseText) return '';

		try {
			const parsed = JSON.parse(responseText);
			return JSON.stringify(parsed, null, 2);
		} catch (e) {
			return responseText;
		}
	}

	// Copy response to clipboard
	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(graphqlResponse);
			copySuccess = true;

			// Reset copy success message after 2 seconds
			setTimeout(() => {
				copySuccess = false;
			}, 2000);
		} catch (err) {
			console.error('Failed to copy: ', err);
		}
	}

	// Clear response
	function clearResponse() {
		graphqlResponse = '';
		error = null;
	}
</script>

<div class="executor-container">
	<div class="executor-header">
		<h2>Response</h2>
		<div class="actions">
			<button type="button" class="execute-button" on:click={executeQuery} disabled={isLoading}>
				{isLoading ? 'Executing...' : 'Execute Query'}
			</button>

			{#if graphqlResponse}
				<button type="button" class="action-button" on:click={copyToClipboard}>
					{copySuccess ? 'Copied!' : 'Copy'}
				</button>

				<button type="button" class="action-button clear" on:click={clearResponse}> Clear </button>
			{/if}
		</div>
	</div>

	<div class="response-container" style="height: {responseHeight};">
		{#if isLoading}
			<div class="loading">
				<div class="spinner"></div>
				<p>Executing query...</p>
			</div>
		{:else if error}
			<div class="error-container">
				<h3>Error</h3>
				<pre class="error-message">{error}</pre>
			</div>
		{:else if graphqlResponse}
			<pre class="response">{formatResponse(graphqlResponse)}</pre>
		{:else}
			<div class="empty-state">
				<p>Execute a query to see results here</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.executor-container {
		background-color: #f9f9f9;
		padding: 15px;
		border-radius: 5px;
		border: 1px solid #ddd;
		display: flex;
		flex-direction: column;
	}

	.executor-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 15px;
	}

	h2 {
		margin: 0;
		font-size: 1.2rem;
		color: #333;
	}

	.actions {
		display: flex;
		gap: 10px;
	}

	.execute-button {
		background-color: #10b981;
		color: white;
		border: none;
		padding: 8px 15px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.execute-button:hover:not(:disabled) {
		background-color: #059669;
	}

	.execute-button:disabled {
		background-color: #94d3a2;
		cursor: not-allowed;
	}

	.action-button {
		background-color: #f0f0f0;
		border: 1px solid #ddd;
		padding: 6px 12px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.8rem;
	}

	.action-button:hover {
		background-color: #e0e0e0;
	}

	.action-button.clear {
		color: #e53e3e;
	}

	.response-container {
		flex: 1;
		border: 1px solid #ddd;
		border-radius: 4px;
		background-color: #fff;
		overflow: auto;
		position: relative;
	}

	.response {
		margin: 0;
		padding: 10px;
		font-family: 'Courier New', monospace;
		font-size: 0.9rem;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.empty-state {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 100%;
		color: #888;
		font-style: italic;
	}

	.loading {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		height: 100%;
	}

	.spinner {
		border: 4px solid rgba(0, 0, 0, 0.1);
		border-radius: 50%;
		border-top: 4px solid #0070f3;
		width: 30px;
		height: 30px;
		animation: spin 1s linear infinite;
		margin-bottom: 10px;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.error-container {
		padding: 10px;
		color: #e53e3e;
	}

	.error-container h3 {
		margin-top: 0;
		margin-bottom: 10px;
	}

	.error-message {
		margin: 0;
		font-family: 'Courier New', monospace;
		font-size: 0.9rem;
		white-space: pre-wrap;
		word-break: break-word;
	}
</style>
