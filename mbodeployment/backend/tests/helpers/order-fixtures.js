
const request = require('supertest');
const { randomUUID } = require('crypto');

const app = require('../../app');

const { cleanupOrder } = require('./test-db');
const { withExpectedPrices } = require('./priced-items');

const adminUserToken = process.env.TEST_ADMIN_USER_TOKEN;

let phoneSequence = 0;

function uniquePhone() {
    phoneSequence = (phoneSequence + 1) % 10000000;

    const timePart = Date.now() % 10000000;

    const suffix = String(
        (timePart + phoneSequence) % 10000000
    ).padStart(7, '0');

    return `078${suffix}`;
}

async function createDeliveryOrder(name) {
    const response = await request(app)
        .post('/api/orders')
        .set('Idempotency-Key', randomUUID())
        .send({
            customer: {
                name,
                phone: uniquePhone(),
            },
            order_type: 'delivery',
            payment_method: 'cash',
            notes: 'Automated test fixture',
            items: await withExpectedPrices([
                {
                    menu_item_id: 1,
                    quantity: 1,
                },
            ]),
            latitude: -26.2041,
            longitude: 28.0473,
        });

    if (response.statusCode !== 201) {
        throw new Error(
            `Failed to create fixture order: ${JSON.stringify(response.body)}`
        );
    }

    const orderId = response.body?.order?.order_id;

    if (!orderId) {
        throw new Error(
            `Fixture order response did not contain an order ID: ${JSON.stringify(response.body)}`
        );
    }

    return orderId;
}

async function updateOrderStatus(orderId, status) {
    if (!adminUserToken) {
        throw new Error(
            'TEST_ADMIN_USER_TOKEN is required to update fixture orders.'
        );
    }

    const response = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({ status });

    if (response.statusCode !== 200) {
        throw new Error(
            `Failed to update fixture order ${orderId} to ${status}: ` +
            JSON.stringify(response.body)
        );
    }

    return response.body;
}

async function deleteOrder(orderId) {
    return cleanupOrder(orderId);
}

async function createLocationFixtures() {
    if (!adminUserToken) {
        throw new Error(
            'TEST_ADMIN_USER_TOKEN is required to create test fixtures.'
        );
    }

    const createdOrderIds = [];

    try {
        const pendingOrderId = await createDeliveryOrder(
            'Automated Fixture Pending'
        );

        createdOrderIds.push(pendingOrderId);

        const confirmedOrderId = await createDeliveryOrder(
            'Automated Fixture Confirmed'
        );

        createdOrderIds.push(confirmedOrderId);

        const completedOrderId = await createDeliveryOrder(
            'Automated Fixture Completed'
        );

        createdOrderIds.push(completedOrderId);

        await updateOrderStatus(
            confirmedOrderId,
            'confirmed'
        );

        await updateOrderStatus(
            completedOrderId,
            'confirmed'
        );

        await updateOrderStatus(
            completedOrderId,
            'preparing'
        );

        await updateOrderStatus(
            completedOrderId,
            'ready'
        );

        await updateOrderStatus(
            completedOrderId,
            'completed'
        );

        return {
            pendingOrderId,
            confirmedOrderId,
            completedOrderId,
        };
    } catch (error) {
        // Clean up any fixtures created before setup failed.
        for (const orderId of createdOrderIds.reverse()) {
            try {
                await cleanupOrder(orderId);
            } catch (cleanupError) {
                console.error(
                    `Fixture cleanup failed for order ${orderId}:`,
                    cleanupError.message
                );
            }
        }

        throw error;
    }
}

module.exports = {
    createDeliveryOrder,
    updateOrderStatus,
    deleteOrder,
    createLocationFixtures,
    cleanupOrder,
};
