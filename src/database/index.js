module.exports = async () => {
	// TODO: Add real database connection
	const connection = await Promise.resolve({});

	return {
		listProfiles: require('./queries/list-profiles')(connection)
	};
};