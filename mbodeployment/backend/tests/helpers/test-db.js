require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL) {
    throw new Error(
        'SUPABASE_URL is required for test database cleanup.'
    );
}

if (!process.env.SUPABASE_KEY) {
    throw new Error(
        'SUPABASE_KEY is required for test database cleanup.'
    );
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

async function cleanupOrder(orderId) {

    // --------------------------------------------------
    // GET CUSTOMER ID
    // --------------------------------------------------

    const {
        data: order,
        error: orderFetchError
    } = await supabase
        .from('orders')
        .select('customer_id')
        .eq('id', orderId)
        .single();

    if (orderFetchError) {
        if (orderFetchError.code === 'PGRST116') {
            return;
        }

        throw new Error(
            `Failed to fetch fixture order ${orderId}: ` +
            JSON.stringify(orderFetchError)
        );
    }

    const customerId = order.customer_id;


    // --------------------------------------------------
    // DELETE ORDER ITEMS
    // --------------------------------------------------

    const {
        error: itemsDeleteError
    } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId);

    if (itemsDeleteError) {
        throw new Error(
            `Failed to delete order items for fixture ` +
            `${orderId}: ` +
            JSON.stringify(itemsDeleteError)
        );
    }


    // --------------------------------------------------
    // DELETE ORDER
    // --------------------------------------------------

    const {
        error: orderDeleteError
    } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

    if (orderDeleteError) {
        throw new Error(
            `Failed to delete fixture order ${orderId}: ` +
            JSON.stringify(orderDeleteError)
        );
    }


    // --------------------------------------------------
    // CHECK FOR REMAINING CUSTOMER ORDERS
    // --------------------------------------------------

    const {
        data: remainingOrders,
        error: remainingOrdersError
    } = await supabase
        .from('orders')
        .select('id')
        .eq('customer_id', customerId)
        .limit(1);

    if (remainingOrdersError) {
        throw new Error(
            `Failed to check remaining orders for customer ` +
            `${customerId}: ` +
            JSON.stringify(remainingOrdersError)
        );
    }


    // --------------------------------------------------
    // DELETE CUSTOMER IF UNUSED
    // --------------------------------------------------

    if (remainingOrders.length === 0) {

        const {
            error: customerDeleteError
        } = await supabase
            .from('customers')
            .delete()
            .eq('id', customerId);

        if (customerDeleteError) {
            throw new Error(
                `Failed to delete fixture customer ` +
                `${customerId}: ` +
                JSON.stringify(customerDeleteError)
            );
        }
    }
}

module.exports = {
    cleanupOrder
};