import express from 'express';

/**
 * Adds middlewares to the give express application.
 * @param {express.Express} The api.
 */
const injectMiddlewares = (api) => {
  api.use(express.json({ limit: '200mb' }));
};

export default injectMiddlewares;
