/**
 * Train the heart-disease random forest from scratch and write heart_model.json.
 *
 *   npm run train-model            (from the project root)
 *
 * A JavaScript port of the old patient/train_model.py and its ml/ package:
 * Gini decision trees grown on bootstrap samples, a fresh random subset of
 * features at every node, out-of-bag accuracy, and the same JSON format the
 * app reads (see predict.js). No machine-learning library is used.
 *
 * The random generator differs from Python's, so a retrained model is not
 * byte-identical to the shipped one; its accuracy is in the same range.
 */
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { forestProba } from './predict.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATASET = path.join(here, 'heart_cleveland_upload.csv');
const OUTPUT = path.join(here, 'heart_model.json');
const FEATURES = ['age', 'sex', 'cp', 'trestbps', 'chol', 'fbs', 'restecg',
    'thalach', 'exang', 'oldpeak', 'slope', 'ca', 'thal'];

/** Small seeded PRNG (mulberry32), so training is reproducible. */
function rng(seed) {
    let a = seed >>> 0;
    const next = () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
        random: next,
        int: (n) => Math.floor(next() * n),
        shuffle(list) {
            for (let i = list.length - 1; i > 0; i--) {
                const j = Math.floor(next() * (i + 1));
                [list[i], list[j]] = [list[j], list[i]];
            }
            return list;
        },
        sample(n, k) {
            return this.shuffle([...Array(n).keys()]).slice(0, k);
        },
    };
}

export function loadCsv(file = DATASET) {
    const [header, ...lines] = readFileSync(file, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/);
    const cols = header.split(',');
    const X = [];
    const y = [];
    for (const line of lines) {
        const cells = line.split(',');
        const row = Object.fromEntries(cols.map((c, i) => [c, Number(cells[i])]));
        X.push(FEATURES.map((f) => row[f]));
        y.push(row.target > 0 ? 1 : 0);
    }
    return { X, y };
}

function gini(counts, n) {
    if (!n) return 0;
    let impurity = 1;
    for (const c of counts) {
        if (c) {
            const p = c / n;
            impurity -= p * p;
        }
    }
    return impurity;
}

class DecisionTree {
    constructor({ nClasses, maxFeatures, random, minSamplesSplit = 2, minSamplesLeaf = 1 }) {
        Object.assign(this, { nClasses, maxFeatures, random, minSamplesSplit, minSamplesLeaf });
    }

    fit(X, y) {
        this.X = X;
        this.y = y;
        this.nRoot = X.length;
        this.importances = new Array(X[0].length).fill(0);
        this.root = this.build([...X.keys()]);
        const total = this.importances.reduce((a, b) => a + b, 0);
        if (total > 0) this.importances = this.importances.map((v) => v / total);
        return this;
    }

    counts(indices) {
        const counts = new Array(this.nClasses).fill(0);
        for (const i of indices) counts[this.y[i]]++;
        return counts;
    }

    build(indices) {
        const n = indices.length;
        const counts = this.counts(indices);
        if (n < this.minSamplesSplit || Math.max(...counts) === n) {
            return { p: counts.map((c) => c / n) };
        }
        const featureIds = this.random.sample(this.X[0].length, this.maxFeatures);
        const split = this.bestSplit(indices, counts, n, featureIds);
        if (!split) {
            return { p: counts.map((c) => c / n) };
        }
        const { f, t, gain } = split;
        const left = [];
        const right = [];
        for (const i of indices) (this.X[i][f] <= t ? left : right).push(i);
        this.importances[f] += (n * gain) / this.nRoot;
        return { f, t, l: this.build(left), r: this.build(right) };
    }

