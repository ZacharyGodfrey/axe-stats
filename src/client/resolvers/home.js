const fs = require('fs-extra');

module.exports = async (db, user) => {
    const [layout, page, profiles] = await Promise.all([
        fs.readFile(require.resolve('../assets/_shell.html'), 'utf-8'),
        fs.readFile(require.resolve('../assets/pages/home.html'), 'utf-8'),
        db.listProfiles()
    ]);

    return {
        layout,
        sections: { page },
        data: {
            user,
            page: {
                title: 'Axe Stats - Home',
            },
            profiles
        }
    };
};