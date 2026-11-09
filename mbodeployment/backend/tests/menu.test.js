const request = require('supertest');
const app = require('../app');

describe('Menu API', () => {

    test('customer can retrieve the menu', async () => {
        const response = await request(app)
            .get('/api/menu');

        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
    });

    test('menu items contain required fields', async () => {
        const response = await request(app)
            .get('/api/menu');

        expect(response.statusCode).toBe(200);
        expect(response.body.length).toBeGreaterThan(0);

        const item = response.body[0];

        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('price');
    });

    test('menu endpoint does not require authentication', async () => {
        const response = await request(app)
            .get('/api/menu');

        expect(response.statusCode).not.toBe(401);
        expect(response.statusCode).not.toBe(403);
    });

});

    test('menu item IDs are positive integers', async () => {
        const response = await request(app)
            .get('/api/menu');

        expect(response.statusCode).toBe(200);

        response.body.forEach(item => {
            expect(Number.isInteger(item.id)).toBe(true);
            expect(item.id).toBeGreaterThan(0);
        });
    });

    test('menu item names are non-empty strings', async () => {
        const response = await request(app)
            .get('/api/menu');

        expect(response.statusCode).toBe(200);

        response.body.forEach(item => {
            expect(typeof item.name).toBe('string');
            expect(item.name.trim().length).toBeGreaterThan(0);
        });
    });

    test('menu item prices are positive numbers', async () => {
        const response = await request(app)
            .get('/api/menu');

        expect(response.statusCode).toBe(200);

        response.body.forEach(item => {
            expect(typeof item.price).toBe('number');
            expect(item.price).toBeGreaterThan(0);
        });
    });

    test('menu items have valid availability values', async () => {
        const response = await request(app)
            .get('/api/menu');

        expect(response.statusCode).toBe(200);

        response.body.forEach(item => {
            expect(typeof item.available).toBe('boolean');
        });
    });

    test('menu item IDs are unique', async () => {
        const response = await request(app)
            .get('/api/menu');

        expect(response.statusCode).toBe(200);

        const ids = response.body.map(item => item.id);
        const uniqueIds = new Set(ids);

        expect(uniqueIds.size).toBe(ids.length);
    });