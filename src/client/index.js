const requireDir = require('require-dir');
const { render } = require('mustache');

const resolvers = requireDir('./resolvers');

module.exports = (db) => {
	return Object.entries(resolvers).reduce((wrapped, [ name, method ]) => ({
		...wrapped,
		[name]: async () => {
			const { layout, data, sections } = await method.apply(null, [db, ...arguments]);

			return render(layout, data, sections);
		}
	}), {});
};