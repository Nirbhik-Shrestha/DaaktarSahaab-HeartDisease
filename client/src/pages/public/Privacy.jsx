import { Link } from 'react-router';
import { Page, PageHero } from '../../components/Layout.jsx';
import { usePageTitle } from '../../lib/hooks.js';

export default function Privacy() {
    usePageTitle('Privacy Policy - DaaktarSahab');
    return (
        <Page>
            <PageHero eyebrow="Legal" title="Privacy Policy">
                What information DaaktarSahab collects, why, who can see it, and the choices you have.
            </PageHero>

            <main className="page-body">
            <article className="panel prose">
            <span className="updated">Last updated 25 September 2026</span>
            
            <h2 id="summary">Summary</h2>
            <ul>
                <li>We collect the details you give us to run your account, your heart checks and your appointments.</li>
                <li>Your heart checks are private. A doctor only sees one if you share it with an appointment with that doctor.</li>
                <li>We do not sell your information or use it for advertising.</li>
                <li>You can delete your heart checks yourself, and ask us to delete your account.</li>
            </ul>
            
            <h2 id="collect">1. Information we collect</h2>
            <h3>Account details</h3>
            <p>When you create a patient account we store your name, email address, mobile number, address and date of birth, and your password. Your password is stored only as a secure hash, never in readable form.</p>
            
            <h3>Heart checks</h3>
            <p>When you take a heart check we store the 13 values you enter (such as age, blood pressure, cholesterol and test results), the date you took it, and the risk score our model calculates from them.</p>
            
            <h3>Appointments</h3>
            <p>When you book, we store which session and time slot you chose. After your visit, the doctor may record whether it took place and add consultation notes, which you can read on your appointments page.</p>
            
            <h3>Messages to us</h3>
            <p>If you use the Contact page we store your name, email address, subject and message so we can reply.</p>
            
            <h3>Doctors</h3>
            <p>For doctors registered on the platform we store their name, email address, phone number, practice address, Nepal Medical Council registration number and specialty. Patients can see a doctor's name, specialty, email address, practice address and phone number.</p>
            
            <h2 id="use">2. How we use it</h2>
            <ul>
                <li>To run your account and let you sign in, including resetting your password if you forget it.</li>
                <li>To calculate your heart risk score and show your history and trend. The score is calculated on our own server; your values are not sent to any outside service.</li>
                <li>To book and cancel appointments, and to show you your doctor's notes.</li>
                <li>To answer messages you send us.</li>
            </ul>
            <p>We do not use your information for advertising, and we do not sell or rent it to anyone.</p>
            
            <h2 id="who">3. Who can see your information</h2>
            <ul>
                <li><strong>You</strong> can see everything in your account.</li>
                <li><strong>Doctors</strong> you book with can see your name, email address, mobile number, address and date of birth, and the details of your appointments with them. They can only see a heart check if you share it with one of those appointments, and you can stop sharing at any time.</li>
                <li><strong>Our administrators</strong> can see patient and doctor accounts and appointments in order to run the service.</li>
            </ul>
            <p>We may disclose information if the law requires us to.</p>
            
            <h2 id="cookies">4. Cookies and third parties</h2>
            <p>We use one cookie: a session cookie that keeps you signed in while you use the site. It is removed when you sign out or close your browser. We do not use advertising or analytics cookies.</p>
            
            <h2 id="keep">5. How long we keep it</h2>
            <p>We keep your account details, heart checks and appointment history for as long as your account exists. A heart check you delete is removed straight away. A cancelled appointment is removed and its time slot is released.</p>
            
            <h2 id="rights">6. Your choices</h2>
            <ul>
                <li><strong>Update</strong> your contact details at any time on your profile page.</li>
                <li><strong>Delete</strong> any heart check from your prediction history.</li>
                <li><strong>Stop sharing</strong> a heart check with a doctor from your appointments page.</li>
                <li><strong>Close your account</strong> by <Link to="/contact">contacting us</Link>. We will then delete your account together with your heart checks and appointments.</li>
            </ul>
            
            <h2 id="security">7. Security</h2>
            <p>We take reasonable steps to protect your information, including storing passwords as secure hashes and making sure each person can only open their own records. No online service can be completely secure, so please keep your password private and sign out on shared computers.</p>
            
            <h2 id="children">8. Children</h2>
            <p>The service is intended for people aged 13 and over. Anyone under 18 should use it with the permission and supervision of a parent or guardian, as set out in our <Link to="/terms">Terms of Use</Link>.</p>
            
            <h2 id="changes">9. Changes and contact</h2>
            <p>If we change this policy we will update the date at the top of this page. For any question about your information, or to ask us to delete your account, email support@daaktarsahab.com or use our <Link to="/contact">Contact page</Link>.</p>
                </article>
            </main>
        </Page>
    );
}
