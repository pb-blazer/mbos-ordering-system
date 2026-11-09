function MenuCard({ item, onAdd, quantity = 0 }) {
    const price = Number(item.price);

    const category =
        item.category ||
        item.category_name ||
        'Menu';

    return (
        <article
            className={
                quantity > 0
                    ? 'menu-card menu-card-selected'
                    : 'menu-card'
            }
        >
            <div className="menu-card-top">
                <span className="menu-category">
                    {category}
                </span>

                {item.available ? (
                    <span className="availability available">
                        Available
                    </span>
                ) : (
                    <span className="availability unavailable">
                        Unavailable
                    </span>
                )}
            </div>

            <div className="menu-card-content">
                <h3>{item.name}</h3>

                {item.description && (
                    <p>{item.description}</p>
                )}
            </div>

            <div className="menu-card-bottom">
                <strong>
                    R
                    {Number.isFinite(price)
                        ? price.toFixed(2)
                        : '0.00'}
                </strong>

                <div className="add-button-wrapper">
                    {quantity > 0 && (
                        <span className="item-quantity-badge">
                            ({quantity})
                        </span>
                    )}

                    <button
                        type="button"
                        className="add-button"
                        onClick={() => onAdd(item)}
                        disabled={!item.available}
                        aria-label={
                            item.available
                                ? `Add ${item.name} to order`
                                : `${item.name} is unavailable`
                        }
                    >
                        +
                    </button>
                </div>
            </div>
        </article>
    );
}

export default MenuCard;