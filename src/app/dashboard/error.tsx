"use client";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <section className="card empty-state" role="alert">
      <h1>We couldn’t load this page</h1>
      <p>Your data is safe. Try loading the page again, or return to the overview.</p>
      <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={reset}>Try again</button>
        <a className="btn btn-secondary" href="/dashboard">Dashboard overview</a>
      </div>
    </section>
  );
}
