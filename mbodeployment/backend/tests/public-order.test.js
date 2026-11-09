
const request = require('supertest');
const { randomUUID } = require('crypto');

const app = require('../app');

const { withExpectedPrices } = require('./helpers/priced-items');

jest.setTimeout(30000);

// ==========================================================
// HELPERS
// ==========================================================

// Every independent order submission receives its own UUID.
// Replays must explicitly reuse the original UUID.
function postOrder(payload, idempotencyKey = randomUUID()) {
    return request(app)
        .post('/api/orders')
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);
}

// Fetch enough currently available items for successful tests.
// Use the actual menu prices returned by the API.
async function getAvailableMenuItems(requiredCount = 2) {
    const menuResponse = await request(app)
        .get('/api/menu')
        .timeout({
            response: 15000,
            deadline: 20000,
        });

    if (
        menuResponse.statusCode !== 200 ||
        !Array.isArray(menuResponse.body)
    ) {
        throw new Error(
            'Could not load menu for order test: ' +
            JSON.stringify({
                status: menuResponse.statusCode,
                body: menuResponse.body,
            })
        );
    }

    const availableItems = menuResponse.body.filter((item) => {
        const id = Number(item.id);
        const price = Number(item.price);

        return (
            Number.isSafeInteger(id) &&
            id > 0 &&
            item.available === true &&
            Number.isFinite(price) &&
            price >= 0 &&
            price <= 100000
        );
    });

    if (availableItems.length < requiredCount) {
        throw new Error(
            `The test requires ${requiredCount} available menu items, ` +
            `but only ${availableItems.length} are available.`
        );
    }

    return availableItems.slice(0, requiredCount);
}

// ==========================================================
// PUBLIC ORDER CREATION
// ==========================================================

describe('Public Order Creation', () => {
    test('customer can create a collection order with cash', async () => {
        const response = await postOrder({
            customer: {
                name: 'Test Customer',
                phone: '0780000001',
            },
            order_type: 'collection',
            payment_method: 'cash',
            items: await withExpectedPrices([
                {
                    menu_item_id: 1,
                    quantity: 2,
                },
            ]),
        });

        expect(response.statusCode).toBe(201);

        expect(response.body).toHaveProperty(
            'message',
            'Order created successfully'
        );

        expect(response.body).toHaveProperty('order');
        expect(response.body.order).toHaveProperty('order_id');
    });

    test(
        'customer can create a delivery order with cash and location',
        async () => {
            const response = await postOrder({
                customer: {
                    name: 'Test Delivery Customer',
                    phone: '0780000002',
                },
                order_type: 'delivery',
                payment_method: 'cash',
                items: await withExpectedPrices([
                    {
                        menu_item_id: 1,
                        quantity: 1,
                    },
                ]),
                latitude: -26.2041,
                longitude: 28.0473,
            });

            expect(response.statusCode).toBe(201);

            expect(response.body).toHaveProperty(
                'message',
                'Order created successfully'
            );

            expect(response.body).toHaveProperty('order');
            expect(response.body.order).toHaveProperty('order_id');
        }
    );

    test('customer can create an order with EFT payment', async () => {
        const response = await postOrder({
            customer: {
                name: 'EFT Customer',
                phone: '0780000003',
            },
            order_type: 'collection',
            payment_method: 'eft',
            items: await withExpectedPrices([
                {
                    menu_item_id: 1,
                    quantity: 1,
                },
            ]),
        });

        expect(response.statusCode).toBe(201);
    });

    test('customer can create an order with card payment', async () => {
        const response = await postOrder({
            customer: {
                name: 'Card Customer',
                phone: '0780000004',
            },
            order_type: 'collection',
            payment_method: 'card',
            items: await withExpectedPrices([
                {
                    menu_item_id: 1,
                    quantity: 1,
                },
            ]),
        });

        expect(response.statusCode).toBe(201);
    });

    test('customer can create an order with multiple items', async () => {
        const availableItems = await getAvailableMenuItems(2);

        const items = [
            {
                menu_item_id: Number(availableItems[0].id),
                quantity: 2,
                expected_price: Number(
                    Number(availableItems[0].price).toFixed(2)
                ),
            },
            {
                menu_item_id: Number(availableItems[1].id),
                quantity: 1,
                expected_price: Number(
                    Number(availableItems[1].price).toFixed(2)
                ),
            },
        ];

        const response = await postOrder({
            customer: {
                name: 'Multiple Items Customer',
                phone: '0780000005',
            },
            order_type: 'collection',
            payment_method: 'cash',
            items,
        });

        if (response.statusCode !== 201) {
            console.error(
                '\nMULTIPLE-ITEM ORDER FAILURE DETAILS:\n',
                JSON.stringify(
                    {
                        status: response.statusCode,
                        body: response.body,
                        submittedItems: items,
                    },
                    null,
                    2
                )
            );
        }

        expect(response.statusCode).toBe(201);

        expect(response.body).toHaveProperty(
            'message',
            'Order created successfully'
        );

        expect(response.body.order).toHaveProperty('order_id');
    });

    test('customer can create an order with notes', async () => {
        const response = await postOrder({
            customer: {
                name: 'Notes Customer',
                phone: '0780000006',
            },
            order_type: 'collection',
            payment_method: 'cash',
            notes: 'Please prepare the order carefully.',
            items: await withExpectedPrices([
                {
                    menu_item_id: 1,
                    quantity: 1,
                },
            ]),
        });

        expect(response.statusCode).toBe(201);
    });
});

