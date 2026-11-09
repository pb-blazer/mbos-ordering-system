process.env.ORDER_CREATION_RATE_LIMIT = '20';

const request = require('supertest');
const app = require('../app');

describe('Order Rate Limiting', () => {
test('blocks excessive public order requests', async () => {
let lastResponse;


    for (let i = 0; i < 21; i++) {
        lastResponse = await request(app)
            .post('/api/orders')
            .send({});
    }

    expect(lastResponse.statusCode).toBe(429);
    expect(lastResponse.body.error).toBe(
        'Too many order requests. Please try again later.'
    );
});

});
