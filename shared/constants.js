/** Rules and limits shared by the API and the React app. */

// Every "today", every date and time label, follows the clinic's clock.
export const APP_TIMEZONE = 'Asia/Kathmandu';

// A session is a single sitting; this caps how many 1-hour slots it may hold.
export const MAX_SLOTS_PER_SESSION = 12;

// Each booking is counted as Rs. 2,000 of revenue on the admin dashboard.
export const FEE_PER_APPOINTMENT = 2000;

export const MAX_NOTES_LENGTH = 5000;
export const MAX_CONTACT_MESSAGE_LENGTH = 5000;
export const MIN_PASSWORD_LENGTH = 6;

// Chat
export const CHAT_MAX_LENGTH = 2000;
export const CHAT_PREVIEW_LENGTH = 90;
export const CHAT_PAGE_SIZE = 200;
export const CHAT_UPLOAD_LIMIT = 5 * 1024 * 1024;
export const CHAT_UPLOAD_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
};
export const CHAT_QUICK_REPLY_MAX_LENGTH = 500;
export const CHAT_QUICK_REPLY_LIMIT = 50;

// Sign-up and profile rules, checked in the browser and again on the server.
export const NAME_PATTERN = /^[a-z ,.'-]+$/i;
export const PHONE_PATTERN = /^9[78]\d{8}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_MESSAGE = 'Phone number must be a 10-digit mobile number starting with 97 or 98.';

export const ROLES = ['patient', 'doctor', 'admin'];
