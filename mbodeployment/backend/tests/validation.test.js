const request = require('supertest');
const app = require('../app');

const { withExpectedPrices } = require('./helpers/priced-items');

describe('POST /api/orders - Validation', () => {
    test('rejects order without customer information', async () => {
        const response = await request(app)
            .post('/api/orders')
            .send({
                order_type: 'collection',
                payment_method: 'cash',
                items: [
                    {
                        menu_item_id: 1,
                        quantity: 1,
                    },
                ],
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.error).toBe(
            'Customer information is required'
        );
    });

    test('rejects invalid payment method', async () => {
        const response = await request(app)
            .post('/api/orders')
            .send({
                customer: {
                    name: 'Automated Test',
                    phone: '0781111111',
                },
                order_type: 'collection',
                payment_method: 'bitcoin',
                items: [
                    {
                        menu_item_id: 1,
                        quantity: 1,
                    },
                ],
            });

        expect(response.statusCode).toBe(400);
    });

    test('rejects delivery order without coordinates', async () => {
        const response = await request(app)
            .post('/api/orders')
            .send({
                customer: {
                    name: 'Automated Delivery Test',
                    phone: '0781111112',
                },
                order_type: 'delivery',
                payment_method: 'cash',
                items: await withExpectedPrices([
                    {
                        menu_item_id: 1,
                        quantity: 1,
                    },
                ]),
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.error).toBe(
            'Delivery orders require latitude and longitude'
        );
    });

    test('rejects collection order containing coordinates', async () => {
        const response = await request(app)
            .post('/api/orders')
            .send({
                customer: {
                    name: 'Automated Collection Test',
                    phone: '0781111113',
                },
                order_type: 'collection',
                payment_method: 'cash',
                latitude: -26.2041,
                longitude: 28.0473,
                items: await withExpectedPrices([
                    {
                        menu_item_id: 1,
                        quantity: 1,
                    },
                ]),
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.error).toBe(
            'Collection orders must not include location'
        );
    });

    test('rejects quantity above 100', async () => {
        const response = await request(app)
            .post('/api/orders')
            .send({
                customer: {
                    name: 'Automated Quantity Test',
                    phone: '0781111114',
                },
                order_type: 'collection',
                payment_method: 'cash',
                items: [
                    {
                        menu_item_id: 1,
                        quantity: 101,
                    },
                ],
            });

        expect(response.statusCode).toBe(400);
    });
});