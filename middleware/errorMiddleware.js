const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  if (err?.name === "MulterError") {
    statusCode = 400;
  }

  if (typeof err === "string") {
    statusCode = 400;
  }

  const message =
    typeof err === "string"
      ? err
      : err?.message || "Unexpected server error";

  res.status(statusCode);
  res.json({
    message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

module.exports = { errorHandler, notFound };
