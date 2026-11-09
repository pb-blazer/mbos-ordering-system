const request = require('supertest');
const app = require('../app');

const {
    createLocationFixtures,
} = require('./helpers/order-fixtures');

const adminUserToken = process.env.TEST_ADMIN_USER_TOKEN;

jest.setTimeout(30000);

let fixtures;

describe('Delivery Location Security', () => {
    beforeAll(async () => {
        if (!adminUserToken) {
            throw new Error(
                'TEST_ADMIN_USER_TOKEN is required to run location security tests.'
            );
        }

        fixtures = await createLocationFixtures();
    }, 90000);

    test('completed delivery order hides location', async () => {
        const response = await request(app)
            .get(`/api/orders/${fixtures.completedOrderId}`)
            .set(
                'Authorization',
                `Bearer ${adminUserToken}`
            );

        expect(response.statusCode).toBe(200);
        expect(response.body.order_type).toBe('delivery');
        expect(response.body.status).toBe('completed');
        expect(response.body.location).toBeNull();
    });

    test('pending delivery order hides location', async () => {
        const response = await request(app)
            .get(`/api/orders/${fixtures.pendingOrderId}`)
            .set(
                'Authorization',
                `Bearer ${adminUserToken}`
            );

        expect(response.statusCode).toBe(200);
        expect(response.body.order_type).toBe('delivery');
        expect(response.body.status).toBe('pending');
        expect(response.body.location).toBeNull();
    });

    test('confirmed delivery order exposes location', async () => {
        const response = await request(app)
            .get(`/api/orders/${fixtures.confirmedOrderId}`)
            .set(
                'Authorization',
                `Bearer ${adminUserToken}`
            );

        expect(response.statusCode).toBe(200);
        expect(response.body.order_type).toBe('delivery');
        expect(response.body.status).toBe('confirmed');

        expect(response.body.location).not.toBeNull();

        expect(response.body.location).toHaveProperty('latitude');
        expect(response.body.location).toHaveProperty('longitude');

        expect(response.body.location.latitude).toBe(-26.2041);
        expect(response.body.location.longitude).toBe(28.0473);
    });
});