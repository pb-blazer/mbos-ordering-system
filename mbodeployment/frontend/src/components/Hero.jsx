function Hero() {
    return (
        <section className="hero" id="home">
            <div className="hero-overlay" />

            <div className="hero-content">
                <p className="eyebrow">
                    THE HOME OF...
                </p>

                <h1>
                    GOOD FOOD.
                    <span>REAL FIRE.</span>
                </h1>

                <p className="hero-description">
                    Bold flavours, real fire and properly
                    prepared food. Welcome to Mbo's
                    Tshisanyama.
                </p>

                <a
                    href="/menu"
                    className="primary-button"
                >
                    Browse Menu
                </a>
            </div>
        </section>
    );
}

export default Hero;