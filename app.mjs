import express from 'express';
import hostedApp from './dist/server/hosted-app.js';

// The Express framework detector requires a direct import in the entrypoint.
// Runtime initialization and every route still belong to the checked NodeNext build.
const app = express();
app.disable('x-powered-by');
app.use(hostedApp);
export default app;
