import { useMemo, useState } from 'react';
import MenuCard from './MenuCard';

function MenuSection({
    menu,
    loading,
    error,
    onAdd,
    cart,
}) {
    const [activeCategory, setActiveCategory] =
        useState('All');

    const categories = useMemo(() => {
        const uniqueCategories = [
            ...new Set(
                menu
                    .map((item) => item.category)
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
                item.category === activeCategory
        );
    }, [menu, activeCategory]);

    function getItemQuantity(itemId) {
        const cartItem = cart.find(
            (item) => item.id === itemId
        );

        return cartItem ? cartItem.quantity : 0;
    }

    return (
        <section
            className="menu-section"
            id="menu"
        >
            <div className="section-heading">
                <p className="eyebrow">
                    WHAT WE'RE COOKING
                </p>

                <h2>
                    THE <span>MENU</span>
                </h2>

                <p>
                    Pick your favourites and build
                    your order.
                </p>
            </div>

            {loading && (
                <div className="menu-state">
                    Loading the menu...
                </div>
            )}

            {error && (
                <div className="menu-state menu-error">
                    {error}
                </div>
            )}

            {!loading && !error && (
                <>
                    <div className="category-filter">
                        {categories.map(
                            (category) => (
                                <button
                                    key={category}
                                    type="button"
                                    className={
                                        activeCategory ===
                                        category
                                            ? 'category-button active'
                                            : 'category-button'
                                    }
                                    onClick={() =>
                                        setActiveCategory(
                                            category
                                        )
                                    }
                                >
                                    {category}
                                </button>
                            )
                        )}
                    </div>

                    <div className="menu-grid">
                        {filteredMenu.map(
                            (item) => (
                                <MenuCard
                                    key={item.id}
                                    item={item}
                                    onAdd={onAdd}
                                    quantity={getItemQuantity(
                                        item.id
                                    )}
                                />
                            )
                        )}
                    </div>
                </>
            )}
        </section>
    );
}

export default MenuSection;