const requireDir = require('require-dir');

const resolvers = requireDir('./resolvers');

module.exports = () => {
	const db = {};

	return Object.entries(resolvers).reduce((wrapped, [name, resolver]) => ({
		...wrapped,
		[name]: () => resolver.apply(null, [db, ...arguments])
	}), {});
};