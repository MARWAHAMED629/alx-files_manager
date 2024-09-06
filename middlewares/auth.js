/* eslint-disable no-unused-vars */
import { Request, Response, NextFunction } from 'express';
import { getUserFromXToken, getUserFromAuthorization } from '../utils/auth';

/**
 * Middleware for Basic Authentication.
 * This function checks for a valid user using Basic Authorization headers.
 * If the user is authenticated, the user data is attached to the request object.
 * Otherwise, it returns a 401 Unauthorized response.
 *
 * @param {Request} req - The incoming Express request object containing headers and data.
 * @param {Response} res - The Express response object used to send a response.
 * @param {NextFunction} next - The next function in the Express middleware chain.
 */
export const basicAuthenticate = async (req, res, next) => {
  const user = await getUserFromAuthorization(req);

  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  req.user = user;
  next();
};

/**
 * Middleware for X-Token Authentication.
 * This function checks for a valid user using an X-Token header.
 * If the user is authenticated, the user data is attached to the request object.
 * Otherwise, it returns a 401 Unauthorized response.
 *
 * @param {Request} req - The incoming Express request object containing headers and data.
 * @param {Response} res - The Express response object used to send a response.
 * @param {NextFunction} next - The next function in the Express middleware chain.
 */
export const xTokenAuthenticate = async (req, res, next) => {
  const user = await getUserFromXToken(req);

  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  req.user = user;
  next();
};
