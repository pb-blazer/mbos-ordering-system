
const request = require('supertest');
const app = require('../../app');

async function withExpectedPrices(items) {
    const response = await request(app).get('/api/menu');

    if (
        response.statusCode !== 200 ||
        !Array.isArray(response.body)
    ) {
        throw new Error(
            `Could not load menu prices for tests: ${JSON.stringify(response.body)}`
        );
    }

    const menuById = new Map(
        response.body.map((item) => [
            Number(item.id),
            item,
        ])
    );

    return items.map((item) => {
        const menuItem = menuById.get(
            Number(item.menu_item_id)
        );

        if (!menuItem) {
            throw new Error(
                `Test menu item ${item.menu_item_id} does not exist`
            );
        }

        const price = Number(menuItem.price);

        if (!Number.isFinite(price) || price < 0) {
            throw new Error(
                `Test menu item ${item.menu_item_id} has an invalid price`
            );
        }

        return {
            ...item,
            expected_price: Number(price.toFixed(2)),
        };
    });
}

module.exports = {
    withExpectedPrices,
};
