/*
 * Live chat on the Messages pages (patient and doctor). A React port of the
 * old chat.js.
 *
 * "Live" is plain polling. The open thread asks for messages newer than the
 * last one it has: every 3 seconds while the conversation is active,
 * stretching to 10 and then 30 seconds once nothing has happened for a
 * while, and back to 3 as soon as a message arrives or the user types. The
 * conversation list refreshes every 10 seconds (30 when idle).
 *
 * While the tab is hidden the open thread is not polled at all, so nothing is
 * marked read (or shown as "Seen" to the other side) while the user is away.
 * Only the list keeps checking, every 30 seconds, to put the unread count in
 * the tab title and play the optional sound.
 *
 * Message text is rendered by React as text, never as HTML.
 *
 * The polling loop runs on timers, so its working state lives in a ref (`r`)
 * rather than in React state, which the timers would only see stale copies of.
 */
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../lib/api.js';
import {
    chatDayLabel, chatTimeLabel, dayOf, stampDate, stampTime, visitLabel,
} from '../lib/format.js';
import { isHighRisk, riskPercent } from '@shared/assessment.js';
import { CHAT_MAX_LENGTH, CHAT_UPLOAD_LIMIT, CHAT_UPLOAD_TYPES } from '@shared/constants.js';

// [idle for less than (ms), poll the open thread every (ms)]
const THREAD_DELAYS = [[60000, 3000], [300000, 10000], [Infinity, 30000]];
const LIST_ACTIVE_MS = 10000;
const LIST_IDLE_MS = 30000;
const LIST_IDLE_AFTER_MS = 60000;
// Closer than this to the bottom counts as "following the conversation".
const STICK_PX = 80;
const UPLOAD_TYPES = Object.keys(CHAT_UPLOAD_TYPES);
const STATUS_LABELS = { completed: 'Completed', no_show: 'Missed', booked: 'Not recorded' };

