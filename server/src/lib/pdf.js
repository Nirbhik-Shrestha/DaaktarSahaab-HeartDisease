/**
 * One heart check as a printable A4 PDF (pdfkit; replaces the FPDF version).
 * Layout follows the old download: header bar, patient, result panel with
 * the score meter, disclaimer, contributing factors, and the submitted values.
 */
import PDFDocument from 'pdfkit';
import { APP_TIMEZONE } from '../../../shared/constants.js';
import { ASSESSMENT_FIELDS, describeAssessmentValue, riskPercent } from '../../../shared/assessment.js';

const MM = 72 / 25.4;
const mm = (v) => v * MM;

const dateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: APP_TIMEZONE, day: 'numeric', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: APP_TIMEZONE, hour: 'numeric', minute: '2-digit', hour12: true });
const dayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
const dayStamp = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

const stamp = (d) => `${dateFmt.format(d)}, ${timeFmt.format(d)}`;
const dobLabel = (s) => {
    const [y, m, d] = String(s).split('-').map(Number);
    return y ? dayFmt.format(new Date(Date.UTC(y, m - 1, d))) : String(s);
};

export function buildAssessmentPdf({ patient, reading, assessment }) {
    const taken = new Date(reading.takenAt);
    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: mm(18), left: mm(18), right: mm(18), bottom: mm(20) },
        bufferPages: true,
        info: { Title: `Heart Health Assessment - ${patient.name}`, Author: 'Daaktar Sahaab' },
    });
    const left = mm(18);
    const contentW = doc.page.width - mm(36);

    function header() {
        doc.save().rect(0, 0, doc.page.width, mm(4)).fill([0, 137, 123]).restore();
        doc.font('Helvetica-Bold').fontSize(16).fillColor([26, 32, 44]).text('Heart Health Assessment', left, mm(12));
        doc.font('Helvetica').fontSize(10).fillColor([113, 128, 150]).text('Daaktar Sahaab', left, doc.y + 2);
        doc.y += mm(4);
    }
    header();
    doc.on('pageAdded', header);

    function sectionTitle(title) {
        doc.y += mm(3);
        doc.font('Helvetica-Bold').fontSize(12).fillColor([45, 55, 72]).text(title, left, doc.y);
        const y = doc.y + 2;
        doc.save().moveTo(left, y).lineTo(left + contentW, y).lineWidth(0.6).strokeColor([226, 232, 240]).stroke().restore();
        doc.y = y + mm(2.5);
    }

    function keyValue(key, value) {
        const y = doc.y;
        doc.font('Helvetica').fontSize(10).fillColor([113, 128, 150]).text(key, left, y, { width: mm(45) });
        doc.fillColor([26, 32, 44]).text(String(value), left + mm(45), y, { width: contentW - mm(45) });
        doc.y = Math.max(doc.y, y + mm(6));
    }

    // ---- Patient
    sectionTitle('Patient');
    keyValue('Name', patient.name);
    keyValue('Date of birth', dobLabel(patient.dob));
    keyValue('Assessment taken', stamp(taken));
    keyValue('Reference', `Assessment #${reading.number ?? String(reading._id).slice(-6).toUpperCase()}`);

    // ---- Result panel, tinted with a coloured edge like the on-screen card
    sectionTitle('Result');
    const high = assessment.highRisk;
    const pct = riskPercent(assessment.riskScore);
    const tone = high ? [229, 62, 62] : [56, 161, 105];
    const tint = high ? [255, 245, 245] : [240, 255, 244];
    const top = doc.y;
    const panelH = mm(34);
    doc.save().rect(left, top, contentW, panelH).fill(tint).restore();
    doc.save().rect(left, top, mm(2), panelH).fill(tone).restore();

    doc.font('Helvetica-Bold').fontSize(14).fillColor(high ? [197, 48, 48] : [39, 103, 73])
        .text(high ? 'High Risk of Heart Disease' : 'Low Risk of Heart Disease', left + mm(7), top + mm(4.5), { width: mm(110) });
    doc.font('Helvetica-Bold').fontSize(20).fillColor([26, 32, 44])
        .text(String(pct), left + mm(7), top + mm(3), { width: contentW - mm(26), align: 'right' });
    doc.font('Helvetica').fontSize(10).fillColor([113, 128, 150])
        .text('/100', left + contentW - mm(18), top + mm(6), { width: mm(14) });

    // Score meter with the 50-point threshold marked.
    const meterX = left + mm(7);
    const meterY = top + mm(15);
    const meterW = contentW - mm(14);
    doc.save().rect(meterX, meterY, meterW, mm(3)).fill([237, 242, 247]).restore();
    doc.save().rect(meterX, meterY, Math.max((meterW * pct) / 100, mm(1)), mm(3)).fill(tone).restore();
    doc.save().moveTo(meterX + meterW / 2, meterY - mm(1.2)).lineTo(meterX + meterW / 2, meterY + mm(4.2))
        .lineWidth(1.1).strokeColor([74, 85, 104]).stroke().restore();

    doc.font('Helvetica').fontSize(9).fillColor([74, 85, 104]).text(
        `Risk score ${pct} out of 100: the average vote of the model's decision trees. `
        + 'Scores above 50 (marked on the bar) are classed as high risk.',
        meterX, meterY + mm(6), { width: meterW },
    );
    doc.y = top + panelH + mm(3);

    // Disclaimer, straight under the result so it is never separated from it.
    const disclaimer = 'Medical disclaimer: this result comes from a statistical model and is not a diagnosis. '
        + 'It is not a substitute for professional medical advice, diagnosis, or treatment. '
        + 'Please discuss it with a qualified doctor or cardiologist.';
    doc.font('Helvetica').fontSize(8.5);
    const discH = doc.heightOfString(disclaimer, { width: contentW - mm(4) }) + mm(3);
    const discTop = doc.y;
    doc.save().rect(left, discTop, contentW, discH).fill([255, 248, 230]).restore();
    doc.fillColor([93, 109, 126]).text(disclaimer, left + mm(2), discTop + mm(1.5), { width: contentW - mm(4) });
    doc.y = discTop + discH + mm(3);

    if (assessment.reasons.length) {
        doc.font('Helvetica-Bold').fontSize(10).fillColor([45, 55, 72])
            .text(high ? 'Key contributing risk factors' : 'Health factors to keep in mind', left, doc.y);
        doc.y += mm(1);
        doc.font('Helvetica').fontSize(10).fillColor([74, 85, 104]);
        for (const reason of assessment.reasons) {
            const y = doc.y;
            doc.text('•', left, y, { width: mm(5) });
            doc.text(reason, left + mm(5), y, { width: contentW - mm(5) });
            doc.y += 1;
        }
    }

    // ---- Submitted values
    sectionTitle('Submitted values');
    const col = contentW * 0.55;
    const rowH = mm(6);
    let y = doc.y;
    doc.save().rect(left, y, contentW, mm(7)).fill([0, 137, 123]).restore();
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff')
        .text('Measure', left + mm(2), y + mm(2), { width: col })
        .text('Value', left + col + mm(2), y + mm(2), { width: contentW - col });
    y += mm(7);
    doc.font('Helvetica').fontSize(9.5);
    let shade = false;
    for (const [name, field] of Object.entries(ASSESSMENT_FIELDS)) {
        if (y + rowH > doc.page.height - doc.page.margins.bottom) {
            doc.addPage();
            y = doc.y;
        }
        doc.save().rect(left, y, contentW, rowH).fill(shade ? [247, 250, 252] : [255, 255, 255]).restore();
        doc.save().moveTo(left, y + rowH).lineTo(left + contentW, y + rowH).lineWidth(0.5).strokeColor([226, 232, 240]).stroke().restore();
        doc.fillColor([26, 32, 44])
            .text(field.label, left + mm(2), y + mm(1.6), { width: col - mm(2), lineBreak: false })
            .text(describeAssessmentValue(name, reading[name]), left + col + mm(2), y + mm(1.6), { width: contentW - col - mm(2), lineBreak: false });
        y += rowH;
        shade = !shade;
    }

    // ---- Footer on every page: when it was generated, and "Page x of y".
    const generated = `Generated ${stamp(new Date())}`;
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const bottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0; // writing below the margin would add a page
        const fy = doc.page.height - mm(14);
        doc.font('Helvetica').fontSize(8).fillColor([113, 128, 150])
            .text(generated, left, fy, { width: contentW / 2, lineBreak: false })
            .text(`Page ${i + 1} of ${range.count}`, left + contentW / 2, fy, { width: contentW / 2, align: 'right', lineBreak: false });
        doc.page.margins.bottom = bottom;
    }
    doc.end();

    const ref = reading.number ?? String(reading._id).slice(-6);
    return { filename: `heart-assessment-${dayStamp.format(taken)}-${ref}.pdf`, stream: doc };
}
