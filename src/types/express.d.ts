import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    user?: any; // You can be more specific with the user type if you have one defined
  }
}
