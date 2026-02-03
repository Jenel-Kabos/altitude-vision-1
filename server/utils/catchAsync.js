/**
 * @fileoverview Utility function to wrap async route handlers.
 * This function catches any errors (rejections) from Promises 
 * within the async function and forwards them to the Express error middleware.
 * This avoids the need for repetitive try/catch blocks in every controller.
 * * @param {Function} fn - The asynchronous function (controller) to be executed.
 * @returns {Function} - The wrapped function suitable for Express route handling.
 */
const catchAsync = (fn) => {
  // Returns a new function (middleware) that Express can call.
  return (req, res, next) => {
    // Execute the async function (fn) and catch any errors.
    // .catch(next) forwards the error to the next error handling middleware.
    fn(req, res, next).catch(next);
  };
};

module.exports = catchAsync;