// ==========================================================
// IDEMPOTENCY / DUPLICATE SUBMISSION PROTECTION
// ==========================================================

describe('Order Idempotency', () => {
    test('repeating the same request returns the original order', async () => {
        const idempotencyKey = randomUUID();

        const payload = {
            customer: {
                name: 'Idempotency Replay Customer',
                phone: '0780000088',
            },
            order_type: 'collection',
            payment_method: 'cash',
            notes: 'Automated idempotency replay test',
            items: await withExpectedPrices([
                {
                    menu_item_id: 1,
                    quantity: 1,
                },
            ]),
        };

        const firstResponse = await postOrder(
            payload,
            idempotencyKey
        );

        expect(firstResponse.statusCode).toBe(201);

        expect(
            firstResponse.body.order.order_id
        ).toBeTruthy();

        const secondResponse = await postOrder(
            payload,
            idempotencyKey
        );

        expect(secondResponse.statusCode).toBe(200);

        expect(
            secondResponse.body.order.order_id
        ).toBe(firstResponse.body.order.order_id);
    });

    test('same key with different order details is rejected', async () => {
        const idempotencyKey = randomUUID();

        const originalPayload = {
            customer: {
                name: 'Idempotency Conflict Customer',
                phone: '0780000089',
            },
            order_type: 'collection',
            payment_method: 'cash',
            notes: 'Original order details',
            items: await withExpectedPrices([
                {
                    menu_item_id: 1,
                    quantity: 1,
                },
            ]),
        };

        const firstResponse = await postOrder(
            originalPayload,
            idempotencyKey
        );

        expect(firstResponse.statusCode).toBe(201);

        const changedPayload = {
            ...originalPayload,
            notes: 'Different order details',
        };

        const secondResponse = await postOrder(
            changedPayload,
            idempotencyKey
        );

        expect(secondResponse.statusCode).toBe(409);

        expect(secondResponse.body.code).toBe(
            'IDEMPOTENCY_KEY_REUSED'
        );
    });

    test('a request without an idempotency key is rejected', async () => {
        const response = await request(app)
            .post('/api/orders')
            .send({});

        expect(response.statusCode).toBe(400);

        expect(response.body.code).toBe(
            'IDEMPOTENCY_KEY_REQUIRED'
        );
    });
});

// ==========================================================
// PUBLIC ORDER VALIDATION
// ==========================================================

