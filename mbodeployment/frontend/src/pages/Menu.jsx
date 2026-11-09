
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import Header from '../components/Header';
import MenuCard from '../components/MenuCard';

import {
    getMenu,
    subscribeToMenuChanges,
} from '../services/MenuService';

import {
    addToCart,
    getStoredCart,
    saveCart,
    removeFromCart,
    updateCartQuantity,
    reconcileCartWithMenu,
    clearCartIfFlaggedOnMenuReturn,
    subscribeToCartChanges,
} from '../services/CartService';

function Menu() {
    const [menu, setMenu] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [menuSynchronized, setMenuSynchronized] = useState(false);

    const [cart, setCart] = useState(getStoredCart);
    const [showCart, setShowCart] = useState(false);
    const [activeCategory, setActiveCategory] = useState('All');

    const refreshRequestId = useRef(0);

    // ======================================================
    // LOAD AND REFRESH MENU
    // ======================================================

    const refreshMenu = useCallback(async (showLoading = false) => {
        const requestId = ++refreshRequestId.current;

        setMenuSynchronized(false);

        if (showLoading) {
            setLoading(true);
            setError('');
        }

        try {
            const response = await getMenu();

            if (requestId !== refreshRequestId.current) {
                return;
            }

            let latestMenu;

            if (Array.isArray(response)) {
                latestMenu = response;
            } else if (Array.isArray(response?.menu)) {
                latestMenu = response.menu;
            } else if (Array.isArray(response?.items)) {
                latestMenu = response.items;
            } else if (Array.isArray(response?.data)) {
                latestMenu = response.data;
            } else {
                latestMenu = [];
            }

            setMenu(latestMenu);

            // Clear the old cart after the customer returns
            // from a checkout price-conflict response.
            const shouldClearCart =
                clearCartIfFlaggedOnMenuReturn();

            if (shouldClearCart) {
                setCart(getStoredCart());
            } else {
                // Keep the cart synchronized with current menu prices
                // and availability.
                const updatedCart =
                    reconcileCartWithMenu(latestMenu);

                setCart(updatedCart);
            }

            setError('');
            setMenuSynchronized(true);
        } catch (refreshError) {
            if (requestId !== refreshRequestId.current) {
                return;
            }

            console.error(
                'Could not refresh customer menu:',
                refreshError
            );

            setError(
                'Could not load menu. Please make sure the Mbo’s backend is running.'
            );
        } finally {
            if (requestId === refreshRequestId.current) {
                setLoading(false);
            }
        }
    }, []);

    // ======================================================
    // INITIAL LOAD, REALTIME AND CART SUBSCRIPTIONS
    // ======================================================

    useEffect(() => {
        let active = true;

        refreshMenu(true);

        const unsubscribeMenu = subscribeToMenuChanges(() => {
            if (active) {
                refreshMenu(false);
            }
        });

        const unsubscribeCart = subscribeToCartChanges(
            (updatedCart) => {
                if (active) {
                    setCart(updatedCart);
                }
            }
        );

        const handlePageShow = (event) => {
            if (event.persisted && active) {
                refreshMenu(false);
            }
        };

        window.addEventListener('pageshow', handlePageShow);

        return () => {
            active = false;
            refreshRequestId.current += 1;

            unsubscribeMenu();
            unsubscribeCart();

            window.removeEventListener(
                'pageshow',
                handlePageShow
            );
        };
    }, [refreshMenu]);

    // ======================================================
    // CART ACTIONS
    // ======================================================

    function handleAddToCart(item) {
        if (
            !menuSynchronized ||
            item.available !== true
        ) {
            return;
        }

        const updatedCart = addToCart(item);
        setCart(updatedCart);
    }

    function handleIncrease(itemId) {
        const currentItem = cart.find(
            (item) => String(item.id) === String(itemId)
        );

        if (
            !currentItem ||
            currentItem.available === false
        ) {
            return;
        }

        const updatedCart = updateCartQuantity(
            itemId,
            Number(currentItem.quantity) + 1
        );

        setCart(updatedCart);
    }

    function handleDecrease(itemId) {
        const currentItem = cart.find(
            (item) => String(item.id) === String(itemId)
        );

        if (!currentItem) {
            return;
        }

        const updatedCart = updateCartQuantity(
            itemId,
            Number(currentItem.quantity) - 1
        );

        setCart(updatedCart);
    }

    function handleRemove(itemId) {
        const updatedCart = removeFromCart(itemId);
        setCart(updatedCart);

        if (updatedCart.length === 0) {
            setShowCart(false);
        }
    }

    // ======================================================
    // REMOVE ALL UNAVAILABLE ITEMS
    // ======================================================
    //
    // Both "REMOVE UNAVAILABLE ITEMS" buttons call this
    // function. It removes every unavailable cart line,
    // preserves every available item, saves the new cart,
    // and updates the UI immediately.
    // ======================================================

    function handleRemoveUnavailableItems() {
        if (!menuSynchronized) {
            return;
        }

        const updatedCart = cart.filter(
            (item) => item.available !== false
        );

        // Persist the change and notify any other components
        // subscribed to CartService.
        saveCart(updatedCart);

        // Update this component immediately.
        setCart(updatedCart);

        if (updatedCart.length === 0) {
            setShowCart(false);
        }
    }

    function getItemQuantity(itemId) {
        const cartItem = cart.find(
            (item) => String(item.id) === String(itemId)
        );

        return cartItem
            ? Number(cartItem.quantity)
            : 0;
    }

    // ======================================================
    // CART TOTALS AND AVAILABILITY
    // ======================================================

    const cartCount = cart.reduce(
        (total, item) =>
            total + Number(item.quantity || 0),
        0
    );

    const cartTotal = cart.reduce(
        (total, item) => {
            const price = Number(item.price) || 0;
            const quantity = Number(item.quantity) || 0;

            return total + price * quantity;
        },
        0
    );

    const unavailableItems = cart.filter(
        (item) => item.available === false
    );

    const cartHasUnavailableItems =
        unavailableItems.length > 0;

    const canProceedToCheckout =
        menuSynchronized &&
        cartCount > 0 &&
        !cartHasUnavailableItems;

    // ======================================================
    // CATEGORY FILTER
    // ======================================================

    const categories = useMemo(() => {
        const uniqueCategories = [
            ...new Set(
                menu
                    .map(
                        (item) =>
                            item.category ||
                            item.category_name
                    )
                    .filter(Boolean)
            ),
        ];

        return ['All', ...uniqueCategories];
    }, [menu]);

    const filteredMenu = useMemo(() => {
        if (activeCategory === 'All') {
            return menu;
        }

        return menu.filter(
            (item) =>
                (item.category || item.category_name) ===
                activeCategory
        );
    }, [menu, activeCategory]);

    // ======================================================
    // CHECKOUT NAVIGATION
    // ======================================================

    function handleProceedToCheckout() {
        if (!canProceedToCheckout) {
            return;
        }

        window.location.href = '/checkout';
    }

    function handleCartAction() {
        if (!menuSynchronized) {
            return;
        }

        if (cartHasUnavailableItems) {
            handleRemoveUnavailableItems();
            return;
        }

        handleProceedToCheckout();
    }

    // ======================================================
    // RENDER
    // ======================================================

    return (
        <>
            <Header />

            <main className="menu-page">
                <section className="menu-content">
                    {loading && (
                        <div className="menu-state">
                            <div className="menu-loader"></div>
                            <p>LOADING MENU...</p>
                        </div>
                    )}

                    {!loading && error && (
                        <div className="menu-state menu-error">
                            <div className="menu-error-icon">
                                !
                            </div>

                            <h2>COULDN'T LOAD THE MENU</h2>

                            <p>{error}</p>

                            <button
                                type="button"
                                onClick={() => refreshMenu(true)}
                            >
                                TRY AGAIN
                            </button>
                        </div>
                    )}

                    {!loading &&
                        !error &&
                        menu.length === 0 && (
                            <div className="menu-state">
                                <h2>MENU COMING SOON</h2>
                                <p>We're getting the food ready.</p>
                            </div>
                        )}

                    {!loading &&
                        !error &&
                        menu.length > 0 && (
                            <div className="menu-sections">
                                {/* CATEGORY FILTER */}

                                <div className="category-filter">
                                    {categories.map((category) => (
                                        <button
                                            key={category}
                                            type="button"
                                            className={
                                                activeCategory === category
                                                    ? 'category-button active'
                                                    : 'category-button'
                                            }
                                            onClick={() =>
                                                setActiveCategory(category)
                                            }
                                        >
                                            {category}
                                        </button>
                                    ))}
                                </div>

                                {/* MENU ITEMS */}

                                <section className="menu-section">
                                    <div className="menu-section-header">
                                        <p>MBOS FAVOURITES</p>

                                        <h2>
                                            {activeCategory.toUpperCase()}
                                        </h2>
                                    </div>

                                    <div className="menu-grid">
                                        {filteredMenu.map((item) => (
                                            <MenuCard
                                                key={item.id}
                                                item={item}
                                                quantity={getItemQuantity(
                                                    item.id
                                                )}
                                                onAdd={handleAddToCart}
                                            />
                                        ))}
                                    </div>
                                </section>
                            </div>
                        )}
                </section>
            </main>

            {/* CART BAR */}

            {cartCount > 0 && (
                <div className="cart-bar">
                    <button
                        type="button"
                        className="cart-view-button"
                        onClick={() =>
                            setShowCart((current) => !current)
                        }
                    >
                        <span className="cart-count">
                            {cartCount}
                        </span>

                        <span>
                            {showCart
                                ? 'HIDE ORDER'
                                : 'VIEW ORDER'}
                        </span>
                    </button>

                    <button
                        type="button"
                        className="cart-checkout-button"
                        onClick={handleCartAction}
                        disabled={!menuSynchronized}
                        title={
                            !menuSynchronized
                                ? 'Checking the latest menu.'
                                : cartHasUnavailableItems
                                    ? 'Remove unavailable items from your cart.'
                                    : 'Proceed to checkout.'
                        }
                    >
                        <span>
                            {!menuSynchronized
                                ? 'CHECKING MENU...'
                                : cartHasUnavailableItems
                                    ? 'REMOVE UNAVAILABLE ITEMS'
                                    : 'PROCEED TO CHECKOUT'}
                        </span>

                        <strong>
                            R{cartTotal.toFixed(2)}
                        </strong>
                    </button>
                </div>
            )}

            {/* CART DRAWER */}

            {showCart && cartCount > 0 && (
                <div className="cart-drawer">
                    <div className="cart-drawer-header">
                        <div>
                            <p>YOUR ORDER</p>

                            <h2>
                                {cartCount}{' '}
                                {cartCount === 1 ? 'ITEM' : 'ITEMS'}
                            </h2>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowCart(false)}
                            aria-label="Close order drawer"
                        >
                            ×
                        </button>
                    </div>

                    {cartHasUnavailableItems && (
                        <p
                            className="cart-item-warning"
                            role="alert"
                        >
                            Some items are no longer available.
                            Remove them before proceeding to checkout.
                        </p>
                    )}

                    {!menuSynchronized && (
                        <p role="status">
                            Checking the latest menu. Please wait.
                        </p>
                    )}

                    <div className="cart-drawer-items">
                        {cart.map((item) => (
                            <div
                                className="cart-drawer-item"
                                key={item.id}
                            >
                                <div className="cart-item-info">
                                    <strong>{item.name}</strong>

                                    <span>
                                        R
                                        {Number(item.price).toFixed(2)}
                                        {' '}each
                                    </span>

                                    {item.available === false && (
                                        <p
                                            className="cart-item-warning"
                                            role="alert"
                                        >
                                            {item.unavailableReason ||
                                                'This item is currently unavailable.'}
                                            {' '}Remove it before checkout.
                                        </p>
                                    )}
                                </div>

                                <div className="cart-item-controls">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleDecrease(item.id)
                                        }
                                        aria-label={`Decrease quantity of ${item.name}`}
                                    >
                                        −
                                    </button>

                                    <strong>{item.quantity}</strong>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleIncrease(item.id)
                                        }
                                        disabled={
                                            item.available === false
                                        }
                                        aria-label={`Increase quantity of ${item.name}`}
                                    >
                                        +
                                    </button>

                                    <button
                                        type="button"
                                        className="cart-remove"
                                        onClick={() =>
                                            handleRemove(item.id)
                                        }
                                        aria-label={`Remove ${item.name} from order`}
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="cart-drawer-footer">
                        <div>
                            <span>TOTAL</span>

                            <strong>
                                R{cartTotal.toFixed(2)}
                            </strong>
                        </div>

                        <button
                            type="button"
                            onClick={handleCartAction}
                            disabled={!menuSynchronized}
                        >
                            {!menuSynchronized
                                ? 'CHECKING MENU...'
                                : cartHasUnavailableItems
                                    ? 'REMOVE UNAVAILABLE ITEMS'
                                    : 'CHECKOUT'}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

export default Menu;