const isPhone = () => window.matchMedia('(max-width: 760px)').matches;
const sizeLabel = (bytes) => (bytes >= 1048576 ? `${Math.round(bytes / 104857.6) / 10} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

// Storage can be missing or throw (private mode, blocked site data); the
// chat must work the same without it.
function readStore(kind, key) {
    try {
        return window[kind] ? window[kind].getItem(key) : null;
    } catch {
        return null;
    }
}
function writeStore(kind, key, value) {
    try {
        if (!window[kind]) return;
        if (value) window[kind].setItem(key, value);
        else window[kind].removeItem(key);
    } catch { /* not saved; nothing else to do */ }
}

/** Add messages, skipping ones already shown, keeping id order. */
function merge(current, incoming) {
    const seen = new Set(current.map((m) => m.id));
    const added = incoming.filter((m) => !seen.has(m.id));
    if (!added.length) return { list: current, added };
    const list = [...current, ...added].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return { list, added };
}

export default function Chat({ role, userKey, initialConversations, openId: requested, baseTitle, head }) {
    const navigate = useNavigate();
    const [conversations, setConversations] = useState(initialConversations);
    const [openId, setOpenId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [hasOlder, setHasOlder] = useState(false);
    const [firstLoaded, setFirstLoaded] = useState(false);
    const [olderBusy, setOlderBusy] = useState(false);
    const [seen, setSeen] = useState(null);
    const [context, setContext] = useState(null);
    const [filter, setFilter] = useState({ query: '', unreadOnly: false });
    const [input, setInput] = useState('');
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState(null); // {text, error}
    const [retry, setRetry] = useState(false);
    const [sending, setSending] = useState(false);
    const [stopped, setStopped] = useState(false);
    const [jump, setJump] = useState(false);
    const [pop, setPop] = useState(null); // {mode, state: 'loading'|'ready'|'error', error, readings}
    const [replies, setReplies] = useState(null);
    const [soundOn, setSoundOn] = useState(() => readStore('localStorage', 'chatSound') === 'on');

    const rootRef = useRef(null);
    const boxRef = useRef(null);
    const inputRef = useRef(null);
    const popRef = useRef(null);
    const triggerRef = useRef(null);
    const scrollMode = useRef(null); // 'bottom' | {keep: distance from bottom}
    const messagesRef = useRef([]);
    const r = useRef({
        openId: null, lastId: null, generation: 0,
        threadTimer: null, listTimer: null, threadDue: 0, listDue: 0,
        threadBusy: false, listBusy: false, sending: false, stopped: false,
        lastActivity: Date.now(), conversations: initialConversations, lastUnreadTotal: null,
        audio: null, soundOn: false, failed: null, pendingFile: null, drafts: {},
    }).current;
    r.soundOn = soundOn;

    /* ---------- Drafts: sessionStorage, so they survive a refresh but not closing the tab ---------- */
    const draftKey = (cid) => `chatDraft:${userKey}:${cid}`;
    const getDraft = (cid) => readStore('sessionStorage', draftKey(cid)) ?? r.drafts[cid] ?? '';
    const setDraft = (cid, text) => {
        r.drafts[cid] = text;
        writeStore('sessionStorage', draftKey(cid), text);
    };

    /* ---------- Errors ---------- */
    function handleError(err) {
        if (err.status === 401) {
            r.stopped = true;
            setStopped(true);
            clearTimeout(r.threadTimer);
            clearTimeout(r.listTimer);
            setRetry(false);
            setStatus({ text: 'Your session has ended. Please log in again.', error: true });
            return;
        }
        setStatus({ text: err.status ? err.message : 'Connection problem. Retrying...', error: true });
    }

    /* ---------- Activity and polling speed ---------- */
    function threadDelay() {
        const idle = Date.now() - r.lastActivity;
        return THREAD_DELAYS.find(([limit]) => idle < limit)[1];
    }
    const listDelay = () => (document.hidden || Date.now() - r.lastActivity >= LIST_IDLE_AFTER_MS ? LIST_IDLE_MS : LIST_ACTIVE_MS);

    function scheduleThread(delay) {
        clearTimeout(r.threadTimer);
        r.threadDue = delay;
        r.threadTimer = setTimeout(pollThread, delay);
    }
    function scheduleList(delay) {
        clearTimeout(r.listTimer);
        r.listDue = delay;
        r.listTimer = setTimeout(refreshList, delay);
    }

    /** The user did something: poll fast again straight away if we had slowed down. */
    function noteActivity() {
        r.lastActivity = Date.now();
        if (r.stopped || document.hidden) return;
        if (r.openId && r.threadDue > threadDelay()) pollThread();
        if (r.listDue > listDelay()) refreshList();
    }

    /* ---------- Unread count: header badge, tab title, sound ---------- */
    function updateUnread() {
        // A thread on screen is marked read by its next poll.
        const total = r.conversations.reduce((sum, c) => sum + (c.id === r.openId && !document.hidden ? 0 : c.unread), 0);
        document.title = total ? `(${total}) ${baseTitle}` : baseTitle;
        document.dispatchEvent(new CustomEvent('chat:unread', { detail: total }));
        if (r.lastUnreadTotal !== null && total > r.lastUnreadTotal) chime();
        r.lastUnreadTotal = total;
    }

    // Browsers only allow sound after the user has interacted with the page.
    function unlockAudio() {
        if (!r.soundOn) return;
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx && !r.audio) r.audio = new Ctx();
            if (r.audio && r.audio.state === 'suspended') r.audio.resume();
        } catch {
            r.audio = null;
        }
    }

    /** Two soft, short sine notes. Generated, so there is no sound file to load. */
    function chime() {
        const audio = r.audio;
        if (!r.soundOn || !audio || audio.state !== 'running') return;
        const now = audio.currentTime;
        [[660, 0], [880, 0.13]].forEach(([freq, offset]) => {
            const osc = audio.createOscillator();
            const gain = audio.createGain();
            const start = now + offset;
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(0.05, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
            osc.connect(gain);
            gain.connect(audio.destination);
            osc.start(start);
            osc.stop(start + 0.4);
        });
    }

    /* ---------- Conversation list ---------- */
    const findConversation = (id) => r.conversations.find((c) => c.id === id) || null;

    function refreshList() {
        if (r.stopped || r.listBusy) return;
        clearTimeout(r.listTimer);
        r.listBusy = true;
        api.get('/chat/conversations').then((data) => {
            r.conversations = data.conversations || [];
            setConversations(r.conversations);
            if (r.openId && !findConversation(r.openId)) closeThread();
            updateUnread();
            // Something new in the open thread: fetch it now rather than at the
            // next (possibly slowed-down) thread poll.
            const open = findConversation(r.openId);
            if (open && open.unread > 0 && !document.hidden) {
                r.lastActivity = Date.now();
                pollThread();
            }
        }).catch(handleError).finally(() => {
            r.listBusy = false;
            if (!r.stopped) scheduleList(listDelay());
        });
    }

    /* ---------- Open thread ---------- */
    function openThread(id, byUser) {
        if (!findConversation(id)) return;
        if (id === r.openId) {
            inputRef.current?.focus();
            return;
        }
        r.openId = id;
        r.lastId = null;
        r.generation++;
        clearTimeout(r.threadTimer);
        r.threadBusy = false;
        r.failed = null;
        r.lastActivity = Date.now();

        messagesRef.current = [];
        setMessages([]);
        setHasOlder(false);
        setFirstLoaded(false);
        setJump(false);
        setSeen(null);
        setContext(null);
        setPop(null);
        clearFile();
        setOpenId(id);
        setInput(getDraft(id));
        setStatus(null);
        setRetry(false);

        // Keep the thread in the URL so a reload reopens it.
        navigate(`?cid=${id}`, { replace: true });
        updateUnread();
        pollThread();
        loadContext(id, r.generation);

        // On phones the thread replaces the list, so bring it into view;
        // focusing there would pop the keyboard over the messages.
        if (byUser && isPhone()) rootRef.current?.scrollIntoView({ block: 'start' });
        else if (byUser) setTimeout(() => inputRef.current?.focus(), 0);
    }

    /** Phones only: back from the thread to the list. */
    function closeThread() {
        r.openId = null;
        r.generation++;
        clearTimeout(r.threadTimer);
        r.threadDue = 0;
        setPop(null);
        setOpenId(null);
        navigate('.', { replace: true });
        updateUnread();
    }

    function loadContext(id, gen) {
        api.get(`/chat/conversations/${id}/context`)
            .then((data) => { if (gen === r.generation) setContext(data.context || {}); })
            .catch(() => { /* the thread works without it */ });
    }

    /* ---------- Messages ---------- */
    function isNearBottom() {
        const box = boxRef.current;
        return !box || box.scrollHeight - box.scrollTop - box.clientHeight < STICK_PX;
    }

    function pollThread() {
        if (r.threadBusy) return; // the running request schedules the next one
        clearTimeout(r.threadTimer);
        r.threadDue = 0;
        if (r.stopped || !r.openId || document.hidden) return;
        r.threadBusy = true;
        const gen = r.generation;
        const firstLoad = !r.lastId && !messagesRef.current.length;
        let more = false;
        const query = r.lastId ? `?after=${r.lastId}` : '';

        api.get(`/chat/conversations/${r.openId}/messages${query}`).then((data) => {
            if (gen !== r.generation) return;
            const incoming = data.messages || [];
            const followed = firstLoad || isNearBottom();
            const { list, added } = merge(messagesRef.current, incoming);
            const theirsArrived = added.some((m) => !m.mine);
            const newest = incoming.length ? incoming[incoming.length - 1].id : null;
            if (newest && (!r.lastId || newest > r.lastId)) r.lastId = newest;
            if (firstLoad) {
                setHasOlder(Boolean(data.hasOlder));
                setFirstLoaded(true);
            }
            if (theirsArrived) r.lastActivity = Date.now();
            if (added.length) {
                messagesRef.current = list;
                setMessages(list);
            }
            setSeen(data.seen || null);
            if (followed) scrollMode.current = 'bottom';
            else if (theirsArrived) setJump(true);
            if (!r.sending) setStatus((s) => (s && s.error ? null : s));
            more = Boolean(data.more);
        }).catch((err) => {
            if (gen !== r.generation) return;
            // Not (or no longer) ours: stop asking.
            if (err.status === 404) r.generation++;
            handleError(err);
        }).finally(() => {
            if (gen === r.generation) {
                r.threadBusy = false;
                if (!r.stopped && !document.hidden) scheduleThread(more ? 0 : threadDelay());
            }
        });
    }

    function loadOlder() {
        const oldest = messagesRef.current[0];
        if (!r.openId || !oldest || olderBusy) return;
        setOlderBusy(true);
        noteActivity();
        const gen = r.generation;
        api.get(`/chat/conversations/${r.openId}/messages?before=${oldest.id}`).then((data) => {
            if (gen !== r.generation) return;
            const box = boxRef.current;
            // Keep what the user is looking at in place while content is added above it.
            scrollMode.current = { keep: box.scrollHeight - box.scrollTop };
            const { list } = merge(messagesRef.current, data.messages || []);
            messagesRef.current = list;
            setMessages(list);
            setHasOlder(Boolean(data.hasOlder));
        }).catch(handleError).finally(() => setOlderBusy(false));
    }

    useLayoutEffect(() => {
        const box = boxRef.current;
        const mode = scrollMode.current;
        scrollMode.current = null;
        if (!box || !mode) return;
        if (mode === 'bottom') {
            box.scrollTop = box.scrollHeight;
            setJump(false);
        } else {
            box.scrollTop = box.scrollHeight - mode.keep;
        }
    }, [messages, seen]);

    function scrollToBottom() {
        if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
        setJump(false);
    }

    /* ---------- Sending ---------- */
    /**
     * Send what is in the compose box (text and any attached file), or the
     * given payload ({readingId} for a heart check). On a connection or
     * server failure the text stays in the box and "tap to retry" appears.
     */
    function sendMessage(payload) {
        if (r.sending || r.stopped || !r.openId) return;
        const data = payload || { body: input, file: r.pendingFile, readingId: null };
        const trimmed = data.body.trim();
        if (!trimmed && !data.file && !data.readingId) return;
        if ([...trimmed].length > CHAT_MAX_LENGTH) {
            setStatus({ text: `Messages can be at most ${CHAT_MAX_LENGTH} characters.`, error: true });
            return;
        }

        const cid = r.openId;
        const gen = r.generation;
        const form = new FormData();
        form.append('body', data.body);
        if (data.file) form.append('file', data.file);
        if (data.readingId) form.append('readingId', data.readingId);

        r.sending = true;
        setSending(true);
        r.failed = null;
        setRetry(false);
        setStatus({ text: data.file ? 'Uploading...' : 'Sending...', error: false });
        noteActivity();

        api.post(`/chat/conversations/${cid}/messages`, form).then((res) => {
            const isCompose = !data.readingId;
            if (isCompose) setDraft(cid, '');
            if (gen === r.generation) {
                if (isCompose) {
                    setInput('');
                    clearFile();
                }
                const { list } = merge(messagesRef.current, [res.message]);
                messagesRef.current = list;
                scrollMode.current = 'bottom';
                setMessages(list);
                setStatus(null);
            }
            refreshList();
        }).catch((err) => {
            if (gen !== r.generation) return;
            if (err.status === 401) {
                handleError(err);
            } else if (!err.status || err.status >= 500) {
                // Connection or server trouble: keep everything and offer a retry.
                r.failed = data;
                setStatus(null);
                setRetry(true);
            } else {
                // The message itself was refused (too long, wrong file type...).
                setStatus({ text: err.message, error: true });
            }
        }).finally(() => {
            r.sending = false;
            setSending(false);
            if (gen === r.generation && !isPhone() && !data.readingId) {
                setTimeout(() => inputRef.current?.focus(), 0);
            }
        });
    }

    function retrySend() {
        const payload = r.failed;
        r.failed = null;
        // A heart check is resent as it was; a normal message is sent as it
        // now reads in the box, in case it was corrected meanwhile.
        sendMessage(payload && payload.readingId ? payload : null);
    }

    function changeInput(value) {
        setInput(value);
        if (r.openId) setDraft(r.openId, value);
        noteActivity();
    }

    // Grow the box with its text, up to a limit.
    useLayoutEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight + 2, 160)}px`;
    }, [input, openId]);

    /* ---------- Attachments ---------- */
    function chooseFile(e) {
        const chosen = e.target.files && e.target.files[0];
        // Cleared so choosing the same file again still fires "change".
        e.target.value = '';
        if (!chosen) return;
        noteActivity();
        // A first check for a quick answer; the server checks the bytes itself.
        if (chosen.type && !UPLOAD_TYPES.includes(chosen.type)) {
            setStatus({ text: 'Only photos (JPG, PNG, WebP) and PDF files can be sent.', error: true });
            return;
        }
        if (chosen.size > CHAT_UPLOAD_LIMIT) {
            setStatus({ text: `That file is too large. The limit is ${sizeLabel(CHAT_UPLOAD_LIMIT)}.`, error: true });
            return;
        }
        r.pendingFile = chosen;
        setFile(chosen);
        setStatus(null);
    }

    function clearFile() {
        r.pendingFile = null;
        setFile(null);
    }

    /* ---------- Popover: share a heart check / quick replies ---------- */
    function togglePop(mode) {
        if (pop?.mode === mode) {
            setPop(null);
            return;
        }
        if (mode === 'readings') {
            setPop({ mode, state: 'loading' });
            api.get('/chat/readings')
                .then((data) => setPop((p) => (p?.mode === 'readings' ? { mode, state: 'ready', readings: data.readings || [] } : p)))
                .catch((err) => setPop((p) => (p ? { mode, state: 'error', error: err.message } : p)));
        } else if (replies) {
            setPop({ mode, state: 'ready' });
        } else {
            setPop({ mode, state: 'loading' });
            api.get('/chat/replies').then((data) => {
                setReplies({ suggested: data.suggested || [], saved: data.saved || [] });
                setPop((p) => (p?.mode === 'replies' ? { mode, state: 'ready' } : p));
            }).catch((err) => setPop((p) => (p ? { mode, state: 'error', error: err.message } : p)));
        }
    }

    /** Put a reply in the box to edit or send; it is never sent by itself. */
    function applyReply(text) {
        const next = input && !/\s$/.test(input) ? `${input} ${text}` : input + text;
        changeInput(next);
        setPop(null);
        inputRef.current?.focus();
    }

    function saveReply() {
        api.post('/chat/replies', { body: input })
            .then((data) => setReplies((rs) => ({ ...rs, saved: [...rs.saved, data.reply] })))
            .catch((err) => setPop({ mode: 'replies', state: 'error', error: err.message }));
    }

    function deleteReply(id) {
        api.del(`/chat/replies/${id}`)
            .then(() => setReplies((rs) => ({ ...rs, saved: rs.saved.filter((x) => x.id !== id) })))
            .catch((err) => setPop({ mode: 'replies', state: 'error', error: err.message }));
    }

    function toggleSound() {
        const next = !soundOn;
        setSoundOn(next);
        r.soundOn = next;
        writeStore('localStorage', 'chatSound', next ? 'on' : '');
        unlockAudio();
        // A sample, so the user knows what to listen for.
        setTimeout(chime, 50);
    }

    /* ---------- Start, stop, and page-wide listeners ---------- */
    useEffect(() => {
        r.stopped = false;
        r.threadBusy = false;
        r.listBusy = false;
        r.openId = null;

        const onVisibility = () => {
            if (document.hidden) {
                // Stop reading the thread; the list carries on slowly for the title.
                clearTimeout(r.threadTimer);
                r.threadDue = 0;
                scheduleList(LIST_IDLE_MS);
            } else {
                r.lastActivity = Date.now();
                pollThread();
                refreshList();
            }
            updateUnread();
        };
        const onUnlock = () => unlockAudio();
        document.addEventListener('visibilitychange', onVisibility);
        document.addEventListener('pointerdown', onUnlock);
        document.addEventListener('keydown', onUnlock);

        updateUnread();
        if (requested && findConversation(requested)) {
            openThread(requested, false);
        } else if (!isPhone() && r.conversations.length) {
            // Wide screens have room for a thread, so open the most recent one.
            openThread(r.conversations[0].id, false);
        }
        scheduleList(listDelay());

        return () => {
            r.stopped = true;
            r.generation++;
            r.openId = null;
            clearTimeout(r.threadTimer);
            clearTimeout(r.listTimer);
            document.removeEventListener('visibilitychange', onVisibility);
            document.removeEventListener('pointerdown', onUnlock);
            document.removeEventListener('keydown', onUnlock);
        };
        // Runs once per mount; everything it uses is read through refs.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Close the popover on a click outside it, or on Escape.
    useEffect(() => {
        if (!pop) return undefined;
        const onClick = (e) => {
            if (!popRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) setPop(null);
        };
        const onKey = (e) => { if (e.key === 'Escape') setPop(null); };
        document.addEventListener('click', onClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('click', onClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [pop]);

    /* ---------- Rendering ---------- */
    const open = conversations.find((c) => c.id === openId) || null;
    const shown = conversations.filter((c) => {
        if (filter.query && !c.name.toLowerCase().includes(filter.query)) return false;
        // The open conversation stays listed, or reading it would make it vanish.
        return !filter.unreadOnly || c.unread > 0 || c.id === openId;
    });
    const mine = messages.filter((m) => m.mine);
    const lastMine = mine[mine.length - 1];
    const seenOnId = seen && lastMine && lastMine.id <= seen.id ? lastMine.id : null;
    const trimmedLength = [...input.trim()].length;

    function assessmentCard(m) {
        const a = m.assessment;
        if (!a.available) return <div className="chat-card is-gone">Heart check (no longer available)</div>;
        // The patient opens their own result page; the doctor gets the chat
        // share view, which checks the reading was posted to them.
        const to = role === 'patient' ? `/patient/readings/${a.readingId}` : `/doctor/chat-assessments/${m.id}`;
        const high = a.riskScore !== null && isHighRisk(a.riskScore);
        return (
            <Link className={`chat-card${high ? ' is-high' : ''}`} to={to}>
                <span className="chat-card__label">Heart check</span>
                <span className="chat-card__title">
                    {stampDate(a.takenAt)} – {a.riskScore === null ? 'not scored yet' : `${riskPercent(a.riskScore)}/100`}
                </span>
                {a.riskScore !== null && <span className="chat-card__risk">{high ? 'High risk' : 'Low risk'}</span>}
                <span className="chat-card__open">Open result →</span>
            </Link>
        );
    }

    function attachment(a) {
        return (
            <a className={`chat-att ${a.image ? 'chat-att--image' : 'chat-att--file'}`} href={a.url} target="_blank" rel="noopener noreferrer">
                {a.image ? <img src={a.url} alt={a.name} loading="lazy" /> : (
                    <>
                        <span className="chat-att__icon">PDF</span>
                        <span className="chat-att__text">
                            <span className="chat-att__name">{a.name}</span>
                            <span className="chat-att__size">{a.size}</span>
                        </span>
                    </>
                )}
            </a>
        );
    }

    let previousDay = null;
    return (
        <>
            {/* The page's panel head, with the sound toggle (a soft chime when a message arrives). */}
            {head(
                <button type="button" className="btn btn-light btn-sm" aria-pressed={soundOn ? 'true' : 'false'} onClick={toggleSound}>
                    {soundOn ? 'Sound on' : 'Sound off'}
                </button>,
            )}

            <div className={`chat${openId ? ' is-thread-open' : ''}`} id="chat" ref={rootRef}
                onPointerDown={noteActivity} onKeyDown={noteActivity}>
                <div className="chat__side">
                    <div className="chat__filters">
                        <label className="sr-only" htmlFor="chatSearch">Search conversations</label>
                        <input type="search" id="chatSearch" placeholder="Search by name" autoComplete="off"
                            value={filter.query} onChange={(e) => setFilter({ ...filter, query: e.target.value.trim().toLowerCase() })} />
                        <button type="button" className="chat-chip" aria-pressed={filter.unreadOnly ? 'true' : 'false'}
                            onClick={() => setFilter({ ...filter, unreadOnly: !filter.unreadOnly })}>Unread</button>
                    </div>
                    <ul className="chat__list" aria-label="Conversations">
                        {shown.map((c) => {
                            const unread = c.id === openId ? 0 : c.unread;
                            return (
                                <li key={c.id}>
                                    <button type="button" data-cid={c.id}
                                        className={`chat-convo${c.id === openId ? ' is-active' : ''}${unread ? ' has-unread' : ''}`}
                                        aria-current={c.id === openId ? 'true' : undefined}
                                        onClick={() => openThread(c.id, true)}>
                                        <span className="chat-convo__name">{c.name}</span>
                                        <span className="chat-convo__time">{c.last ? chatTimeLabel(c.last.at, false) : ''}</span>
                                        {c.subtitle && <span className="chat-convo__sub">{c.subtitle}</span>}
                                        <span className="chat-convo__preview">
                                            {c.last ? `${c.last.mine ? 'You: ' : ''}${c.last.preview}` : 'No messages yet'}
                                        </span>
                                        {unread ? (
                                            <span className="chat-count" aria-label={`${unread} unread`}>{unread > 99 ? '99+' : unread}</span>
                                        ) : <span />}
                                    </button>
                                </li>
                            );
                        })}
                        {!shown.length && (
                            <li className="chat__none">{filter.query ? 'No conversations match your search.' : 'No unread messages.'}</li>
                        )}
                    </ul>
                </div>

                <section className="chat__thread" aria-label="Conversation">
                    <div className="chat__placeholder" hidden={Boolean(open)}>
                        <p>Choose a conversation to read and reply.</p>
                    </div>

                    <div className="chat__head" hidden={!open}>
                        <button type="button" className="btn btn-light btn-sm chat__back" onClick={closeThread}>&larr; All</button>
                        <div className="chat__who">
                            <h3>{open?.name}</h3>
                            <p hidden={!open?.subtitle}>{open?.subtitle}</p>
                            <div className="chat__context">
                                {context && (
                                    <>
                                        {role === 'doctor' && typeof context.age === 'number' && <span className="chat-ctx">Age {context.age}</span>}
                                        {context.next && <span className="chat-ctx">Next visit: {visitLabel(context.next.date, context.next.start)}</span>}
                                        {context.last && (
                                            <span className="chat-ctx">
                                                Last visit: {visitLabel(context.last.date, context.last.start)} ({STATUS_LABELS[context.last.status]})
                                            </span>
                                        )}
                                        {role === 'doctor' && (context.check ? (
                                            <Link
                                                className={`chat-ctx chat-ctx--link${context.check.riskScore !== null && isHighRisk(context.check.riskScore) ? ' is-high' : ''}`}
                                                to={context.check.appointmentId
                                                    ? `/doctor/appointments/${context.check.appointmentId}/assessment`
                                                    : `/doctor/chat-assessments/${context.check.messageId}`}>
                                                Heart check {stampDate(context.check.takenAt)}: {context.check.riskScore === null ? 'not scored yet'
                                                    : `${riskPercent(context.check.riskScore)}/100, ${isHighRisk(context.check.riskScore) ? 'high risk' : 'low risk'}`}
                                            </Link>
                                        ) : <span className="chat-ctx is-muted">No heart check shared</span>)}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="chat__messages" role="log" aria-live="polite" hidden={!open} ref={boxRef}
                        onScroll={() => { if (isNearBottom()) setJump(false); }}>
                        <button type="button" className="chat__older" hidden={!hasOlder} disabled={olderBusy} onClick={loadOlder}>
                            {olderBusy ? 'Loading...' : 'Load older messages'}
                        </button>

                        {open && firstLoaded && !messages.length && (
                            <p className="chat__hint">No messages yet. Write the first one below.</p>
                        )}

                        {messages.map((m) => {
                            const day = dayOf(m.createdAt);
                            const separator = day !== previousDay;
                            previousDay = day;
                            return (
                                <Fragment key={m.id}>
                                    {separator && <div className="chat-day" role="separator"><span>{chatDayLabel(m.createdAt)}</span></div>}
                                    <div className={`chat-msg${m.mine ? ' chat-msg--mine' : ''}`} data-mid={m.id}>
                                        {m.assessment && assessmentCard(m)}
                                        {m.attachment && attachment(m.attachment)}
                                        {m.body && <div className="chat-msg__bubble">{m.body}</div>}
                                        <span className="chat-msg__time">{m.mine ? 'You · ' : ''}{stampTime(m.createdAt)}</span>
                                        {m.id === seenOnId && <span className="chat-msg__seen">Seen {chatTimeLabel(seen.at, true)}</span>}
                                    </div>
                                </Fragment>
                            );
                        })}

                        <button type="button" className="chat__jump" hidden={!jump} onClick={scrollToBottom}>New messages &darr;</button>
                    </div>

                    <form className="chat__compose" hidden={!open} onSubmit={(e) => { e.preventDefault(); sendMessage(); }}>
                        <div className="chat-pop" hidden={!pop} ref={popRef}>
                            {pop?.state === 'loading' && <p className="chat-pop__note">Loading...</p>}
                            {pop?.state === 'error' && <p className="chat-pop__note is-error">{pop.error || 'Could not load. Please try again.'}</p>}

                            {pop?.state === 'ready' && pop.mode === 'readings' && (
                                <>
                                    <p className="chat-pop__title">Share a heart check</p>
                                    {pop.readings.length ? (
                                        <>
                                            <p className="chat-pop__note">The doctor will be able to open the reading you choose.</p>
                                            <ul className="chat-pop__list">
                                                {pop.readings.map((reading) => {
                                                    const high = reading.riskScore !== null && isHighRisk(reading.riskScore);
                                                    return (
                                                        <li key={reading.id}>
                                                            <button type="button" className="chat-pop__item" onClick={() => {
                                                                setPop(null);
                                                                sendMessage({ body: '', file: null, readingId: reading.id });
                                                            }}>
                                                                <span>{stampDate(reading.takenAt)}</span>
                                                                <span className={`chat-pop__meta${high ? ' is-high' : ''}`}>
                                                                    {reading.riskScore === null ? 'not scored yet' : `${riskPercent(reading.riskScore)}/100 · ${high ? 'High' : 'Low'}`}
                                                                </span>
                                                            </button>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </>
                                    ) : (
                                        <p className="chat-pop__note">You have no heart checks yet. <Link to="/patient/heart-check">Take the heart check</Link></p>
                                    )}
                                </>
                            )}

                            {pop?.state === 'ready' && pop.mode === 'replies' && replies && (
                                <>
                                    <p className="chat-pop__title">Suggested</p>
                                    <ul className="chat-pop__list">
                                        {replies.suggested.map((text) => (
                                            <li key={text} className="chat-pop__row">
                                                <button type="button" className="chat-pop__item" onClick={() => applyReply(text)}>{text}</button>
                                            </li>
                                        ))}
                                    </ul>
                                    {replies.saved.length > 0 && (
                                        <>
                                            <p className="chat-pop__title">Your quick replies</p>
                                            <ul className="chat-pop__list">
                                                {replies.saved.map((reply) => (
                                                    <li key={reply.id} className="chat-pop__row">
                                                        <button type="button" className="chat-pop__item" onClick={() => applyReply(reply.body)}>{reply.body}</button>
                                                        <button type="button" className="chat-pop__delete" aria-label="Delete this quick reply"
                                                            onClick={() => deleteReply(reply.id)}>×</button>
                                                    </li>
                                                ))}
                                            </ul>
                                        </>
                                    )}
                                    <button type="button" className="chat-pop__save" disabled={!input.trim()} onClick={saveReply}>
                                        Save the message in the box as a quick reply
                                    </button>
                                </>
                            )}
                        </div>

                        <div className="chat__tools">
                            <label className="chat-tool">
                                <input type="file" className="sr-only" accept={UPLOAD_TYPES.join(',')} onChange={chooseFile} />
                                Attach photo or PDF
                            </label>
                            <button type="button" className="chat-tool" ref={triggerRef} aria-expanded={pop ? 'true' : 'false'}
                                onClick={() => togglePop(role === 'patient' ? 'readings' : 'replies')}>
                                {role === 'patient' ? 'Share heart check' : 'Quick replies'}
                            </button>
                            <span className="chat-file" hidden={!file}>
                                <span>{file ? `${file.name} (${sizeLabel(file.size)})` : ''}</span>
                                <button type="button" aria-label="Remove attachment" onClick={clearFile}>&times;</button>
                            </span>
                        </div>

                        <label className="sr-only" htmlFor="chatInput">Message</label>
                        <div className="chat__compose-row">
                            <textarea
                                id="chatInput" ref={inputRef} rows={1} maxLength={CHAT_MAX_LENGTH} placeholder="Write a message..."
                                value={input}
                                // Read-only rather than disabled while sending, so the text stays visible.
                                readOnly={sending}
                                onChange={(e) => changeInput(e.target.value)}
                                onKeyDown={(e) => {
                                    // Enter sends; Shift+Enter is a new line. isComposing leaves Enter
                                    // alone while an input method (e.g. Devanagari typing) is composing.
                                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                                        e.preventDefault();
                                        sendMessage();
                                    }
                                }}
                            />
                            <button type="submit" className="btn btn-primary" disabled={sending || stopped}>Send</button>
                        </div>
                        <div className="chat__status">
                            <span>
                                <span role="status" className={status?.error ? 'is-error' : ''}>{status?.text}</span>
                                <button type="button" className="chat__retry" hidden={!retry} onClick={retrySend}>Not sent &ndash; tap to retry</button>
                            </span>
                            <span className={trimmedLength > CHAT_MAX_LENGTH ? 'is-error' : ''}>
                                {trimmedLength > CHAT_MAX_LENGTH - 200 ? `${trimmedLength} / ${CHAT_MAX_LENGTH}` : ''}
                            </span>
                        </div>
                    </form>
                </section>
            </div>
        </>
    );
}
