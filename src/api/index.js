const requireDir = require('require-dir');

const resolvers = requireDir('./resolvers');

module.exports = (db) => {
	return Object.entries(resolvers).reduce((wrapped, [ name, resolver ]) => ({
		...wrapped,
		[name]: async () => {
			let data = null;
			let error = null;

			const requestContext = {
				db,
				now: new Date().toISOString()
			};

			try {
				data = await resolver.apply(null, [requestContext, ...arguments]);
			} catch (e) {
				error = {
					message: e.message,
					stack: e.stack.split('\n').slice(1)
				};
			}

			console.log(JSON.stringify({
				resolverName: name,
				requestContext,
				args: [...arguments],
				error,
				data
			}, null, 2));

			return { data, error };
		}
	}), {});
};