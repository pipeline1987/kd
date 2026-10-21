export function HomeSearch() {
  return (
    <form className="home-search" action="/archive" method="get">
      <label htmlFor="ledger-q" className="sr-only">
        Search mission reports
      </label>
      <input
        id="ledger-q"
        name="q"
        type="search"
        placeholder="Search by topic, author, shinobi, or village…"
        autoComplete="off"
      />
      <button type="submit">Search the ledger</button>
    </form>
  );
}