describe('Public Order Validation', () => {
    test('rejects missing customer information', async () => {
        const response = await postOrder({
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
    });

    test('rejects missing customer name', async () => {
        const response = await postOrder({
            customer: {
                phone: '0780000010',
            },
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
    });

    test('rejects missing customer phone', async () => {
        const response = await postOrder({
            customer: {
                name: 'Test Customer',
            },
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
    });

    test('rejects invalid order type', async () => {
        const response = await postOrder({
            customer: {
                name: 'Test Customer',
                phone: '0780000011',
            },
            order_type: 'pickup',
            payment_method: 'cash',
            items: [
                {
                    menu_item_id: 1,
                    quantity: 1,
                },
            ],
        });

        expect(response.statusCode).toBe(400);
    });

    test('rejects invalid payment method', async () => {
        const response = await postOrder({
            customer: {
                name: 'Test Customer',
                phone: '0780000012',
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

    test('rejects empty items array', async () => {
        const response = await postOrder({
            customer: {
                name: 'Test Customer',
                phone: '0780000013',
            },
            order_type: 'collection',
            payment_method: 'cash',
            items: [],
        });

        expect(response.statusCode).toBe(400);
    });

    test('rejects invalid menu item ID', async () => {
        const response = await postOrder({
            customer: {
                name: 'Test Customer',
                phone: '0780000014',
            },
            order_type: 'collection',
            payment_method: 'cash',
            items: [
                {
                    menu_item_id: -1,
                    quantity: 1,
                },
            ],
        });

        expect(response.statusCode).toBe(400);
    });

    test('rejects invalid quantity', async () => {
        const response = await postOrder({
            customer: {
                name: 'Test Customer',
                phone: '0780000015',
            },
            order_type: 'collection',
            payment_method: 'cash',
            items: [
                {
                    menu_item_id: 1,
                    quantity: 0,
                },
            ],
        });

        expect(response.statusCode).toBe(400);
    });

    test('rejects duplicate menu items', async () => {
        const response = await postOrder({
            customer: {
                name: 'Test Customer',
                phone: '0780000016',
            },
            order_type: 'collection',
            payment_method: 'cash',
            items: [
                {
                    menu_item_id: 1,
                    quantity: 1,
                    expected_price: 65,
                },
                {
                    menu_item_id: 1,
                    quantity: 2,
                    expected_price: 65,
                },
            ],
        });

        expect(response.statusCode).toBe(400);

        expect(response.body.error).toBe(
            'Duplicate menu items are not allowed. Combine their quantities.'
        );
    });

    test('rejects delivery order without location', async () => {
        const response = await postOrder({
            customer: {
                name: 'Test Customer',
                phone: '0780000017',
            },
            order_type: 'delivery',
            payment_method: 'cash',
            items: [
                {
                    menu_item_id: 1,
                    quantity: 1,
                    expected_price: 65,
                },
            ],
        });

        expect(response.statusCode).toBe(400);
    });

    test('rejects collection order with location', async () => {
        const response = await postOrder({
            customer: {
                name: 'Test Customer',
                phone: '0780000018',
            },
            order_type: 'collection',
            payment_method: 'cash',
            items: [
                {
                    menu_item_id: 1,
                    quantity: 1,
                    expected_price: 65,
                },
            ],
            latitude: -26.2041,
            longitude: 28.0473,
        });

        expect(response.statusCode).toBe(400);
    });

    test('rejects invalid latitude', async () => {
        const response = await postOrder({
            customer: {
                name: 'Test Customer',
                phone: '0780000019',
            },
            order_type: 'delivery',
            payment_method: 'cash',
            items: [
                {
                    menu_item_id: 1,
                    quantity: 1,
                    expected_price: 65,
                },
            ],
            latitude: 100,
            longitude: 28.0473,
        });

        expect(response.statusCode).toBe(400);
    });

    test('rejects invalid longitude', async () => {
        const response = await postOrder({
            customer: {
                name: 'Test Customer',
                phone: '0780000020',
            },
            order_type: 'delivery',
            payment_method: 'cash',
            items: [
                {
                    menu_item_id: 1,
                    quantity: 1,
                    expected_price: 65,
                },
            ],
            latitude: -26.2041,
            longitude: 200,
        });

        expect(response.statusCode).toBe(400);
    });

    test('rejects notes longer than 500 characters', async () => {
        const response = await postOrder({
            customer: {
                name: 'Test Customer',
                phone: '0780000021',
            },
            order_type: 'collection',
            payment_method: 'cash',
            notes: 'A'.repeat(501),
            items: [
                {
                    menu_item_id: 1,
                    quantity: 1,
                },
            ],
        });

        expect(response.statusCode).toBe(400);
    });
});

// ==========================================================
// API SECURITY BOUNDARY
// ==========================================================

describe('API Security Boundary', () => {
    test('public user cannot retrieve all orders', async () => {
        const response = await request(app)
            .get('/api/orders');

        expect(response.statusCode).toBe(401);
    });

    test('public user cannot retrieve a single order', async () => {
        const response = await request(app)
            .get('/api/orders/1');

        expect(response.statusCode).toBe(401);
    });

    test('public user cannot change order status', async () => {
        const response = await request(app)
            .patch('/api/orders/1/status')
            .send({
                status: 'confirmed',
            });

        expect(response.statusCode).toBe(401);
    });

    test('public user can create an order', async () => {
        const response = await postOrder({
            customer: {
                name: 'Security Test Customer',
                phone: '0780000099',
            },
            order_type: 'collection',
            payment_method: 'cash',
            items: await withExpectedPrices([
                {
                    menu_item_id: 1,
                    quantity: 1,
                },
            ]),
        });

        expect(response.statusCode).toBe(201);
    });
});
