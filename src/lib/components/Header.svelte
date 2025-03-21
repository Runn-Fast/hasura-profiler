<script>
	// You can add props or state here if needed
</script>

<header class="header">
	<div class="logo">
		<h1>Hasura GraphQL Explorer</h1>
	</div>
	<div class="nav">
		<a href="https://hasura.io/docs" target="_blank" rel="noopener noreferrer">Documentation</a>
		<a href="https://github.com/hasura/graphql-engine" target="_blank" rel="noopener noreferrer"
			>GitHub</a
		>
	</div>
</header>

<style>
	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 0;
		border-bottom: 1px solid #eaeaea;
	}

	.logo h1 {
		font-size: 1.5rem;
		margin: 0;
		color: #333;
	}

	.nav {
		display: flex;
		gap: 20px;
	}

	.nav a {
		color: #0070f3;
		text-decoration: none;
	}

	.nav a:hover {
		text-decoration: underline;
	}
</style>
