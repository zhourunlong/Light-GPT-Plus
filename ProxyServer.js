const express = require('express');
const os = require('os');
const next = require('next');
const { createProxyMiddleware } = require('http-proxy-middleware');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const PORT = 3000;
const DB_SERVER_PORT = 3456;
// const OPENAI_SERVER = 'http://192.168.1.2:1234';
const OPENAI_SERVER = 'https://api.openai.com';


app.prepare().then(() => {
    const server = express();

    server.use(
        '/api/db',
        createProxyMiddleware({
            target: `http://localhost:${DB_SERVER_PORT}`,
            changeOrigin: true,
            pathRewrite: {'^/api/db' : ''}
        })
    );

    server.use(
        '/api/openai',
        createProxyMiddleware({
            target: OPENAI_SERVER,
            changeOrigin: true,
            pathRewrite: {'^/api/openai' : '/v1'},
        })
    );

    server.all('*', (req, res) => {
        // console.log('Handling request:', req.method, req.path);
        return handle(req, res);
    });

    server.listen(PORT, (err) => {
        if (err) throw err;
        console.log(`> Ready on http://localhost:${PORT}`);
    });
});
