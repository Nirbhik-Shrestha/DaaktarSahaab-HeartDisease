/**
 * Scoring readings with the trained random forest (heart_model.json).
 *
 * A JavaScript port of the old patient/predict.py. The model file is the one
 * the from-scratch Python trainer wrote ("random-forest/1" format); each tree
 * is a nested object: leaves hold {p: [P(no disease), P(disease)]}, splits hold
 * {f: feature index, t: threshold, l: left, r: right}. The forest's
 * probability is the average of the trees' leaf probabilities, exactly as
 * before, so stored scores and new scores agree.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
export const MODEL_FILE = process.env.MODEL_FILE || path.join(here, 'heart_model.json');

let model = null;

/** The model, loaded once on first use. */
export function loadModel() {
    if (!model) {
        const payload = JSON.parse(readFileSync(MODEL_FILE, 'utf8'));
        if (!Array.isArray(payload.trees) || !payload.trees.length) {
            throw new Error(`${MODEL_FILE} has no trees. Run "npm run train-model" first.`);
        }
        model = payload;
    }
    return model;
}

/** Walk one serialised tree to its leaf. */
function leafProba(node, row) {
    while (!node.p) {
        node = row[node.f] <= node.t ? node.l : node.r;
    }
    return node.p;
}

export function forestProba(forest, row) {
    const totals = new Array(forest.n_classes).fill(0);
    for (const root of forest.trees) {
        const p = leafProba(root, row);
        for (let c = 0; c < totals.length; c++) {
            totals[c] += p[c];
        }
    }
    return totals.map((t) => t / forest.trees.length);
}

/**
 * The reading as the model's feature vector.
 *
 * The form and stored readings code thal as 1 = normal, 2 = fixed defect,
 * 3 = reversible defect, but the training set (heart_cleveland_upload.csv)
 * codes it 0 / 1 / 2. Shift it here so "normal" is not read as a defect.
 */
function features(forest, reading) {
    return forest.feature_names.map((name) => (name === 'thal' ? Number(reading.thal) - 1 : Number(reading[name])));
}

/** Plain-language factors shown under the result (same rules as predict.py). */
export function getReasoning(d) {
    const reasons = [];
    if (d.trestbps > 130) reasons.push('High resting blood pressure (above 130 mm Hg)');
    if (d.chol > 240) reasons.push('High serum cholesterol (above 240 mg/dl)');
    if (d.fbs === 1) reasons.push('High fasting blood sugar (above 120 mg/dl)');
    if (d.thalach < 120) reasons.push('Low maximum heart rate achieved (below 120 bpm)');
    if (d.oldpeak > 2) reasons.push('Significant ST depression induced by exercise (> 2.0)');
    if (d.cp === 2 || d.cp === 3) reasons.push('Type of chest pain suggests potential heart condition');
    if (d.exang === 1) reasons.push('Exercise-induced angina (chest pain during exertion)');
    if (d.slope === 2) reasons.push('Flat or downsloping ST segment during peak exercise');
    if (d.ca > 0) reasons.push('Presence of major blood vessels colored by fluoroscopy');
    if (d.thal === 2) reasons.push('Presence of fixed defect in thalassemia test');
    return reasons;
}

/**
 * Score one reading.
 *
 * @returns {{prediction: 0|1, riskScore: number, reasons: string[]}}
 *   riskScore is the forest's probability of heart disease (0-1, 4 decimals);
 *   prediction is 1 exactly when riskScore > 0.5.
 */
export function scoreReading(reading) {
    const forest = loadModel();
    const values = {};
    for (const name of forest.feature_names) {
        values[name] = Number(reading[name]);
    }
    const proba = forestProba(forest, features(forest, values));
    return {
        // Same tie-break as the Python forest: class 0 wins a 50/50 vote.
        prediction: proba[1] > proba[0] ? 1 : 0,
        riskScore: Math.round(proba[1] * 10000) / 10000,
        reasons: getReasoning(values),
    };
}
