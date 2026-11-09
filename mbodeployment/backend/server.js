require('dotenv').config();

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('==========================================');
    console.log("  MBO'S TSHISANYAMA BACKEND");
    console.log('==========================================');
    console.log(`Local:   http://localhost:${PORT}`);
    console.log(`Network: http://192.168.58.242:${PORT}`);
    console.log('');
    console.log('API:');
    console.log(`Menu:    http://192.168.58.242:${PORT}/api/menu`);
    console.log(`Health:  http://192.168.58.242:${PORT}/api/health`);
    console.log('==========================================');
    console.log('');
});