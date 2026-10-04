import "express";

declare global {
  namespace Express {
    interface User {
      claims: { sub: string };
    }
  }
}