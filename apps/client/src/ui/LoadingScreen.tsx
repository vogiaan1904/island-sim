import './LoadingScreen.css';

/**
 * The calm first screen (island-ui, style A): the island hall's picture on a card, the game's name and one line saying
 * what is happening. A bare spinner on a blank page is not allowed.
 */
export function LoadingScreen() {
  return (
    <main className="loading-screen">
      <section className="loading-card">
        <img className="loading-picture" src="/icons/building_island-hall_a.png" alt="The island hall, waiting for you" width="256" height="256" />
        <h1 className="loading-title">Island Sim</h1>
        <p className="loading-line" role="status">
          Getting your island ready
        </p>
        <div className="loading-track" aria-hidden="true">
          <div className="loading-fill" />
        </div>
      </section>
    </main>
  );
}
