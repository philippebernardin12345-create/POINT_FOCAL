module.exports = function timingMiddleware(req, res, next) {
  const start = Date.now();
  const rndrId = (req.headers['rndr-id'] || '').slice(0, 36) || null;

  res.on('finish', () => {
    const duration = Date.now() - start;

    console.log(
      `[timing] method=${req.method} url=${req.originalUrl} status=${res.statusCode} duration=${duration}ms rndr=${rndrId}`
    );
  });

  next();
};