    bestSplit(indices, parentCounts, n, featureIds) {
        const parentImp = gini(parentCounts, n);
        let best = null;
        let bestGain = 0;
        for (const f of featureIds) {
            const pairs = indices.map((i) => [this.X[i][f], this.y[i]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
            const left = new Array(this.nClasses).fill(0);
            const right = [...parentCounts];
            for (let k = 0; k < n - 1; k++) {
                const [value, label] = pairs[k];
                left[label]++;
                right[label]--;
                const nextValue = pairs[k + 1][0];
                if (nextValue === value) continue;
                const nLeft = k + 1;
                const nRight = n - nLeft;
                if (nLeft < this.minSamplesLeaf || nRight < this.minSamplesLeaf) continue;
                const weighted = (nLeft * gini(left, nLeft) + nRight * gini(right, nRight)) / n;
                const gain = parentImp - weighted;
                if (gain > bestGain) {
                    bestGain = gain;
                    best = { f, t: (value + nextValue) / 2, gain };
                }
            }
        }
        return best;
    }
}

export function trainForest(X, y, { nEstimators = 100, randomState = 42 } = {}) {
    const n = X.length;
    const nClasses = Math.max(...y) + 1;
    const k = Math.max(1, Math.floor(Math.sqrt(X[0].length)));
    const trees = [];
    const importances = new Array(X[0].length).fill(0);
    const oobVotes = Array.from({ length: n }, () => new Array(nClasses).fill(0));
    const oobCounts = new Array(n).fill(0);

    for (let i = 0; i < nEstimators; i++) {
        const random = rng(randomState * 100003 + i);
        const sample = Array.from({ length: n }, () => random.int(n));
        const tree = new DecisionTree({ nClasses, maxFeatures: k, random })
            .fit(sample.map((j) => X[j]), sample.map((j) => y[j]));
        trees.push(tree.root);
        tree.importances.forEach((v, f) => { importances[f] += v; });

        const inBag = new Set(sample);
        for (let j = 0; j < n; j++) {
            if (inBag.has(j)) continue;
            const p = forestProba({ n_classes: nClasses, trees: [tree.root] }, X[j]);
            oobCounts[j]++;
            p.forEach((v, c) => { oobVotes[j][c] += v; });
        }
    }

    let scored = 0;
    let correct = 0;
    for (let j = 0; j < n; j++) {
        if (!oobCounts[j]) continue;
        scored++;
        const predicted = oobVotes[j][1] > oobVotes[j][0] ? 1 : 0;
        if (predicted === y[j]) correct++;
    }

    return {
        format: 'random-forest/1',
        n_estimators: nEstimators,
        n_classes: nClasses,
        max_features: 'sqrt',
        random_state: randomState,
        feature_names: FEATURES,
        feature_importances: importances.map((v) => v / nEstimators),
        oob_score: scored ? correct / scored : null,
        trees,
    };
}

function main() {
    console.log('Loading dataset...');
    const { X, y } = loadCsv();
    const order = rng(42).shuffle([...X.keys()]);
    const nTest = Math.round(X.length * 0.2);
    const test = order.slice(0, nTest);
    const train = order.slice(nTest);
    console.log(`  ${X.length} rows, ${train.length} training, ${test.length} test`);

    console.log('\nTraining Random Forest (100 trees, from scratch)...');
    const started = Date.now();
    const forest = trainForest(train.map((i) => X[i]), train.map((i) => y[i]));
    console.log(`  done in ${((Date.now() - started) / 1000).toFixed(1)} seconds`);

    let hits = 0;
    const matrix = [[0, 0], [0, 0]];
    for (const i of test) {
        const p = forestProba(forest, X[i]);
        const predicted = p[1] > p[0] ? 1 : 0;
        matrix[y[i]][predicted]++;
        if (predicted === y[i]) hits++;
    }
    console.log(`\nTest accuracy : ${(hits / test.length).toFixed(4)}`);
    console.log(`Out-of-bag    : ${forest.oob_score.toFixed(4)}`);
    console.log('Confusion matrix (rows = actual, columns = predicted):');
    console.log(`  no disease: ${matrix[0].join('  ')}`);
    console.log(`  disease   : ${matrix[1].join('  ')}`);

    if (process.argv.includes('--dry-run')) {
        console.log('\n--dry-run: model not saved.');
        return;
    }
    writeFileSync(OUTPUT, JSON.stringify(forest));
    console.log(`\nSaved ${OUTPUT} (${Math.round(statSync(OUTPUT).size / 1024)} KB).`);
    console.log('Restart the server; readings are re-scored with the new model when they are next saved or shown with no score.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main();
}
