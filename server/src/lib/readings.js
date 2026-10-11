/**
 * Heart check readings: scoring, and the shape the pages receive.
 *
 * Scores are computed in-process (ml/predict.js) when a reading is saved, so
 * the history chart has them straight away. A reading with no score (one
 * migrated from MySQL before it was scored, or saved while the model file was
 * missing) is scored the next time it is shown.
 */
import { Reading } from '../models/index.js';
import { scoreReading } from '../ml/predict.js';
import { ASSESSMENT_FIELD_NAMES, isHighRisk } from '../../../shared/assessment.js';

/** The score for a set of values, or null when the model cannot be run. */
export function safeScore(values) {
    try {
        return scoreReading(values);
    } catch (err) {
        console.error('Could not score reading:', err.message);
        return null;
    }
}

/** Fill in missing risk scores, saving them. Mutates and returns the lean docs. */
export async function ensureRiskScores(readings) {
    for (const reading of readings) {
        if (reading.riskScore === null || reading.riskScore === undefined) {
            const result = safeScore(reading);
            if (result) {
                reading.riskScore = result.riskScore;
                await Reading.updateOne({ _id: reading._id }, { $set: { riskScore: result.riskScore } });
            } else {
                reading.riskScore = null;
            }
        }
    }
    return readings;
}

/** The 13 values of a reading. */
export function readingValues(reading) {
    return Object.fromEntries(ASSESSMENT_FIELD_NAMES.map((name) => [name, reading[name]]));
}

/** Summary row: for history tables, share pickers and chat cards. */
export function readingSummary(reading) {
    return {
        id: String(reading._id),
        number: reading.number ?? null,
        takenAt: reading.takenAt,
        riskScore: reading.riskScore ?? null,
        shared: Boolean(reading.appointment),
        values: readingValues(reading),
    };
}

/**
 * Everything needed to present one reading's result card.
 *
 * The stored score wins, so the result page agrees with the history chart;
 * the reasons are worked out fresh from the values.
 */
export async function assessReading(reading) {
    const result = safeScore(reading);
    if (!result) return null;
    if (reading.riskScore === null || reading.riskScore === undefined) {
        reading.riskScore = result.riskScore;
        await Reading.updateOne({ _id: reading._id }, { $set: { riskScore: result.riskScore } });
    }
    return {
        riskScore: reading.riskScore,
        highRisk: isHighRisk(reading.riskScore),
        reasons: result.reasons,
    };
}

/** The full reading plus its assessment, for result pages. */
export async function readingDetail(reading) {
    return {
        ...readingSummary(reading),
        assessment: await assessReading(reading),
    };
}
