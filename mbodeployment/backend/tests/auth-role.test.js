
const request = require('supertest');
const app = require('../app');

const normalUserToken = process.env.TEST_NORMAL_USER_TOKEN;
const adminUserToken = process.env.TEST_ADMIN_USER_TOKEN;

describe('Admin Role Authorization', () => {
    if (normalUserToken) {
        test('normal authenticated user is rejected with 403', async () => {
            const response = await request(app)
                .get('/api/orders')
                .set('Authorization', `Bearer ${normalUserToken}`);

            expect(response.statusCode).toBe(403);
        });
    } else {
        test.skip('normal authenticated user is rejected with 403', () => {});
    }

    if (adminUserToken) {
        test('admin authenticated user is allowed access', async () => {
            const response = await request(app)
                .get('/api/orders')
                .set('Authorization', `Bearer ${adminUserToken}`);

            expect(response.statusCode).toBe(200);
        });
    } else {
        test.skip('admin authenticated user is allowed access', () => {});
    }
});