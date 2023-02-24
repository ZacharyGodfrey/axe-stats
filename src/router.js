module.exports = (client, db) => {
  // Recursive function to gracefully handle 404 and 500 errors
  const router = async (pageName, req, res, next, status = 200) => {
    try {
      const is404 = pageName === '404';
      const is500 = pageName === '500';
      const renderFn = client[pageName];

      if (!renderFn) {
        return is404 ? next() : router('404', req, res, next, 404);
      }

      const html = await renderFn(db, req);

      return res.status(status).type('html').send(html);
    } catch (error) {
      return is500 ? next() : router('500', req, res, next, 500);
    }
  };

  return router;
};