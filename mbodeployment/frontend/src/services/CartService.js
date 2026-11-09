
const CART_KEY = 'mbos-cart';
const CART_UPDATED_EVENT = 'mbos:cart-updated';
const CLEAR_CART_ON_MENU_RETURN_KEY =
    'mbos-clear-cart-on-menu-return';

function emitCartUpdate(cart) {
    if (typeof window === 'undefined') {
        return;
    }

    window.dispatchEvent(
        new CustomEvent(CART_UPDATED_EVENT, {
            detail: { cart },
        })
    );
}

function money(value) {
    const number = Number(value);

    return Number.isFinite(number)
        ? Math.round(number * 100) / 100
        : null;
}

export function getStoredCart() {
    try {
        const storedCart = localStorage.getItem(CART_KEY);

        if (!storedCart) {
            return [];
        }

        const parsedCart = JSON.parse(storedCart);

        return Array.isArray(parsedCart) ? parsedCart : [];
    } catch (error) {
        console.error('Failed to read cart:', error);
        return [];
    }
}

export function saveCart(cart) {
    const safeCart = Array.isArray(cart) ? cart : [];

    try {
        localStorage.setItem(CART_KEY, JSON.stringify(safeCart));
    } catch (error) {
        console.error('Failed to save cart:', error);
    }

    emitCartUpdate(safeCart);

    return safeCart;
}

export function clearCart() {
    try {
        localStorage.removeItem(CART_KEY);
    } catch (error) {
        console.error('Failed to clear cart:', error);
    }

    emitCartUpdate([]);

    return [];
}

export function subscribeToCartChanges(callback) {
    if (typeof window === 'undefined') {
        return () => {};
    }

    const handleCartUpdate = (event) => {
        callback(
            Array.isArray(event.detail?.cart)
                ? event.detail.cart
                : getStoredCart()
        );
    };

    const handleStorageUpdate = (event) => {
        if (event.key === CART_KEY) {
            callback(getStoredCart());
        }
    };

    window.addEventListener(
        CART_UPDATED_EVENT,
        handleCartUpdate
    );

    window.addEventListener(
        'storage',
        handleStorageUpdate
    );

    return () => {
        window.removeEventListener(
            CART_UPDATED_EVENT,
            handleCartUpdate
        );

        window.removeEventListener(
            'storage',
            handleStorageUpdate
        );
    };
}

// Called when the server rejects an order because its
// menu price is outdated. The cart is cleared when Menu
// mounts again, including when the customer uses Back.
export function flagCartToClearOnMenuReturn() {
    try {
        sessionStorage.setItem(
            CLEAR_CART_ON_MENU_RETURN_KEY,
            '1'
        );
    } catch (error) {
        console.error(
            'Could not save the menu-return cart flag:',
            error
        );
    }
}

export function clearCartIfFlaggedOnMenuReturn() {
    let shouldClear = false;

    try {
        shouldClear =
            sessionStorage.getItem(
                CLEAR_CART_ON_MENU_RETURN_KEY
            ) === '1';

        sessionStorage.removeItem(
            CLEAR_CART_ON_MENU_RETURN_KEY
        );
    } catch (error) {
        console.error(
            'Could not read the menu-return cart flag:',
            error
        );
    }

    if (shouldClear) {
        clearCart();
    }

    return shouldClear;
}

// Refresh every stored cart item using the latest menu data.
// Items removed from the menu are marked unavailable rather
// than silently disappearing from the customer's cart.
export function reconcileCartWithMenu(menu) {
    if (!Array.isArray(menu)) {
        return getStoredCart();
    }

    const latestMenuById = new Map(
        menu.map((item) => [String(item.id), item])
    );

    const cart = getStoredCart();

    const updatedCart = cart.map((cartItem) => {
        const latestItem = latestMenuById.get(
            String(cartItem.id)
        );

        if (!latestItem) {
            return {
                ...cartItem,
                available: false,
                unavailableReason:
                    'This item is no longer on the menu.',
            };
        }

        const oldPrice = money(cartItem.price);
        const newPrice = money(latestItem.price);

        let priceChange = cartItem.priceChange || null;

        if (
            oldPrice !== null &&
            newPrice !== null &&
            oldPrice !== newPrice
        ) {
            priceChange = {
                from: oldPrice,
                to: newPrice,
            };
        }

        return {
            ...cartItem,
            ...latestItem,
            id: latestItem.id,
            quantity: cartItem.quantity,
            price: latestItem.price,
            available: latestItem.available === true,
            unavailableReason:
                latestItem.available === true
                    ? null
                    : 'This item is currently unavailable.',
            priceChange,
        };
    });

    return saveCart(updatedCart);
}

export function addToCart(item) {
    const cart = getStoredCart();

    if (item.available === false) {
        return cart;
    }

    const existingIndex = cart.findIndex(
        (cartItem) =>
            String(cartItem.id) === String(item.id)
    );

    if (existingIndex !== -1) {
        const existingItem = cart[existingIndex];

        const oldPrice = money(existingItem.price);
        const newPrice = money(item.price);

        let priceChange = existingItem.priceChange || null;

        if (
            oldPrice !== null &&
            newPrice !== null &&
            oldPrice !== newPrice
        ) {
            priceChange = {
                from: oldPrice,
                to: newPrice,
            };
        }

        cart[existingIndex] = {
            ...existingItem,
            ...item,
            quantity: Number(existingItem.quantity || 0) + 1,
            priceChange,
        };
    } else {
        cart.push({
            ...item,
            quantity: 1,
            available: item.available !== false,
            priceChange: null,
        });
    }

    return saveCart(cart);
}

export function updateCartQuantity(itemId, quantity) {
    const cart = getStoredCart();

    const updatedCart = cart
        .map((item) =>
            String(item.id) === String(itemId)
                ? {
                    ...item,
                    quantity,
                }
                : item
        )
        .filter(
            (item) =>
                Number.isFinite(Number(item.quantity)) &&
                Number(item.quantity) > 0
        );

    return saveCart(updatedCart);
}

export function removeFromCart(itemId) {
    const updatedCart = getStoredCart().filter(
        (item) => String(item.id) !== String(itemId)
    );

    return saveCart(updatedCart);
}
