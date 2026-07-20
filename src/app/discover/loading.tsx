export default function DiscoverLoading() {
  return (
    <main className="container" style={{ padding: "42px 0" }} aria-busy="true">
      <div className="skeleton" style={{ maxWidth: 760, minHeight: 150, marginBottom: 28 }} />
      <div className="skeleton" style={{ minHeight: 110, marginBottom: 28 }} />
      <div className="grid-auto">
        {[1, 2, 3].map((item) => <div className="skeleton" style={{ minHeight: 320 }} key={item} />)}
      </div>
    </main>
  );
}
