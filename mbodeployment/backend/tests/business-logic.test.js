const request = require('supertest');
const app = require('../app');

const {
    createLocationFixtures,
    cleanupOrder,
} = require('./helpers/order-fixtures');

jest.setTimeout(30000);

const adminUserToken = process.env.TEST_ADMIN_USER_TOKEN;

describe('Authenticated Order Business Logic', () => {
    let fixtureIds;

    beforeAll(async () => {
        if (!adminUserToken) {
            throw new Error(
                'TEST_ADMIN_USER_TOKEN is required to run business logic tests.'
            );
        }

        fixtureIds = await createLocationFixtures();
    }, 90000);

    afterAll(async () => {
        if (!fixtureIds) {
            return;
        }

        await cleanupOrder(fixtureIds.pendingOrderId);

        await cleanupOrder(fixtureIds.confirmedOrderId);

        await cleanupOrder(fixtureIds.completedOrderId);
    });

    test('admin can retrieve all orders', async () => {
        const response = await request(app)
            .get('/api/orders')
            .set(
                'Authorization',
                `Bearer ${adminUserToken}`
            );

        expect(response.statusCode).toBe(200);

        expect(response.body).toHaveProperty('orders');

        expect(
            Array.isArray(response.body.orders)
        ).toBe(true);
    });

    test('admin can retrieve an existing order', async () => {
        const response = await request(app)
            .get(`/api/orders/${fixtureIds.pendingOrderId}`)
            .set(
                'Authorization',
                `Bearer ${adminUserToken}`
            );

        expect(response.statusCode).toBe(200);

        expect(response.body).toHaveProperty(
            'order_id',
            fixtureIds.pendingOrderId
        );
    });

    test('nonexistent order returns 404', async () => {
        const response = await request(app)
            .get('/api/orders/999999')
            .set(
                'Authorization',
                `Bearer ${adminUserToken}`
            );

        expect(response.statusCode).toBe(404);
    });

    test('invalid order ID returns 400', async () => {
        const response = await request(app)
            .get('/api/orders/abc')
            .set(
                'Authorization',
                `Bearer ${adminUserToken}`
            );

        expect(response.statusCode).toBe(400);
    });

    test('illegal backward status transition is rejected', async () => {
        const response = await request(app)
            .patch(
                `/api/orders/${fixtureIds.confirmedOrderId}/status`
            )
            .set(
                'Authorization',
                `Bearer ${adminUserToken}`
            )
            .send({
                status: 'pending',
            });

        expect(response.statusCode).toBe(400);
    });

    test('completed order cannot be changed', async () => {
        const response = await request(app)
            .patch(
                `/api/orders/${fixtureIds.completedOrderId}/status`
            )
            .set(
                'Authorization',
                `Bearer ${adminUserToken}`
            )
            .send({
                status: 'confirmed',
            });

        expect(response.statusCode).toBe(400);
    });
});