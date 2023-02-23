module.exports = (client, db) => {
  // Recursive function to gracefully handle 404 and 500 errors
  const router = async (pageName, req, res, next, status = 200) => {
    try {
      const is404 = pageName === 'not-found';
      const is500 = pageName === 'server-error';
      const renderFn = client[pageName];

      if (!renderFn) {
        return is404 ? next() : router('not-found', req, res, next, 404);
      }

      const html = await renderFn(db, req);

      return res.status(status).type('html').send(html);
    } catch (error) {
      return is500 ? next() : router('server-error', req, res, next, 500);
    }
  };

  return router;
};