import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Page, PageHero, Notice, Loading, LoadError } from '../../components/Layout.jsx';
import { RiskBadge } from '../../components/Assessment.jsx';
import TrendChart from '../../components/TrendChart.jsx';
import { useApi, usePageTitle } from '../../lib/hooks.js';
import { api } from '../../lib/api.js';
import { stampDate, stampTime } from '../../lib/format.js';
import { riskPercent } from '@shared/assessment.js';

export default function History() {
    usePageTitle('My Prediction History - DaaktarSahab');
    const location = useLocation();
    const { data, error, reload } = useApi('/patient/readings');
    const [notice, setNotice] = useState(location.state?.notice ? ['ok', location.state.notice] : null);
    const rows = data?.readings || [];

    // The chart runs oldest to newest and skips anything not scored.
    const trend = [...rows].reverse().filter((r) => r.riskScore !== null).map((r) => ({
        id: r.id,
        time: new Date(r.takenAt).getTime(),
        date: stampDate(r.takenAt),
        score: riskPercent(r.riskScore),
    }));
    const latest = trend[trend.length - 1];
    const previous = trend.length > 1 ? trend[trend.length - 2] : null;

    async function remove(id) {
        if (!window.confirm('Delete this reading? This cannot be undone.')) return;
        try {
            await api.del(`/patient/readings/${id}`);
            setNotice(['ok', 'The reading was deleted.']);
        } catch (err) {
            setNotice(['bad', err.message]);
        }
        reload();
    }

    return (
        <Page header="patient" page="pg-history">
            <PageHero eyebrow="My history" title="Prediction history">
                Every heart check you have taken, with its risk score. Open one to see the full result or download it as a PDF.
            </PageHero>

            <main className="page-body">
                {notice && <Notice type={notice[0]}>{notice[1]}</Notice>}
                {error && !data && <LoadError error={error} />}

                {trend.length > 0 && (
                    <section className="panel" aria-labelledby="trendTitle">
                        <div className="trend-head">
                            <div>
                                <h2 className="panel__title" id="trendTitle">Risk score over time</h2>
                                <p className="panel__sub">0 to 100. Readings above 50 are classed as high risk.</p>
                            </div>
                            <div className="trend-stat">
                                <div className="trend-stat-value">{latest.score}<small>/100 latest</small></div>
                                {previous && (() => {
                                    const delta = latest.score - previous.score;
                                    return (
                                        <div className="trend-stat-delta">
                                            {delta === 0 ? 'No change since the previous reading'
                                                : `${delta < 0 ? '▼ Down' : '▲ Up'} ${Math.abs(delta)} points since the previous reading`}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {trend.length > 1 ? <TrendChart points={trend} /> : (
                            <div className="empty-state">
                                <p>Take another heart check later to see how your score changes over time.</p>
                            </div>
                        )}
                    </section>
                )}

                <section className="panel">
                    <div className="panel__head">
                        <div>
                            <h2 className="panel__title">All readings</h2>
                            <p className="panel__sub">{data ? `${rows.length} ${rows.length === 1 ? 'reading' : 'readings'}` : ''}</p>
                        </div>
                        <Link to="/patient/heart-check" className="btn btn-primary btn-sm">+ New heart check</Link>
                    </div>

                    {!data ? <Loading /> : rows.length ? (
                        <div className="table-scroll">
                            <table className="data-table stack">
                                <thead>
                                    <tr>
                                        <th>Date</th><th>Risk score</th><th>Age</th><th>BP</th>
                                        <th>Cholesterol</th><th>Max heart rate</th><th>ST depression</th><th />
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr key={row.id}>
                                            <td className="cell-strong nowrap" data-label="Date">
                                                <div>{stampDate(row.takenAt)}<br /><span className="cell-muted">{stampTime(row.takenAt)}</span></div>
                                            </td>
                                            <td data-label="Risk score"><RiskBadge score={row.riskScore} /></td>
                                            <td data-label="Age">{row.values.age}</td>
                                            <td data-label="BP">{row.values.trestbps}</td>
                                            <td data-label="Cholesterol">{row.values.chol}</td>
                                            <td data-label="Max heart rate">{row.values.thalach}</td>
                                            <td data-label="ST depression">{Number(row.values.oldpeak).toFixed(1)}</td>
                                            <td>
                                                <div className="row-actions">
                                                    <Link className="btn btn-light btn-sm" to={`/patient/readings/${row.id}`}>View</Link>
                                                    <a className="btn btn-light btn-sm" href={`/api/patient/readings/${row.id}/pdf`}>PDF</a>
                                                    <Link className="btn btn-light btn-sm" to={`/patient/readings/${row.id}/edit`}>Edit</Link>
                                                    <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(row.id)}>Delete</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <p>You haven't taken a heart check yet.</p>
                            <Link to="/patient/heart-check" className="btn btn-primary">Take your first check</Link>
                        </div>
                    )}
                </section>
            </main>
        </Page>
    );
}
