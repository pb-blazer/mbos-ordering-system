import { useEffect, useRef } from 'react';
import Header from '../components/Header';
import Hero from '../components/Hero';

const featuredFoods = [
    {
        name: 'Chicken Wings',
        category: 'FIRE GRILLED',
    },
    {
        name: 'Pork',
        category: 'TENDER & JUICY',
    },
    {
        name: 'Fries',
        category: 'CRISPY SIDES',
    },
];

function Home() {
    const featuredSectionRef = useRef(null);

    useEffect(() => {
        const section = featuredSectionRef.current;

        if (!section) {
            return;
        }

        const elements = section.querySelectorAll(
            '.featured-heading, .featured-card, .featured-action'
        );

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) {
                        return;
                    }

                    entry.target.classList.add('is-visible');

                    // Animate only once.
                    observer.unobserve(entry.target);
                });
            },
            {
                threshold: 0.15,
            }
        );

        elements.forEach((element) => {
            observer.observe(element);
        });

        return () => {
            observer.disconnect();
        };
    }, []);

    return (
        <>
            <Header />

            <main>
                <Hero />

                <section
                    className="featured-section"
                    id="top-food"
                    ref={featuredSectionRef}
                >
                    <div className="section-heading featured-heading">
                        <p className="eyebrow">
                            WHAT'S GOOD AT MBO'S
                        </p>

                        <h2>
                            STRAIGHT FROM
                            <span> THE FIRE.</span>
                        </h2>

                        <p>
                            A few of the favourites you'll find
                            waiting for you at Mbo's.
                        </p>
                    </div>

                    <div className="featured-grid">
                        {featuredFoods.map((food) => (
                            <article
                                className="featured-card"
                                key={food.name}
                            >
                                <div className="featured-image">
                                    <span>
                                        IMAGE COMING SOON
                                    </span>
                                </div>

                                <div className="featured-card-content">
                                    <p>{food.category}</p>

                                    <h3>{food.name}</h3>
                                </div>
                            </article>
                        ))}
                    </div>

                    <div className="featured-action">
                        <a
                            href="/menu"
                            className="primary-button"
                        >
                            Browse Menu
                        </a>
                    </div>
                </section>
            </main>
        </>
    );
}

export default Home;