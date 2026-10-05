import type { ErrorRequestHandler } from "express";

export const handleHttpError: ErrorRequestHandler = (error, _req, res, _next) => {
  const databaseUnavailable = /endpoint has been disabled|ECONNREFUSED|connection terminated|database.*unavailable/i.test(String(error?.message || ""));
  const requestedStatus = Number(error?.status || error?.statusCode);
  const status = databaseUnavailable ? 503 : requestedStatus >= 400 && requestedStatus <= 599 ? requestedStatus : 500;
  console.error(`Request failed: HTTP ${status}`);
  if (res.headersSent) { res.end(); return; }
  res.status(status).json({
    message: databaseUnavailable ? "The database is temporarily unavailable. Please try again shortly."
      : status >= 500 ? "Internal Server Error" : String(error?.message || "Request failed"),
  });
  // Never rethrow after responding. A session/database failure must not kill
  // the whole process and restart the service for every visitor.
};
