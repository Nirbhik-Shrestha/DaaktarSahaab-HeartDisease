import { Outlet, Route, Routes } from 'react-router';
import { RequireRole } from './components/Layout.jsx';

import Home from './pages/public/Home.jsx';
import About from './pages/public/About.jsx';
import Contact from './pages/public/Contact.jsx';
import Terms from './pages/public/Terms.jsx';
import Privacy from './pages/public/Privacy.jsx';
import NotFound from './pages/public/NotFound.jsx';

import PatientLogin from './pages/auth/PatientLogin.jsx';
import StaffLogin from './pages/auth/StaffLogin.jsx';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';

import PatientDashboard from './pages/patient/Dashboard.jsx';
import PatientDoctors from './pages/patient/Doctors.jsx';
import PatientSchedule from './pages/patient/Schedule.jsx';
import Booking from './pages/patient/Booking.jsx';
import BookingComplete from './pages/patient/BookingComplete.jsx';
import PatientAppointments from './pages/patient/Appointments.jsx';
import HeartCheck from './pages/patient/HeartCheck.jsx';
import EditReading from './pages/patient/EditReading.jsx';
import Result from './pages/patient/Result.jsx';
import History from './pages/patient/History.jsx';
import PatientProfile from './pages/patient/Profile.jsx';
import PatientMessages from './pages/patient/Messages.jsx';

import DoctorDashboard from './pages/doctor/Dashboard.jsx';
import DoctorAppointments from './pages/doctor/Appointments.jsx';
import Consultation from './pages/doctor/Consultation.jsx';
import DoctorPatients from './pages/doctor/Patients.jsx';
import DoctorSchedule from './pages/doctor/Schedule.jsx';
import SharedAssessment from './pages/doctor/SharedAssessment.jsx';
import DoctorMessages from './pages/doctor/Messages.jsx';
import DoctorProfile from './pages/doctor/Profile.jsx';

import AdminDashboard from './pages/admin/Dashboard.jsx';
import AdminDoctors from './pages/admin/Doctors.jsx';
import AddDoctor from './pages/admin/AddDoctor.jsx';
import AdminPatients from './pages/admin/Patients.jsx';
import AdminSessions from './pages/admin/Sessions.jsx';
import AddSession from './pages/admin/AddSession.jsx';
import AdminAppointments from './pages/admin/Appointments.jsx';
import AdminLogs from './pages/admin/Logs.jsx';

const guard = (role) => <RequireRole role={role}><Outlet /></RequireRole>;

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />

            <Route path="/patient/login" element={<PatientLogin />} />
            <Route path="/patient/forgot-password" element={<ForgotPassword role="patient" />} />
            <Route path="/doctor/login" element={<StaffLogin role="doctor" />} />
            <Route path="/doctor/forgot-password" element={<ForgotPassword role="doctor" />} />
            <Route path="/admin/login" element={<StaffLogin role="admin" />} />
            <Route path="/admin/forgot-password" element={<ForgotPassword role="admin" />} />

            <Route path="/patient" element={guard('patient')}>
                <Route index element={<PatientDashboard />} />
                <Route path="doctors" element={<PatientDoctors />} />
                <Route path="schedule" element={<PatientSchedule />} />
                <Route path="booking/:id" element={<Booking />} />
                <Route path="booking-complete" element={<BookingComplete />} />
                <Route path="appointments" element={<PatientAppointments />} />
                <Route path="heart-check" element={<HeartCheck />} />
                <Route path="readings/:id" element={<Result />} />
                <Route path="readings/:id/edit" element={<EditReading />} />
                <Route path="history" element={<History />} />
                <Route path="profile" element={<PatientProfile />} />
                <Route path="messages" element={<PatientMessages />} />
            </Route>

            <Route path="/doctor" element={guard('doctor')}>
                <Route index element={<DoctorDashboard />} />
                <Route path="appointments" element={<DoctorAppointments />} />
                <Route path="appointments/:id" element={<Consultation />} />
                <Route path="appointments/:id/assessment" element={<SharedAssessment source="appointment" />} />
                <Route path="chat-assessments/:id" element={<SharedAssessment source="chat" />} />
                <Route path="patients" element={<DoctorPatients />} />
                <Route path="schedule" element={<DoctorSchedule />} />
                <Route path="messages" element={<DoctorMessages />} />
                <Route path="profile" element={<DoctorProfile />} />
            </Route>

            <Route path="/admin" element={guard('admin')}>
                <Route index element={<AdminDashboard />} />
                <Route path="doctors" element={<AdminDoctors />} />
                <Route path="doctors/new" element={<AddDoctor />} />
                <Route path="patients" element={<AdminPatients />} />
                <Route path="sessions" element={<AdminSessions />} />
                <Route path="sessions/new" element={<AddSession />} />
                <Route path="appointments" element={<AdminAppointments />} />
                <Route path="logs" element={<AdminLogs />} />
            </Route>

            <Route path="*" element={<NotFound />} />
        </Routes>
    );
}
