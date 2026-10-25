import type { Discovery } from '../shared/demo.js';

/** One reading surface for a finding's complete conditions and official records. */
export function DiscoveryEvidence({ discovery: d }: { discovery: Discovery }) {
  return <div className="discovery-evidence">
    <section className="discovery-conditions">
      <h4>Evidence and conditions</h4>
      <p>{d.summary}</p>
      <h5>Why Maple surfaced this</h5>
      <ul>{d.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
      <h5>What still needs review</h5>
      <ul>{d.outstanding.map(item => <li key={item}>{item}</li>)}</ul>
      <h5>Suggested next steps</h5>
      <ol>{d.nextSteps.map(item => <li key={item}>{item}</li>)}</ol>
    </section>
    <section className="discovery-sources">
      <h4>Official sources</h4>
      <ul className="source-list">{d.sources.map(source => <li key={source.id}>
        <a href={source.url} target="_blank" rel="noreferrer">{source.title}<span className="visually-hidden"> (opens in a new tab)</span></a>
        <small>Checked {new Date(source.retrievedAt).toLocaleString()}{source.effectiveFrom && ` · Effective ${source.effectiveFrom}`}</small>
        <small>Reviewed {new Date(source.reviewedAt).toLocaleString()}{source.publishedAt && ` · Published ${source.publishedAt}`}</small>
        <small className="source-fingerprint">Source version · SHA-256 <code>{source.bodySha256}</code></small>
      </li>)}</ul>
    </section>
  </div>;
}
