const request = require('supertest');
const app = require('../app');

describe('Order Route Validation', () => {

    test('rejects non-numeric order ID', async () => {
        const response = await request(app)
            .get('/api/orders/abc');

        expect(response.statusCode).toBe(401);
    });


    test('rejects missing order ID authentication before database lookup', async () => {
        const response = await request(app)
            .get('/api/orders/999999');

        expect(response.statusCode).toBe(401);
    });


    test('rejects status update without authentication', async () => {
        const response = await request(app)
            .patch('/api/orders/16/status')
            .send({
                status: 'completed'
            });

        expect(response.statusCode).toBe(401);
    });


    test('rejects malformed status update without authentication', async () => {
        const response = await request(app)
            .patch('/api/orders/abc/status')
            .send({
                status: 'completed'
            });

        expect(response.statusCode).toBe(401);
    });

});