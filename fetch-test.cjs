const http = require('http');

http.get('http://localhost:3000/pages/NotificationsPage.tsx', { headers: { 'Accept': 'text/javascript' } }, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response (first 100 chars):', data.substring(0, 100));
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
