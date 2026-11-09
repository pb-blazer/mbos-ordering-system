const request = require('supertest');
const app = require('../app');

describe('Admin Authentication', () => {

    test('GET /api/orders rejects missing JWT', async () => {
        const response = await request(app)
            .get('/api/orders');

        expect(response.statusCode).toBe(401);
    });


    test('GET /api/orders rejects malformed JWT', async () => {
        const response = await request(app)
            .get('/api/orders')
            .set('Authorization', 'Bearer definitely-not-a-real-jwt');

        expect(response.statusCode).toBe(401);
    });


    test('GET /api/orders/:id rejects missing JWT', async () => {
        const response = await request(app)
            .get('/api/orders/16');

        expect(response.statusCode).toBe(401);
    });


    test('PATCH /api/orders/:id/status rejects missing JWT', async () => {
        const response = await request(app)
            .patch('/api/orders/16/status')
            .send({
                status: 'confirmed'
            });

        expect(response.statusCode).toBe(401);
    });


    test('GET /api/orders/:id rejects malformed JWT', async () => {
        const response = await request(app)
            .get('/api/orders/16')
            .set('Authorization', 'Bearer invalid.jwt.token');

        expect(response.statusCode).toBe(401);
    });

});