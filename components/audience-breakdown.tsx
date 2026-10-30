import type { AudienceSummary } from "@/lib/demographics";

const number = new Intl.NumberFormat("en-US");

// The anonymized audience, one bar chart per dimension. Only aggregates reach this
// component; there is no per-person data to leak. Each row states its own label,
// share and count as text, so the bars are never the only way to read a value.
export function AudienceBreakdown({ summary }: { summary: AudienceSummary }) {
  if (summary.tooSmall) return <div className="empty-state"><h2>Not enough to show yet.</h2><p>We show an audience summary once at least 10 people with public profiles are counted, so nobody can be picked out. Check back closer to the event.</p></div>;
  return <div className="audience">
    <p className="audience-coverage">Based on {number.format(summary.classified)} of {number.format(summary.people)} people with enough public profile information. Groups under 5 people are combined, and no one is shown individually.</p>
    <div className="audience-grid">
      {summary.dimensions.map((d) => <section className="audience-card" key={d.key} aria-labelledby={`aud-${d.key}`}>
        <h2 id={`aud-${d.key}`}>{d.title}</h2>
        {d.note ? <p className="audience-note">{d.note}</p> : null}
        <ul className="audience-bars">
          {d.bars.map((bar) => <li key={bar.id} title={`${bar.label}: ${bar.percent}% (${number.format(bar.count)} people)`}>
            <div className="audience-bar-label"><span>{bar.label}</span><span>{bar.percent}%</span></div>
            <div className="audience-track" aria-hidden="true"><span style={{ width: `${Math.max(bar.percent, 1)}%` }} /></div>
          </li>)}
        </ul>
        <p className="audience-note">{number.format(d.known)} people</p>
      </section>)}
      {summary.employers.length ? <section className="audience-card" aria-labelledby="aud-employers">
        <h2 id="aud-employers">Where people work</h2>
        <p className="audience-note">Organizations with 5 or more people.</p>
        <ul className="audience-employers">
          {summary.employers.map((e) => <li key={e.name}><span>{e.name}</span><span>{number.format(e.count)}</span></li>)}
        </ul>
      </section> : null}
    </div>
  </div>;
}
