const express = require('express');
const next = require('next');
const { createProxyMiddleware } = require('http-proxy-middleware');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const PORT = 3000;
const DB_SERVER_PORT = 3456;

app.prepare().then(() => {
  const server = express();

  // Proxy configuration for forwarding requests to the database server
  server.use(
    '/api',
    createProxyMiddleware({
      target: `http://localhost:${DB_SERVER_PORT}`,
      changeOrigin: true,
      pathRewrite: {'^/api' : ''}
    })
  );

  // Handling all other requests with Next.js
  server.all('*', (req, res) => {
    console.log('Handling request:', req.method, req.path);
    return handle(req, res);
  });

  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${PORT}`);
  });
});
