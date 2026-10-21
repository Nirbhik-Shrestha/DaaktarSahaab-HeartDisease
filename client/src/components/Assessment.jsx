/** Heart check pieces shared by the patient's and the doctor's pages. */
import {
    ASSESSMENT_FIELDS, ASSESSMENT_GROUPS, describeAssessmentValue, isHighRisk, riskPercent,
} from '@shared/assessment.js';

/** The coloured result card with the score meter and contributing factors. */
export function RiskCard({ assessment }) {
    const high = assessment.highRisk;
    const pct = riskPercent(assessment.riskScore);
    return (
        <div className={`risk-card ${high ? 'high-risk' : 'low-risk'}`}>
            <div className="risk-badge-header">
                <span className="risk-icon">{high ? '\u{1F6A8}' : '✅'}</span>
                <div className="risk-title-group">
                    <h2>{high ? 'High Risk of Heart Disease' : 'Low Risk of Heart Disease'}</h2>
                    <p className="risk-subtitle">
                        {high
                            ? 'Please consult a doctor or cardiologist as soon as possible for a comprehensive evaluation.'
                            : 'Your assessment results indicate a low overall heart disease risk.'}
                    </p>
                </div>
            </div>

            <div className="risk-score">
                <div className="risk-score-row">
                    <span className="risk-score-label">Risk score</span>
                    <span className="risk-score-value">{pct}<small>/100</small></span>
                </div>
                <div className="risk-meter" role="img" aria-label={`Risk score ${pct} out of 100`}>
                    <div className="risk-meter-fill" style={{ width: `${Math.max(pct, 2)}%` }} />
                    <div className="risk-meter-threshold" title="Scores above 50 are classed as high risk" />
                </div>
                <p className="risk-score-note">
                    The score is the average vote of the model's decision trees, from 0 (none point to heart disease)
                    to 100 (all do). Scores above 50 are classed as high risk.
                </p>
            </div>

            {assessment.reasons.length > 0 && (
                <div className="reasons-block">
                    <h3>{high ? 'Key Contributing Risk Factors:' : 'Health Factors to Keep in Mind:'}</h3>
                    <ul className="reasons-list">
                        {assessment.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>
                </div>
            )}
        </div>
    );
}

/** "82 · High" style badge for a score, or "Not scored". */
export function RiskBadge({ score }) {
    if (score === null || score === undefined) {
        return <span className="badge badge-muted">Not scored</span>;
    }
    const high = isHighRisk(score);
    return (
        <span className={`badge ${high ? 'badge-danger' : 'badge-success'}`}>
            {riskPercent(score)} &middot; {high ? 'High' : 'Low'}
        </span>
    );
}

/** The 13 submitted values in words. */
export function ValuesList({ values, className = 'detail-list' }) {
    return (
        <ul className={className}>
            {Object.entries(ASSESSMENT_FIELDS).map(([name, field]) => (
                <li key={name}>
                    <span>{field.label}</span>
                    <strong>{describeAssessmentValue(name, values[name])}</strong>
                </li>
            ))}
        </ul>
    );
}

export const isFilled = (value) => value !== '' && value !== null && value !== undefined;

/**
 * The form inputs, grouped with their help text (controlled).
 *
 * @param {object} values  current values as strings, keyed by field name
 * @param {(name, value) => void} onChange
 */
export function AssessmentFields({ values, onChange }) {
    return Object.entries(ASSESSMENT_GROUPS).map(([groupKey, group]) => {
        const fields = Object.entries(ASSESSMENT_FIELDS).filter(([, f]) => f.group === groupKey);
        const done = fields.every(([name]) => isFilled(values[name]));
        return (
            <fieldset key={groupKey} className={`field-group${done ? ' is-done' : ''}`} id={`group-${groupKey}`}>
                <legend>{group.title}</legend>
                <p className="group-intro">{group.intro}</p>

                {fields.map(([name, field]) => {
                    const id = `f-${name}`;
                    const current = values[name] ?? '';
                    // Questions with long help text get the full width in two-column layouts.
                    const wide = field.help.length > 150 ? ' field--wide' : '';
                    return (
                        <div key={name} className={`field${wide}${isFilled(current) ? ' is-filled' : ''}`}>
                            <label htmlFor={id}>
                                {field.label}
                                {field.unit && <> <span className="unit">({field.unit})</span></>}
                            </label>
                            {field.options ? (
                                <select
                                    id={id}
                                    name={name}
                                    required
                                    aria-describedby={`${id}-help`}
                                    value={String(current)}
                                    onChange={(e) => onChange(name, e.target.value)}
                                >
                                    <option value="" disabled>Choose...</option>
                                    {field.options.map(([code, text]) => (
                                        <option key={code} value={String(code)}>{text}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="number"
                                    id={id}
                                    name={name}
                                    min={field.min}
                                    max={field.max}
                                    step={field.step ?? 1}
                                    placeholder={field.placeholder}
                                    required
                                    aria-describedby={`${id}-help`}
                                    value={String(current)}
                                    onChange={(e) => onChange(name, e.target.value)}
                                />
                            )}
                            <p className="hint" id={`${id}-help`}>{field.help}</p>
                        </div>
                    );
                })}
            </fieldset>
        );
    });
}
