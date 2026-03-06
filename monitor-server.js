#!/usr/bin/env node
/**
 * Simple HTTP server for marketplace monitor
 * Serves monitor.html on port 3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.MONITOR_PORT || 3000;
const HTML_FILE = path.join(__dirname, 'monitor.html');

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  if (req.url === '/' || req.url === '/index.html') {
    fs.readFile(HTML_FILE, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading monitor.html');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`🖥️  Marketplace Monitor running at http://localhost:${PORT}`);
  console.log('   Press Ctrl+C to stop');
});
