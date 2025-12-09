// Not found middleware
export const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
  };
  
  // Main error handler
  export const errorHandler = (err, req, res, next) => {
    let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    let message = err.message;
    let errorDetails = null;
  
    // Handle specific error types
    if (err.name === 'ValidationError') {
      statusCode = 400;
      message = 'Validation Error';
      errorDetails = Object.values(err.errors).map(error => ({
        field: error.path,
        message: error.message
      }));
    } else if (err.name === 'CastError' && err.kind === 'ObjectId') {
      statusCode = 404;
      message = 'Resource not found';
    } else if (err.code === 11000) {
      statusCode = 409;
      message = 'Duplicate field value entered';
      const field = Object.keys(err.keyPattern)[0];
      errorDetails = [{ field, message: `${field} already exists` }];
    } else if (err.name === 'JsonWebTokenError') {
      statusCode = 401;
      message = 'Invalid token';
    } else if (err.name === 'TokenExpiredError') {
      statusCode = 401;
      message = 'Token expired';
    }
  
    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        body: req.body,
        user: req.user?._id
      });
    }
  
    // Response
    res.status(statusCode).json({
      success: false,
      message,
      error: errorDetails || (process.env.NODE_ENV === 'development' ? err.message : undefined),
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  };
  
  // Async error wrapper (to avoid try-catch in controllers)
  export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };