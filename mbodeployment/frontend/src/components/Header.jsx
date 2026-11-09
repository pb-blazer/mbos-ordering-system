function Header() {
    const path =
        window.location.pathname;

    const statusPageActive =
        path === '/order-status';

    const orderPagesActive =
        path === '/menu' ||
        path === '/checkout';

    return (
        <header className="site-header">

            <a
                href="/"
                className="brand"
                aria-label="Mbo's Tshisanyama home"
            >
                <img
                    src="/mbos-logo.png"
                    alt="Mbo's Tshisanyama"
                    className="brand-logo"
                />
            </a>


            <nav className="main-nav">
                <a href="/">
                    HOME
                </a>

                <a href="/menu">
                    MENU
                </a>
            </nav>


            <div className="header-actions">

                {statusPageActive ? (
                    <span
                        className="header-status-button header-button-inactive"
                        aria-disabled="true"
                    >
                        CHECK ORDER STATUS
                    </span>
                ) : (
                    <a
                        href="/order-status"
                        className="header-status-button"
                    >
                        CHECK ORDER STATUS
                    </a>
                )}


                {orderPagesActive ? (
                    <span
                        className="header-order-button header-button-inactive"
                        aria-disabled="true"
                    >
                        ORDER NOW
                    </span>
                ) : (
                    <a
                        href="/menu"
                        className="header-order-button"
                    >
                        ORDER NOW
                    </a>
                )}

            </div>

        </header>
    );
}

export default Header;