const request = require('supertest');
const app = require('../app');

describe('Mbo API', () => {
    test('GET /api/menu should return 200', async () => {
        const response = await request(app)
            .get('/api/menu');

        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });
});