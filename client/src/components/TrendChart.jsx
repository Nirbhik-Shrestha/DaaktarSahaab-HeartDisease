/**
 * Risk score over time: an SVG line chart, oldest to newest, placed by date
 * so gaps between checks show as gaps. Hover or arrow keys show a reading;
 * click (or Enter) opens it.
 */
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';

const W = 640;
const H = 240;
const PAD = { top: 16, right: 44, bottom: 30, left: 34 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

export default function TrendChart({ points }) {
    const navigate = useNavigate();
    const svgRef = useRef(null);
    const hostRef = useRef(null);
    const [active, setActive] = useState(-1);

    const t0 = points[0].time;
    const span = points[points.length - 1].time - t0;
    const x = (p, i) => PAD.left + (span > 0 ? (p.time - t0) / span : i / (points.length - 1)) * INNER_W;
    const y = (score) => PAD.top + (1 - score / 100) * INNER_H;

    // X labels: first and last date, plus the middle one when there is room.
    const labelIdx = [0, points.length - 1];
    if (points.length > 4) labelIdx.splice(1, 0, Math.floor((points.length - 1) / 2));

    const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p, i)} ${y(p.score)}`).join(' ');
    const last = points[points.length - 1];

    function nearest(evt) {
        const box = svgRef.current.getBoundingClientRect();
        const sx = (evt.clientX - box.left) * (W / box.width);
        let best = 0;
        points.forEach((p, i) => {
            if (Math.abs(x(p, i) - sx) < Math.abs(x(points[best], best) - sx)) best = i;
        });
        return best;
    }

    const open = (i) => navigate(`/patient/readings/${points[i].id}`);
    const scale = hostRef.current ? hostRef.current.clientWidth / W : 1;
    const tip = active >= 0 ? points[active] : null;

    return (
        <div className="trend-chart" ref={hostRef}>
            <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img"
                aria-label={`Risk score over time, ${points.length} readings. The table below lists every value.`}>
                <g className="grid">
                    {[0, 25, 75, 100].map((v) => <line key={v} x1={PAD.left} x2={PAD.left + INNER_W} y1={y(v)} y2={y(v)} />)}
                </g>
                <g className="axis">
                    {[0, 25, 50, 75, 100].map((v) => <text key={v} x={PAD.left - 8} y={y(v) + 4} textAnchor="end">{v}</text>)}
                    {labelIdx.map((i, n) => (
                        <text key={i} x={x(points[i], i)} y={H - 8}
                            textAnchor={n === 0 ? 'start' : (n === labelIdx.length - 1 ? 'end' : 'middle')}>{points[i].date}</text>
                    ))}
                </g>
                <g className="threshold">
                    <line x1={PAD.left} x2={PAD.left + INNER_W} y1={y(50)} y2={y(50)} />
                    <text x={PAD.left + 4} y={y(50) - 5}>High risk above 50</text>
                </g>
                <path d={d} className="series-line" />
                {tip && <line className="crosshair" x1={x(tip, active)} x2={x(tip, active)} y1={PAD.top} y2={PAD.top + INNER_H} />}
                {points.map((p, i) => (
                    <circle key={p.id} cx={x(p, i)} cy={y(p.score)} r={i === active ? 6 : 4} className={`series-dot${i === active ? ' active' : ''}`} />
                ))}
                <text x={x(last, points.length - 1) + 10} y={y(last.score) + 4} className="end-label">{last.score}</text>
                <rect
                    x={PAD.left - 10} y={0} width={INNER_W + 20} height={H} fill="transparent" tabIndex={0}
                    style={{ cursor: 'pointer', outline: 'none' }}
                    onPointerMove={(e) => setActive(nearest(e))}
                    onPointerLeave={() => setActive(-1)}
                    onClick={(e) => open(nearest(e))}
                    onFocus={() => setActive(points.length - 1)}
                    onBlur={() => setActive(-1)}
                    onKeyDown={(e) => {
                        if (e.key === 'ArrowLeft' && active > 0) setActive(active - 1);
                        else if (e.key === 'ArrowRight' && active < points.length - 1) setActive(active + 1);
                        else if (e.key === 'Enter' && active >= 0) open(active);
                    }}
                />
            </svg>
            {tip && (
                <div className="trend-tooltip" style={{ left: x(tip, active) * scale, top: y(tip.score) * scale }}>
                    <div><span className="tt-key" />{tip.score}/100 · {tip.score > 50 ? 'High risk' : 'Low risk'}</div>
                    <div>{tip.date} — click to open</div>
                </div>
            )}
        </div>
    );
}
