/**
 * The 13 clinical measures behind a heart assessment, defined once.
 *
 * The new-assessment form, the edit form, server-side validation, the
 * doctor's view and the PDF all read these definitions, so a code (say,
 * thal 1 = normal) cannot mean one thing on one page and another elsewhere.
 * Imported by both the API (server/) and the React app (client/).
 */

// Where each group of values comes from; shown as section intros on the form.
export const ASSESSMENT_GROUPS = {
    basic: {
        title: 'About you',
        intro: 'You can answer these yourself.',
    },
    blood: {
        title: 'Blood pressure and blood tests',
        intro: 'From a blood pressure check and routine blood tests (lipid profile and fasting blood sugar). Recent lab reports list these values.',
    },
    ecg: {
        title: 'ECG and exercise stress test',
        intro: 'From a resting ECG and an exercise stress test (treadmill test, "TMT"). The values are in the written report that comes with the test.',
    },
    imaging: {
        title: 'Heart imaging tests',
        intro: 'From a coronary angiogram and a thallium (nuclear) stress scan. These are hospital tests a cardiologist orders.',
    },
};

// Options are [code, text] pairs so their order is explicit.
export const ASSESSMENT_FIELDS = {
    age: {
        group: 'basic', label: 'Age', unit: 'years',
        min: 1, max: 120, placeholder: 'e.g. 45',
        help: 'Your age in whole years.',
    },
    sex: {
        group: 'basic', label: 'Sex',
        options: [[0, 'Female'], [1, 'Male']],
        help: 'Sex recorded at birth. Heart disease risk differs between men and women.',
    },
    cp: {
        group: 'basic', label: 'Chest pain type',
        options: [
            [0, 'Typical angina'],
            [1, 'Atypical angina'],
            [2, 'Non-anginal pain'],
            [3, 'No chest pain (asymptomatic)'],
        ],
        help: 'Typical angina: pressure or tightness in the chest that comes on with exercise or stress and eases with rest. '
            + 'Atypical angina: chest pain with only some of those features. '
            + 'Non-anginal pain: chest pain that does not seem to come from the heart (for example sharp pain when breathing or moving). '
            + 'If a doctor has already assessed your chest pain, use the type in their notes.',
    },
    trestbps: {
        group: 'blood', label: 'Resting blood pressure', unit: 'mm Hg',
        min: 60, max: 250, placeholder: 'e.g. 120',
        help: 'The top (systolic) number of a blood pressure reading taken while resting. For "120/80", enter 120. Below 120 is normal.',
    },
    chol: {
        group: 'blood', label: 'Total cholesterol', unit: 'mg/dl',
        min: 100, max: 700, placeholder: 'e.g. 190',
        help: 'Total (serum) cholesterol from a lipid profile blood test. Below 200 mg/dl is desirable. If your report uses mmol/L, multiply by 38.67.',
    },
    fbs: {
        group: 'blood', label: 'Fasting blood sugar above 120 mg/dl?',
        options: [[0, 'No (120 mg/dl or lower)'], [1, 'Yes (above 120 mg/dl)']],
        help: 'From a fasting blood sugar (FBS) test taken after at least 8 hours without food. 120 mg/dl is about 6.7 mmol/L.',
    },
    restecg: {
        group: 'ecg', label: 'Resting ECG result',
        options: [[0, 'Normal'], [1, 'ST-T wave abnormality'], [2, 'Left ventricular hypertrophy']],
        help: 'The conclusion printed on a resting ECG report. "LVH" means left ventricular hypertrophy.',
    },
    thalach: {
        group: 'ecg', label: 'Maximum heart rate reached', unit: 'beats per minute',
        min: 50, max: 230, placeholder: 'e.g. 150',
        help: 'The highest heart rate reached during the exercise stress test. A rough expected maximum is 220 minus your age.',
    },
    exang: {
        group: 'ecg', label: 'Chest pain during exercise?',
        options: [[0, 'No'], [1, 'Yes']],
        help: 'Whether the stress test brought on chest pain (exercise-induced angina). The report usually says so.',
    },
    oldpeak: {
        group: 'ecg', label: 'ST depression', unit: 'mm',
        min: 0, max: 10, step: 0.1, placeholder: 'e.g. 1.4',
        help: 'How far the ST segment dropped during exercise compared with rest, from the stress test report (for example "1.5 mm ST depression"). Enter 0 if there was none.',
    },
    slope: {
        group: 'ecg', label: 'ST segment slope at peak exercise',
        options: [[0, 'Upsloping'], [1, 'Flat'], [2, 'Downsloping']],
        help: 'The shape of the ST segment at peak exercise, from the stress test report.',
    },
    ca: {
        group: 'imaging', label: 'Major vessels seen on angiogram',
        options: [[0, '0'], [1, '1'], [2, '2'], [3, '3']],
        help: 'The number of major heart arteries (0 to 3) coloured by dye on a coronary angiogram (fluoroscopy), as stated in the report.',
    },
    thal: {
        group: 'imaging', label: 'Thallium stress scan result',
        options: [[1, 'Normal'], [2, 'Fixed defect'], [3, 'Reversible defect']],
        help: 'From a thallium (nuclear) stress scan of blood flow to the heart muscle. '
            + 'A fixed defect is an area with poor blood flow at rest and during exercise; a reversible defect has poor flow only during exercise. '
            + 'This is a scan result, not the blood disorder thalassemia.',
    },
};

export const ASSESSMENT_FIELD_NAMES = Object.keys(ASSESSMENT_FIELDS);

const NUMERIC = /^-?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/;

/**
 * Validate a submitted assessment.
 *
 * @returns {{values: object, errors: string[]}} clean values keyed by field, and error messages
 */
export function validateAssessment(input) {
    const values = {};
    const errors = [];

    for (const [name, field] of Object.entries(ASSESSMENT_FIELDS)) {
        const raw = input && input[name] !== undefined && input[name] !== null ? String(input[name]).trim() : '';

        if (raw === '') {
            errors.push(`${field.label} is required.`);
            continue;
        }
        if (!NUMERIC.test(raw)) {
            errors.push(`${field.label} must be a number.`);
            continue;
        }

        if (field.options) {
            const code = Number(raw);
            if (!Number.isInteger(code) || String(code) !== raw || !field.options.some(([c]) => c === code)) {
                errors.push(`Please choose a valid option for ${field.label}.`);
                continue;
            }
            values[name] = code;
            continue;
        }

        let number = Number(raw);
        if (name === 'oldpeak') {
            number = Math.round(number * 10) / 10;
        }
        if (name !== 'oldpeak' && !Number.isInteger(number)) {
            errors.push(`${field.label} must be a whole number.`);
        } else if (number < field.min || number > field.max) {
            errors.push(`${field.label} must be between ${field.min} and ${field.max} ${field.unit}.`);
        } else {
            values[name] = number;
        }
    }

    return { values, errors };
}

/** A stored value in words, e.g. describeAssessmentValue('thal', 1) = "Normal". */
export function describeAssessmentValue(name, value) {
    const field = ASSESSMENT_FIELDS[name];
    if (field.options) {
        const option = field.options.find(([code]) => code === Number(value));
        return option ? option[1] : String(value);
    }
    const text = name === 'oldpeak' ? Number(value).toFixed(1) : String(Math.trunc(Number(value)));
    return name === 'age' ? text : `${text} ${field.unit}`;
}

/** True when a score means "high risk"; the forest's majority vote. */
export function isHighRisk(score) {
    return Number(score) > 0.5;
}

/** The score as a whole percentage, for display. */
export function riskPercent(score) {
    return Math.round(Number(score) * 100);
}
