export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="label">Loading dashboard</span>
      <div className="grid-auto" style={{ margin: "20px 0" }}>
        {[1, 2, 3, 4].map((item) => <div className="skeleton" key={item} />)}
      </div>
      <div className="skeleton" style={{ minHeight: 280 }} />
    </div>
  );
}
