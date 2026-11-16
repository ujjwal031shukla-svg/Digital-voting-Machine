import React, { useState, useCallback, useEffect } from 'react';
import KineticGrid from './components/kinetic-grid';
import { FlowButton } from './components/flow-button';
import { BackgroundPaths } from './components/ui/background-paths';

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   DVM-9000 â€” Digital Voting Machine
   Single-file React app implementing a 5-state FSM:
   IDLE â†’ READY â†’ VOTED â†’ LOCKED â†’ RESULT
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

const DEFAULT_PIN = '1234';
const STORAGE_KEY = 'dvm_votes';
const AUDIT_KEY = 'dvm_audit_log';
const UTM_KEY = 'dvm_utm';
const THEME_KEY = 'dvm_theme';
const COOKIE_KEY = 'dvm_cookie';
const MACHINE_KEY_KEY = 'dvm_machine_key';
const PIN_HASH_KEY = 'dvm_pin_hash';
const PIN_LOCK_KEY = 'dvm_pin_lock';
const LAST_UPDATED = '2026-11-12';

/* â”€â”€ Web Crypto helpers (AES-256-GCM, machine-local key) â”€â”€ */
const bytesToHex = (b: Uint8Array) => Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
const hexToBytes = (h: string) => new Uint8Array(h.match(/.{2}/g)!.map(b => parseInt(b, 16)));
const bytesToB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const b64ToBytes = (s: string) => new Uint8Array(atob(s).split('').map(c => c.charCodeAt(0)));

async function getMachineKey(): Promise<CryptoKey | null> {
  try {
    let hex = localStorage.getItem(MACHINE_KEY_KEY);
    let raw: Uint8Array;
    if (hex) { raw = hexToBytes(hex); }
    else { raw = crypto.getRandomValues(new Uint8Array(32)); localStorage.setItem(MACHINE_KEY_KEY, bytesToHex(raw)); }
    return await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  } catch { return null; }
}

async function writeEncrypted(key: string, obj: unknown): Promise<void> {
  try {
    const k = await getMachineKey();
    const plain = JSON.stringify(obj);
    if (k) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(plain));
      localStorage.setItem(key, JSON.stringify({ v: 2, iv: bytesToB64(iv), ct: bytesToB64(new Uint8Array(ct)) }));
    } else {
      // Integrity-only fallback â€” loud, not silent
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain));
      localStorage.setItem(key, JSON.stringify({ v: 1, sha256: bytesToHex(new Uint8Array(digest)), plain: obj }));
    }
  } catch {}
}

async function readEncrypted<T = any>(key: string): Promise<T | null> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const doc = JSON.parse(raw);
    if (doc.v === 2) {
      const k = await getMachineKey();
      if (!k) return null;
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(doc.iv) }, k, b64ToBytes(doc.ct));
      return JSON.parse(new TextDecoder().decode(pt)) as T;
    }
    if (doc.v === 1) return doc.plain as T;
    return doc as T; // legacy plain object
  } catch { return null; }
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return bytesToHex(new Uint8Array(buf));
}
const hashVoterId = (id: string) => sha256Hex('DVM-VOTER\x00' + id);

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function useFocusTrap(ref: React.RefObject<HTMLDivElement | null>, active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;
    const focusables = Array.from(container.querySelectorAll(FOCUSABLE)) as HTMLElement[];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const prevActive = document.activeElement as HTMLElement | null;
    (first ?? container).focus?.();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = Array.from(container.querySelectorAll(FOCUSABLE)) as HTMLElement[];
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) { e.preventDefault(); lastItem.focus(); }
      else if (!e.shiftKey && document.activeElement === lastItem) { e.preventDefault(); firstItem.focus(); }
    };
    container.addEventListener('keydown', onKey);
    return () => {
      container.removeEventListener('keydown', onKey);
      prevActive?.focus?.();
    };
  }, [active, ref]);
}

const STATES = { IDLE: 'IDLE', READY: 'READY', VOTED: 'VOTED', LOCKED: 'LOCKED', RESULT: 'RESULT' } as const;

const STATE_META: Record<string, { num: string; label: string; sub: string; led: 'green' | 'amber' | 'red' | 'blue' }> = {
  [STATES.IDLE]:   { num: '01', label: 'STANDBY',  sub: 'Clutch disengaged. Officer must arm voter session.', led: 'red'   },
  [STATES.READY]:  { num: '02', label: 'READY',    sub: 'Plunger keys energized. One vote only.',            led: 'green' },
  [STATES.VOTED]:  { num: '03', label: 'VOTED',    sub: 'Vote recorded; slip printed to hopper (simulated).', led: 'amber' },
  [STATES.LOCKED]: { num: '04', label: 'LOCKED',   sub: 'Steel shutter engaged. Physical interlock active.',   led: 'red'   },
  [STATES.RESULT]: { num: '05', label: 'TALLY',    sub: 'Simulated flip-counter inspection � officer only.',      led: 'blue'  },
};

const CANDIDATES = [
  { id: 1, name: 'ELENA ROSTOVA',     party: 'Independent Civic Coalition',  slot: 'SLOT 01', code: '01' },
  { id: 2, name: 'MARCUS VANCE',      party: 'Labor & Heritage Party',       slot: 'SLOT 02', code: '02' },
  { id: 3, name: 'AMINA AL-MANSOOR',  party: 'Urban Transit Alliance',       slot: 'SLOT 03', code: '03' },
  { id: 4, name: 'DAVID K. CHEN',     party: 'Public Ecology Forum',         slot: 'SLOT 04', code: '04' },
  { id: 5, name: 'NOTA',              party: 'None of the Above',            slot: 'SLOT 05', code: '05' },
];

export default function App() {
  /* â”€â”€ Core state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const [state, setState] = useState(STATES.IDLE);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [candidateVotes, setCandidateVotes] = useState<Record<number, number>>({});
  const [totalVoters, setTotalVoters] = useState(0);
  const [voterHasVoted, setVoterHasVoted] = useState(false);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [auditTampered, setAuditTampered] = useState(false);
  const [voterId, setVoterId] = useState('');
  const [voterIdVerified, setVoterIdVerified] = useState(false);
  const [voterIdError, setVoterIdError] = useState('');
  const [usedVoterHashList, setUsedVoterHashList] = useState<string[]>([]);
  const [voterIdFile, setVoterIdFile] = useState<{ name: string; size: number; hash: string } | null>(null);
  const [voterIdFileError, setVoterIdFileError] = useState('');
  const [usedVoterDocHashList, setUsedVoterDocHashList] = useState<string[]>([]);
  const [pinChangeOpen, setPinChangeOpen] = useState(false);
  const [pinChangeCurrent, setPinChangeCurrent] = useState('');
  const [pinChangeNew, setPinChangeNew] = useState('');
  const [pinChangeError, setPinChangeError] = useState('');
  const [pinLockUntil, setPinLockUntil] = useState<number>(0);
  const [pinFailCount, setPinFailCount] = useState(0);
  const pinAttempts = pinFailCount;
  const persistReadyRef = React.useRef(false);
  const [toast, setToast] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [officerOpen, setOfficerOpen] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagTest, setDiagTest] = useState('SOLENOID FORCE (SIMULATED)');
  const [diagLog, setDiagLog] = useState<string[]>([
    '[SIM BOOT] DVM-9000 demo firmware 2.1-B loaded (simulation)',
    '[SIM OK]   Fictional quartz oscillator check passes',
    '[SIM OK]   Fictional spring-return force nominal',
  ]);
  const [selfTestRunning, setSelfTestRunning] = useState(false);
  const [printClicked, setPrintClicked] = useState(false);
  const [sealClicked, setSealClicked] = useState(false);

  /* â”€â”€ Feature state (UI chrome) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const [scrollY, setScrollY] = useState(0);
  const [dark, setDark] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [utm, setUtm] = useState<Record<string, string>>({});
  const [cookieConsent, setCookieConsent] = useState<string | null>(() => {
    try { return localStorage.getItem(COOKIE_KEY); } catch { return null; }
  });
  const [pinVisible, setPinVisible] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactStatus, setContactStatus] = useState<'idle' | 'error' | 'success'>('idle');
  const [contactError, setContactError] = useState('');
  const [confirmCfg, setConfirmCfg] = useState<{ title: string; body: string; confirmLabel: string; onConfirm: () => void } | null>(null);
  const canCast = state === STATES.READY && selectedId !== null && !voterHasVoted && voterIdVerified && !!voterIdFile;
  const officerDialogRef = React.useRef<HTMLDivElement | null>(null);
  const diagDialogRef = React.useRef<HTMLDivElement | null>(null);
  const searchDialogRef = React.useRef<HTMLDivElement | null>(null);
  const confirmDialogRef = React.useRef<HTMLDivElement | null>(null);
  const contactDialogRef = React.useRef<HTMLDivElement | null>(null);
  useFocusTrap(officerDialogRef, officerOpen);
  useFocusTrap(diagDialogRef, diagOpen);
  useFocusTrap(searchDialogRef, searchOpen);
  useFocusTrap(confirmDialogRef, confirmCfg !== null);
  useFocusTrap(contactDialogRef, contactOpen);

  /* ── Keyboard-only navigation ────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && typeof (t as HTMLElement).closest === 'function' && (t as HTMLElement).closest('input,textarea,select,[contenteditable="true"]')) return;
      const k = e.key;
      if (officerOpen) {
        if (/^[0-9]$/.test(k)) { e.preventDefault(); handlePinDigit(k); return; }
        if (k === 'Enter') { e.preventDefault(); submitPin(); return; }
        if (k === 'Backspace') { e.preventDefault(); clearPin(); return; }
        return;
      }
      if (diagOpen) { if (k === 'Escape') setDiagOpen(false); return; }
      if (searchOpen) { if (k === 'Escape') setSearchOpen(false); return; }
      if (contactOpen) { if (k === 'Escape') setContactOpen(false); return; }
      if (confirmCfg) { if (k === 'Escape') setConfirmCfg(null); return; }
      if (state === STATES.READY && !voterHasVoted) {
        const n = parseInt(k, 10);
        if (n >= 1 && n <= CANDIDATES.length) {
          e.preventDefault();
          selectCandidate(CANDIDATES[n - 1].id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const verifyVoterId = async () => {
    const id = voterId.trim().toUpperCase();
    setVoterIdError('');
    if (!/^[A-Z0-9\-]{6,12}$/.test(id)) { setVoterIdError('Invalid voter ID â€” 6-12 letters, digits or hyphens.'); notify('Invalid voter ID'); return; }
    const hash = await hashVoterId(id);
    if (usedVoterHashList.includes(hash)) { setVoterIdError('This voter ID has already been used to vote.'); notify('Voter ID already used'); logEvent('VOTER_ID_DUPLICATE', 'VOTER', 'Repeat ID presented'); return; }
    setVoterIdVerified(true);
    logEvent('VOTER_ID_VERIFIED', 'VOTER', `Hash ${hash.slice(0, 12)}â€¦`);
    notify('Ballot open â€” welcome, voter');
  };

  const handleVoterIdFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setVoterIdFileError('');
    if (!file) return;
    const okTypes = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
    if (file.type && !okTypes.includes(file.type)) { setVoterIdFileError('Upload a PNG, JPG, WEBP or PDF of the Voter ID card.'); notify('Unsupported ID file type'); return; }
    if (file.size > 4 * 1024 * 1024) { setVoterIdFileError('File too large � max 4 MB.'); notify('ID file too large'); return; }
    try {
      const buf = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', buf);
      const hash = bytesToHex(new Uint8Array(digest));
      if (usedVoterDocHashList.includes(hash)) {
        setVoterIdFileError('This ID document has already been used to vote.');
        notify('ID document already used');
        logEvent('VOTER_DOC_DUPLICATE', 'VOTER', `${file.name} (hash ${hash.slice(0, 12)}�)`);
        return;
      }
      setVoterIdFile({ name: file.name, size: file.size, hash });
      logEvent('VOTER_ID_DOC_VERIFIED', 'VOTER', `${file.name} � ${Math.round(file.size / 1024)} KB � hash ${hash.slice(0, 12)}�`);
      notify('Voter ID document accepted');
    } catch {
      setVoterIdFileError('Could not read the file � try again.');
    }
  };

  const changePinHash = async () => {
    const h = await sha256Hex(pinChangeCurrent);
    if (h !== await storedPinHash()) {
      setPinChangeError('Current PIN is incorrect');
      return;
    }
    if (!/^\d{4,8}$/.test(pinChangeNew)) { setPinChangeError('New PIN must be 4-8 digits'); return; }
    localStorage.setItem(PIN_HASH_KEY, await sha256Hex(pinChangeNew));
    logEvent('PIN_CHANGE_SUCCESS', 'OFFICER', 'PIN changed and persisted');
    notify('Officer PIN updated');
    setPinChangeOpen(false); setPinChangeCurrent(''); setPinChangeNew(''); setPinChangeError('');
  };

  /* Escape closes overlays */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOfficerOpen(false); setDiagOpen(false); setContactOpen(false);
      setSearchOpen(false); setMobileMenu(false); setConfirmCfg(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* â”€â”€ Feature effects: theme, scroll, UTM â”€â”€ */
  useEffect(() => {
    try { if (localStorage.getItem(THEME_KEY) === 'light') { document.documentElement.classList.remove('dark'); setDark(false); } else { document.documentElement.classList.add('dark'); setDark(true); } } catch {}
  }, []);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY || 0);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const captured: Record<string, string> = {};
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach((k) => {
        const v = q.get(k); if (v) captured[k] = v;
      });
      if (Object.keys(captured).length > 0) {
        const prev = JSON.parse(localStorage.getItem(UTM_KEY) || '{}');
        const merged = { ...prev, ...captured };
        localStorage.setItem(UTM_KEY, JSON.stringify(merged));
        setUtm(merged);
        pushAudit(`UTM_CAPTURED source=${captured.utm_source || '-'} campaign=${captured.utm_campaign || '-'}`);
      } else {
        setUtm(JSON.parse(localStorage.getItem(UTM_KEY) || '{}'));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem(THEME_KEY, next ? 'dark' : 'light'); } catch {}
  };

  const copyText = async (text: string, label = 'Copied to clipboard') => {
    try { await navigator.clipboard.writeText(text); notify(label); }
    catch { notify('Clipboard unavailable in this context'); }
  };

  const scrollToId = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const acceptCookie = (decision: 'accepted' | 'declined') => {
    setCookieConsent(decision);
    try { localStorage.setItem(COOKIE_KEY, decision); } catch {}
    pushAudit(`COOKIE_${decision.toUpperCase()}`);
  };

  const [contactAttachment, setContactAttachment] = useState<{ name: string; size: number } | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<Array<{ name: string; size: number; at: string }>>(() => {
    try { return JSON.parse(localStorage.getItem('dvm_uploaded_docs') || '[]'); } catch { return []; }
  });

  const submitContact = (e: React.FormEvent) => {
    e.preventDefault();
    const name = contactName.trim(), email = contactEmail.trim(), message = contactMessage.trim();
    const hasAttachment = contactAttachment !== null;
    if (name.length < 2) { setContactStatus('error'); setContactError('Please enter your full name (min. 2 characters).'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { setContactStatus('error'); setContactError('Enter a valid email address (e.g. officer@example.com).'); return; }
    if (!hasAttachment && message.length < 10) { setContactStatus('error'); setContactError('Type a message (min. 10 characters) or attach a document.'); return; }
    if (hasAttachment) {
      const entry = { name: contactAttachment.name, size: contactAttachment.size, at: new Date().toISOString() };
      setUploadedDocs(prev => {
        const next = [entry, ...prev].slice(0, 10);
        try { localStorage.setItem('dvm_uploaded_docs', JSON.stringify(next)); } catch {}
        return next;
      });
      logEvent('DOCUMENT_ATTACHED', 'OFFICER', `${entry.name} (${entry.size} bytes)`);
    }
    setContactStatus('success');
    pushAudit(`CONTACT_MESSAGE_SENT from=${email}${contactAttachment ? ` +attachment:${contactAttachment.name}` : ''}`);
    setContactName(''); setContactEmail(''); setContactMessage(''); setContactError(''); setContactAttachment(null);
  };

  const confirmThen = (title: string, body: string, confirmLabel: string, onConfirm: () => void) =>
    setConfirmCfg({ title, body, confirmLabel, onConfirm });

  const SEARCH_INDEX: Array<{ label: string; keywords: string; run: () => void }> = [
    { label: 'Landing � cinematic intro', keywords: 'hero landing intro overview about cinematic', run: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
    { label: 'Ballot console â€” cast a vote', keywords: 'ballot vote cast console candidates elena vance', run: () => scrollToId('ballot-console') },
    { label: '01 / 02 READY â€” arm the ballot (Officer PIN)', keywords: 'ready arm pin officer ballot 01 02', run: () => { setScreenTo(STATES.READY); } },
    { label: '02 / 03 VOTED â€” VVPAT paper audit', keywords: 'voted vvpat audit paper slip 02 03', run: () => goTo(STATES.VOTED) },
    { label: '03 / 04 LOCKED â€” demo close screen', keywords: 'locked sealed interlock emergency 03 04', run: () => goTo(STATES.LOCKED) },
    { label: '04 Officer drawer â€” PIN authentication register', keywords: 'officer drawer pin register 04 admin', run: () => setOfficerOpen(true) },
    { label: '05 Results � flip-counter tally (simulated)', keywords: 'results tally votes counting flip 05', run: () => goTo(STATES.RESULT) },
    { label: '06 Hardware diagnostics â€” calibration bus', keywords: 'diagnostics calibration self test solenoid 06', run: () => setDiagOpen(true) },
    { label: 'Specifications â€” industrial standards', keywords: 'specs specifications material switches battery steel', run: () => scrollToId('specs') },
    { label: 'FAQ â€” security & auditing questions', keywords: 'faq questions security audit power vote twice', run: () => scrollToId('faq') },
    { label: 'Print tally tape preview', keywords: 'print tape receipt thermal print', run: () => { goTo(STATES.RESULT); setPrintClicked(true); } },
  ];

  const setScreenTo = (s: string) => { setOfficerOpen(false); setDiagOpen(false); goTo(s); scrollToId('ballot-console'); };

  const searchResults = searchQuery.trim().length === 0
    ? SEARCH_INDEX
    : SEARCH_INDEX.filter((e) => (e.label + ' ' + e.keywords).toLowerCase().includes(searchQuery.trim().toLowerCase()));

  const runSearch = (entry: (typeof SEARCH_INDEX)[number]) => {
    setSearchOpen(false);
    setSearchQuery('');
    entry.run();
  };

  /* â”€â”€ Persistence (AES-GCM at rest, hash-chained audit) â”€â”€ */
  const auditChainRef = React.useRef<{ busy: boolean; items: Array<{ ts: string; actor: string; event: string; detail: string }>; log: any[] }>({ busy: false, items: [], log: [] });

  const flushAudit = useCallback(async () => {
    const chain = auditChainRef.current;
    if (chain.busy || chain.items.length === 0) return;
    chain.busy = true;
    try {
      let log: any[] = (await readEncrypted(AUDIT_KEY)) ?? [];
      if (!Array.isArray(log)) log = [];
      let head = log.length && log[log.length - 1]?.chain ? log[log.length - 1].chain : 'GENESIS';
      while (chain.items.length) {
        const item = chain.items.shift()!;
        const core = JSON.stringify({ ts: item.ts, event: item.event, actor: item.actor, detail: item.detail, prev: head });
        head = await sha256Hex(core);
        log.push({ ...item, prev: head, chain: head });
      }
      if (log.length > 50) log = log.slice(-50);
      await writeEncrypted(AUDIT_KEY, log);
      chain.log = log;
      setAuditLog(log);
    } finally {
      chain.busy = false;
    }
  }, []);

  const pushAudit = useCallback((entry: string) => {
    const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
    auditChainRef.current.items.push({ ts, actor: 'SYSTEM', event: entry, detail: '' });
    flushAudit();
  }, [flushAudit]);

  useEffect(() => {
    (async () => {
      const legacyVotes = (() => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } })();
      const v = await readEncrypted(STORAGE_KEY);
      if (v) {
        setCandidateVotes(v.candidateVotes || {});
        setTotalVoters(v.totalVoters || 0);
        setVoterHasVoted(v.voterHasVoted || false);
        setUsedVoterHashList(Array.isArray(v.voterIdHashes) ? v.voterIdHashes : []);
        setUsedVoterDocHashList(Array.isArray(v.voterDocHashes) ? v.voterDocHashes : []);
      } else if (legacyVotes) {
        try {
          const d = JSON.parse(legacyVotes);
          setCandidateVotes(d.candidateVotes || {});
          setTotalVoters(d.totalVoters || 0);
          setVoterHasVoted(d.voterHasVoted || false);
          await writeEncrypted(STORAGE_KEY, { ...d, voterIdHashes: [], voterDocHashes: [] });
          pushAudit('MIGRATED_TO_ENCRYPTION');
        } catch {}
      }
      const a = await readEncrypted(AUDIT_KEY);
      let logArr = Array.isArray(a) ? a : [];
      // Drop legacy plain-string entries (pre-hash-chain era) â€” they can't be verified, keep them visible as-is but don't chain-verify
      logArr = logArr.filter(e => e && typeof e === 'object' && typeof e.ts === 'string' && typeof e.event === 'string');
      if (logArr.length) {
        let head = 'GENESIS', ok = true;
        for (const e of logArr) {
          const core = JSON.stringify({ ts: e.ts, event: e.event, actor: e.actor, detail: e.detail, prev: head });
          head = await sha256Hex(core);
          if (e.chain !== head) { ok = false; break; }
        }
        if (!ok) {
          setAuditTampered(true);
          pushAudit('AUDIT_CHAIN_TAMPERED');
          notify('Audit chain FAILED — do not trust this tally');
        }
      }
      setAuditLog(logArr);
      persistReadyRef.current = true;
      try { const lock = JSON.parse(localStorage.getItem(PIN_LOCK_KEY) || '{}'); setPinFailCount(lock.fails || 0); setPinLockUntil(lock.lockUntil || 0); } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistVotes = useCallback(() => {
    if (!persistReadyRef.current) return;
    writeEncrypted(STORAGE_KEY, { candidateVotes, totalVoters, voterHasVoted, voterIdHashes: usedVoterHashList, voterDocHashes: usedVoterDocHashList });
  }, [candidateVotes, totalVoters, voterHasVoted, usedVoterHashList, usedVoterDocHashList]);

  /* Persist votes on every tally-relevant change (encrypted at rest) */
  useEffect(() => {
    persistVotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateVotes, totalVoters, voterHasVoted, usedVoterHashList, usedVoterDocHashList]);

  const logEvent = useCallback((event: string, actor: string, detail = '') => {
    const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
    auditChainRef.current.items.push({ ts, event, actor, detail });
    flushAudit();
  }, [flushAudit]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout((notify as any)._t);
    (notify as any)._t = window.setTimeout(() => setToast(null), 2800);
  }, []);

  /* â”€â”€ FSM guards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const goTo = useCallback((next: string) => {
    const prev = state;
    setState(next);
    pushAudit(`FSM ${prev} â†’ ${next}`);
    if (next === STATES.IDLE) {
      setSelectedId(null);
      setVoterHasVoted(false);
      setVoterIdFile(null); setVoterIdFileError(''); setVoterIdVerified(false);
    }
  }, [state, pushAudit]);

  const selectCandidate = (id: number) => {
    if (state !== STATES.READY) { notify('Ballot not armed â€” officer PIN (1234) required'); return; }
    if (voterHasVoted) { notify('One vote per session'); return; }
    setSelectedId(id);
  };

  const clearSelection = () => setSelectedId(null);

  const castBallot = async () => {
    if (state !== STATES.READY) { notify('Ballot not armed â€” officer PIN required'); return; }
    if (selectedId === null) { notify('Select a candidate first'); return; }
    if (voterHasVoted) { notify('One vote per session'); return; }
    if (!voterIdVerified) { notify('Verify voter ID first'); return; }
    const sel = CANDIDATES.find((c) => c.id === selectedId)!;
    const spentId = voterId.trim().toUpperCase();
    const hash = await hashVoterId(spentId);
    const newHashes = [...usedVoterHashList, hash];
    const newDocHashes = voterIdFile ? [...usedVoterDocHashList, voterIdFile.hash] : usedVoterDocHashList;
    setUsedVoterDocHashList(newDocHashes);
    if (voterIdFile) logEvent('VOTER_ID_DOC_SPENT', 'VOTER', `Document hash ${voterIdFile.hash.slice(0, 12)}� recorded`);
    setVoterIdFile(null); setVoterIdFileError('');
    setCandidateVotes((prev) => ({ ...prev, [selectedId]: (prev[selectedId] ?? 0) + 1 }));
    setTotalVoters((t) => t + 1);
    setVoterHasVoted(true);
    logEvent('VOTER_ID_SPENT', 'VOTER', 'ID hash recorded; ballot closed for this voter');
    setUsedVoterHashList(newHashes);
    setVoterIdVerified(false); setVoterId('');
    pushAudit(`VOTE_CAST â€” ${sel.name} (${sel.slot})`);
    notify(`Ballot signed â€” ${sel.name}`);
    goTo(STATES.VOTED);
  };

  const handlePinDigit = (d: string) => {
    if (Date.now() < pinLockUntil) { notify(`Keypad locked â€” ${Math.ceil((pinLockUntil - Date.now()) / 1000)}s remaining`); return; }
    if (pin.length < 4) setPin((p) => p + d);
  };
  const clearPin = () => { setPin(''); setPinError(''); };

  const storedPinHash = useCallback(async () => {
    try {
      const h = localStorage.getItem(PIN_HASH_KEY);
      if (h) return h;
      const d = await sha256Hex(DEFAULT_PIN);
      localStorage.setItem(PIN_HASH_KEY, d);
      return d;
    } catch { return sha256Hex(DEFAULT_PIN); }
  }, []);

  const persistLockout = (fails: number, lockUntil: number) => {
    setPinFailCount(fails); setPinLockUntil(lockUntil);
    try { localStorage.setItem(PIN_LOCK_KEY, JSON.stringify({ fails, lockUntil })); } catch {}
  };

  const submitPin = async () => {
    const now = Date.now();
    if (pinLockUntil > now) {
      notify(`Keypad locked â€” ${Math.ceil((pinLockUntil - now) / 1000)}s remaining`);
      return;
    }
    const candidate = await sha256Hex(pin);
    if (candidate === await storedPinHash()) {
      pushAudit('OFFICER_LOGIN_SUCCESS');
      persistLockout(0, 0); setPinError(''); setPin('');
      notify('Officer authenticated â€” ballot armed');
      setOfficerOpen(false);
      _startOfficerTimer();
      if (state === STATES.LOCKED) goTo(STATES.RESULT);
      else goTo(STATES.READY);
    } else {
      const next = pinFailCount + 1;
      const locked = next >= 3;
      const lockUntil = locked ? now + 30000 : 0;
      persistLockout(locked ? 0 : next, lockUntil);
      setPin('');
      if (locked) {
        setPinError('LOCKOUT');
        pushAudit('OFFICER_LOGIN_LOCKOUT');
        notify('Keypad locked for 30 seconds');
      } else {
        setPinError(`WRONG â€” ${3 - next} left`);
        pushAudit(`OFFICER_LOGIN_FAILED (${next}/3)`);
        notify(`Incorrect PIN (${3 - next} left)`);
      }
    }
  };

  const resetToIdle = () => {
    setState(STATES.IDLE); setSelectedId(null); setVoterHasVoted(false);
    setVoterIdFile(null); setVoterIdFileError(''); setVoterIdVerified(false);
    pushAudit('MACHINE_RESET'); notify('Terminal returned to IDLE');
  };

  const runSelfTest = () => {
    if (selfTestRunning) return;
    setSelfTestRunning(true);
    const steps: Array<[string, number]> = [
      ['[SIM TEST] Plunger spring-return force� PASS', 350],
      ['[SIM TEST] LED lattice diode scan� 20/20 PASS', 700],
      ['[SIM TEST] Paper feed caliper� PASS', 1050],
      ['[SIM TEST] Tamper bus continuity� CLOSED LOOP PASS', 1400],
      ['[SIM TEST] VVPAT hopper switch� OK', 1750],
      ['[SIM DONE] SIMULATED SELF-TEST COMPLETE � 5/5 PASS', 2150],
    ];
    steps.forEach(([line, delay]) => {
      window.setTimeout(() => setDiagLog((prev) => [...prev.slice(-30), line]), delay);
    });
      window.setTimeout(() => { setSelfTestRunning(false); pushAudit('HARDWARE_SELF_TEST_PASS'); notify('Simulated self-test complete � 5/5 PASS'); }, 2200);
  };

  /* â”€â”€ Officer 5-minute inactivity auto-lock â”€â”€ */
  const officerActivityRef = React.useRef<number | null>(null);

  const _officerTimeout = () => {
    setOfficerOpen(false);
    setState((s: any) => {
      if (s !== STATES.IDLE) {
        setSelectedId(null);
        setVoterHasVoted(false);
        setVoterIdFile(null); setVoterIdFileError(''); setVoterIdVerified(false);
        pushAudit('OFFICER_SESSION_TIMEOUT');
        notify('Officer session locked after 5 minutes of inactivity');
      }
      return STATES.IDLE;
    });
  };

  const _startOfficerTimer = () => {
    if (officerActivityRef.current) window.clearTimeout(officerActivityRef.current);
    officerActivityRef.current = window.setTimeout(_officerTimeout, 5 * 60 * 1000);
  };

  useEffect(() => {
    const reset = () => {
      if (officerActivityRef.current) {
        window.clearTimeout(officerActivityRef.current);
        officerActivityRef.current = window.setTimeout(_officerTimeout, 5 * 60 * 1000);
      }
    };
    document.addEventListener('click', reset);
    document.addEventListener('keydown', reset);
    return () => {
      document.removeEventListener('click', reset);
      document.removeEventListener('keydown', reset);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* â”€â”€ Persisted PIN lockout countdown re-enable â”€â”€ */
  useEffect(() => {
    if (pinLockUntil <= Date.now()) { setPinLockUntil(0); setPinFailCount(0); return; }
    setPinError('LOCKOUT');
    const id = window.setTimeout(() => { setPinLockUntil(0); setPinFailCount(0); setPinError(''); notify('Keypad backoff elapsed â€” 3 attempts restored'); }, pinLockUntil - Date.now() + 200);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinLockUntil]);

  /* â”€â”€ VOTED countdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  useEffect(() => {
    if (state !== STATES.VOTED) return;
    let s = 5; setCountdown(s);
    const id = setInterval(() => { s -= 1; setCountdown(Math.max(0, s)); if (s <= 0) { clearInterval(id); resetToIdle(); } }, 1000);
    return () => clearInterval(id);
  }, [state]);

  const selectedName = selectedId !== null ? CANDIDATES.find((c) => c.id === selectedId)?.name : null;
  const winnerId = (() => {
    let best: number | null = null, bestVotes = -1;
    for (const [k, v] of Object.entries(candidateVotes)) if (v > bestVotes) { bestVotes = v; best = Number(k); }
    return bestVotes > 0 ? best : null;
  })();
  const total = totalVoters > 0 ? totalVoters : 1;

  /* â”€â”€ Live clock â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  const clock = now.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  /* ── Sub-components ─────────────────────────── */
  const Header = () => (
    <header className="no-print fixed top-0 left-0 w-full z-50 bg-surface/95 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-on-surface/15">
      <div className="h-16 max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between gap-4">
        <button onClick={resetToIdle} className="flex items-center gap-3 hover:opacity-85 transition-opacity" aria-label="Return to IDLE">
          <span className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-on-primary text-lg">how_to_vote</span>
          </span>
          <span className="flex flex-col text-left">
            <span className="font-serif-civic font-bold text-headline-sm leading-none text-on-surface">DVM-900</span>
            <span className="font-mono-civic text-xs md:text-xs uppercase tracking-widest text-on-surface-variant mt-1">Course Simulation Console</span>
          </span>
        </button>

        <nav className="hidden lg:flex items-center gap-1">
          {([['READY', 'Official Ballot'], ['VOTED', 'Audit Receipt'], ['DIAG', 'Diagnostics'], ['RESULT', 'Results']] as const).map(([s, label]) => (
            <button
              key={s}
              onClick={() => {
                if (s === 'DIAG') { setDiagOpen(true); return; }
                setDiagOpen(false); goTo(s);
              }}
              className={`px-3 py-1.5 font-mono-civic text-xs uppercase tracking-wider rounded transition-colors ${
                (s === 'DIAG' && diagOpen) || (s !== 'DIAG' && state === s)
                  ? 'bg-primary-container text-on-primary font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:flex flex-col">
            <span className="font-mono-civic font-bold text-xs text-on-surface leading-none tabular-nums">{clock}</span>
            <span className="font-mono-civic text-xs uppercase text-on-surface-variant mt-0.5">Classroom demo</span>
          </div>
          <button
            onClick={() => setOfficerOpen(true)}
            aria-label="Officer sign-in"
            className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-[2px_2px_0px_#1e1b17] active:translate-y-0.5 active:shadow-none transition-all"
          >
            <span className="material-symbols-outlined text-on-primary text-lg">person</span>
          </button>
          <button onClick={toggleDark} aria-label={dark ? 'Switch to daylight' : 'Switch to dark room'} title={dark ? 'Daylight mode' : 'Dark room mode'} className="w-9 h-9 rounded-full hover:bg-surface-container-high flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined text-on-surface text-xl">{dark ? 'light_mode' : 'dark_mode'}</span>
          </button>
        </div>
      </div>
    </header>
  );

  const StatusBar = () => (
    <div className="sticky top-16 z-40 no-print w-full bg-surface-container-high/90 backdrop-blur border-b border-on-surface/10 px-4 md:px-8 py-1.5 flex items-center justify-between gap-2 font-mono-civic text-xs md:text-xs uppercase tracking-wider text-on-surface-variant">
      <span className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full inline-block ${state === STATES.READY ? 'bg-secondary animate-blink' : state === STATES.VOTED ? 'bg-secondary' : 'bg-primary'}`} />
        <span className="text-on-surface font-bold">STATE {STATE_META[state].num} · {STATE_META[state].label}</span>
        <span className="hidden sm:inline opacity-70">{STATE_META[state].sub}</span>
      </span>
      <span className="flex items-center gap-3 shrink-0">
        <span className="hidden md:inline">NOT FOR OFFICIAL ELECTIONS</span>
        <span className="flex items-center gap-1 text-secondary font-bold"><span className="material-symbols-outlined text-xs">verified_user</span>DEMO</span>
      </span>
    </div>
  );

  const Footer = () => (
    <footer className="no-print w-full bg-surface-container-low border-t border-on-surface/15 mt-4">
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-12 flex items-center justify-between gap-3 font-mono-civic text-xs md:text-xs uppercase tracking-wider text-on-surface-variant">
        <span className="truncate">DVM-900 COURSE SIMULATION � NOT FOR OFFICIAL ELECTIONS</span>
        <span className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:inline">DEMO UNIT</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
            demo: no real seal
          </span>
          <button onClick={() => window.print()} className="flex items-center gap-1 hover:text-primary transition-colors"><span className="material-symbols-outlined text-xs align-[-2px]">print</span>PRINT</button>
        </span>
      </div>
    </footer>
  );

  /* ── RENDER ───────────────────────────────────── */
  return (
    <KineticGrid paused={state === STATES.IDLE}>
    <div className="relative min-h-screen text-on-surface font-sans pb-20 lg:pb-0 selection:bg-tertiary-fixed selection:text-on-tertiary-fixed" style={{ background: 'rgba(18,15,13,0.80)' }}>
      <a href="#ballot-console" className="skip-link">Skip to ballot console</a>

      <Header />
      <StatusBar />

      {/* Mobile bottom tab bar */}
      <nav className="no-print fixed bottom-0 left-0 w-full z-50 lg:hidden bg-surface/95 backdrop-blur border-t border-on-surface/15 h-16 flex items-center justify-around">
        {([['READY', 'ballot'], ['OFFICER', 'assignment_turned_in'], ['DIAG', 'receipt_long']] as const).map(([s, icon]) => (
          <button key={s} onClick={() => { if (s === 'OFFICER') { setOfficerOpen(true); } else if (s === 'DIAG') { setDiagOpen(true); } else { setDiagOpen(false); goTo('READY'); } }} className="flex flex-col items-center justify-center min-w-[64px] text-on-surface-variant" aria-label={s}>
            <span className="material-symbols-outlined text-xl">{icon}</span>
            <span className="font-mono-civic text-xs uppercase tracking-wider">{s === 'OFFICER' ? 'Officer' : s === 'DIAG' ? 'Audit' : 'Ballot'}</span>
          </button>
        ))}
      </nav>

      <main className="relative z-10 pt-16">

        {/* --------------- LANDING --------------- */}
        {state === STATES.IDLE && (
          <BackgroundPaths
            onStartVoting={() => scrollToId('ballot-console')}
            onOfficerSignIn={() => setOfficerOpen(true)}
          />
        )}

        {/* ═══════════════ ACTIVE BALLOT CONSOLE ═══════════════ */}
        {(state === STATES.IDLE || state === STATES.READY) && (
        <section id="ballot-console" className="relative">
          <div className="max-w-7xl mx-auto px-4 md:px-8 pb-6">
            <div className="border-2 border-on-surface bg-surface-container-low rounded-xl shadow-[4px_4px_0px_#1e1b17] overflow-hidden">
              {/* Console header */}
              <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b-2 border-on-surface/15 bg-surface-container">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-full bg-primary animate-blink shrink-0" />
                  <span className="font-serif-civic font-bold text-xl md:text-2xl text-on-surface truncate">DVM-900 CLASSROOM DEMO</span>
                </div>
                <span className="font-mono-civic text-xs md:text-sm uppercase bg-tertiary-fixed text-on-tertiary-fixed px-2 py-1 rounded-sm shadow-[2px_2px_0px_#1e1b17] font-bold shrink-0">SIM UNIT � BAY 01 READY</span>
              </div>

              <div className="grid lg:grid-cols-12 gap-4 p-4 md:p-6">
                {/* LEFT — Ballot sheet */}
                <div className="lg:col-span-8 flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 bg-surface-container-highest text-on-surface-variant font-mono-civic text-xs md:text-xs uppercase px-2 py-1 rounded-sm"><span className="material-symbols-outlined text-base">how_to_vote</span>CONTEST 02 OF 06 · KEYS 1–5 SELECT</span>
                    <span className="font-mono-civic text-xs md:text-xs text-on-surface-variant uppercase">GENERAL MUNICIPAL COUNCIL</span>
                  </div>
                  <h2 className="font-serif-civic font-bold text-4xl md:text-5xl text-on-surface leading-tight">Select one candidate.</h2>

                  {/* Session telemetry strip */}
                  <div className="bg-surface-container-high border border-on-surface/20 rounded-sm px-3 py-2 flex items-center justify-between gap-2 font-mono-civic text-xs md:text-xs uppercase text-on-surface-variant">
                    <span className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${state === STATES.READY ? 'bg-primary animate-blink' : 'bg-outline'}`} />Session {state === STATES.READY ? 'active' : 'standby'}</span>
                    <span className="flex items-center gap-1.5 font-bold text-primary"><span className="material-symbols-outlined text-base">timer</span>02:45 REMAINING</span>
                  </div>
                  {(state !== STATES.READY || !voterIdVerified) && (
                    <div className="bg-surface-container border border-on-surface/30 rounded-sm px-4 py-2.5 flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary text-xl shrink-0">info</span>
                      <span className="font-sans text-sm md:text-sm text-on-surface">{state !== STATES.READY
                        ? 'Machine in STANDBY — the election officer must arm the ballot (officer sign-in → PIN). You cannot cast a vote yet.'
                        : 'Enter your Voter ID / EPIC and complete Step 1 before keys will open.'}</span>
                    </div>
                  )}

                  {/* STEP 1 — Voter ID gate */}
                  <div className="bg-surface-container border border-on-surface/30 rounded-sm p-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-mono-civic text-sm md:text-base uppercase text-on-surface-variant tracking-widest">Step 1 of 2 � Voter ID / EPIC No.</span>
                      {voterIdVerified
                        ? <span className="font-mono-civic text-sm md:text-base font-bold text-secondary uppercase flex items-center gap-1.5"><span className="material-symbols-outlined text-xl">verified</span>BALLOT OPEN � ID VERIFIED</span>
                        : <span className="font-mono-civic text-sm md:text-sm text-on-surface-variant">Keys stay locked until ID verified + document uploaded</span>}
                    </div>
                    {!voterIdVerified && (
                      <div className="flex items-center gap-3 mt-2">
                        <input
                          value={voterId}
                          onChange={(e) => { setVoterId(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '')); setVoterIdError(''); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') verifyVoterId(); }}
                          maxLength={12}
                          placeholder="EPIC-000000"
                          aria-label="Voter ID"
                          style={{ fontSize: '1.25rem', padding: '12px 16px' }}
                          className="field w-44 md:w-60"
                        />
                        <FlowButton size="md" text="VERIFY" onClick={verifyVoterId} />
                </div>
                      )}
                    {voterIdError && <div role="alert" className="font-mono-civic text-sm md:text-base text-error uppercase mt-2">{voterIdError}</div>}

                    {/* STEP 1b � Voter ID document upload (required, one document = one vote) */}
                    <div className="mt-2 pt-2 border-t border-on-surface/15">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <label htmlFor="voter-doc" className="font-mono-civic text-sm md:text-base uppercase text-on-surface-variant tracking-widest">Upload Voter ID Card</label>
                        {voterIdFile
                          ? <span className="font-mono-civic text-xs md:text-sm font-bold text-secondary uppercase flex items-center gap-1.5"><span className="material-symbols-outlined text-lg">verified</span>ID DOC ACCEPTED</span>
                          : <span className="font-mono-civic text-xs md:text-sm text-on-surface-variant">Required � one document, one vote</span>}
                      </div>
                      {!voterIdFile && (
                        <input id="voter-doc" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={handleVoterIdFile} aria-label="Upload voter ID document" className="mt-2 block w-full text-sm md:text-base font-mono-civic text-on-surface-variant file:mr-4 file:px-4 file:py-2.5 file:rounded-sm file:border-2 file:border-on-surface file:bg-surface-container-high file:text-on-surface file:font-mono-civic file:text-xs md:file:text-sm file:uppercase file:cursor-pointer" />
                      )}
                      {voterIdFile && <div className="font-mono-civic text-xs md:text-sm text-on-surface mt-1.5 truncate">{voterIdFile.name} � {(voterIdFile.size / 1024).toFixed(0)} KB � hash {voterIdFile.hash.slice(0, 12)}�</div>}
                      {voterIdFileError && <div role="alert" className="font-mono-civic text-sm md:text-base text-error uppercase mt-1.5">{voterIdFileError}</div>}
                    </div>
                  </div>

                  {/* Candidate strips (perforated) */}
                  <div id="candidate-group" role="radiogroup" aria-label="Candidates" className="flex flex-col">
                    {CANDIDATES.map((c, idx) => {
                      const isSel = selectedId === c.id;
                      const disabled = voterHasVoted || state !== STATES.READY || !voterIdVerified;
                      return (
                        <React.Fragment key={c.id}>
                          {idx > 0 && (
                            <div className="flex items-center justify-between px-2 py-0.5 opacity-50 select-none" aria-hidden="true">
                              <span className="w-1.5 h-1.5 rounded-full bg-outline" />
                              <span className="flex-1 mx-2 border-t border-dashed border-outline" />
                              <span className="w-1.5 h-1.5 rounded-full bg-outline" />
                </div>
                            )}
                          <button
                            role="radio" aria-checked={isSel} disabled={disabled} onClick={() => selectCandidate(c.id)}
                            className={`w-full text-left rounded-sm border-2 p-2 md:p-3 flex items-center justify-between gap-2 md:gap-4 transition-all duration-150 ${
                              isSel ? 'border-on-surface bg-secondary-container/40 shadow-[2px_2px_0px_#1e1b17]' : 'border-on-surface/25 bg-surface-container-lowest hover:bg-surface-container'
                            } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer active:translate-x-0.5 active:translate-y-0.5'}`}
                          >
                            <div className="flex items-center gap-2 md:gap-3 min-w-0">
                              <div className={`w-10 h-10 md:w-12 md:h-12 rounded-sm flex items-center justify-center font-mono-civic font-bold text-base md:text-xl shrink-0 ${isSel ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface'}`}>{c.code}</div>
                              <div className="min-w-0">
                                <div className={`font-serif-civic font-bold text-base md:text-xl leading-tight truncate ${isSel ? 'text-on-surface' : 'text-on-surface'}`}>{c.name}</div>
                                <div className="font-sans text-xs md:text-sm text-on-surface-variant truncate">{c.party}</div>
                              </div>
                            </div>
                            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${isSel ? 'border-on-surface bg-primary-container' : 'border-outline-variant bg-surface-container'}`}>
                              {isSel && <span className="material-symbols-outlined text-on-primary text-lg md:text-xl">check</span>}
                            </div>
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* CLEAR / CONFIRM */}
                  <div className="flex items-stretch gap-2 mt-1">
                    <FlowButton size="md" text="CLEAR" onClick={clearSelection} disabled={voterHasVoted || state !== STATES.READY || !voterIdVerified} className="flex-1 justify-center" />
                    <FlowButton size="md" text="CONFIRM SELECTION" onClick={() => confirmThen('Cast this vote?', `You selected ${CANDIDATES.find(c => c.id === selectedId)?.name ?? 'UNKNOWN'}. The ballot cannot be changed or recalled.`, 'CAST VOTE', castBallot)} disabled={!canCast} className="flex-[2] justify-center font-extrabold" />
                  </div>
                </div>

                {/* RIGHT — Audit stub preview */}
                <aside className="lg:col-span-4 flex flex-col gap-3">
                  <div className="border-2 border-on-surface rounded-sm bg-surface-container px-4 py-3">
                    <div className="flex items-center justify-between border-b border-dashed border-on-surface/30 pb-2">
                      <span className="font-mono-civic text-xs md:text-sm font-bold uppercase text-on-surface">DEMO AUDIT STUB</span>
                      <span className="material-symbols-outlined text-secondary text-lg">verified</span>
                    </div>
                    <p className="font-mono-civic text-sm md:text-base text-on-surface-variant mt-2 uppercase">RECORDED SELECTION:</p>
                    <p className="font-serif-civic font-bold text-lg md:text-2xl text-on-surface">{selectedId !== null ? CANDIDATES.find(c => c.id === selectedId)?.name : 'PENDING VOTER INPUT'}</p>
                    <p className="font-mono-civic text-xs md:text-xs text-primary font-bold uppercase">{selectedId !== null ? CANDIDATES.find(c => c.id === selectedId)?.party : 'AWAITING STAMP'}</p>
                    <div className="mt-3 flex flex-col gap-1 font-mono-civic text-xs md:text-xs text-on-surface-variant">
                      <div className="flex justify-between"><span>DEMO POSITION:</span><span className="font-bold text-on-surface">TABLE-03</span></div>
                      <div className="flex justify-between"><span>CHECK:</span><span className="font-bold text-secondary">n/a (demo)</span></div>
                      <div className="flex justify-between"><span>LOG DIGEST:</span><span className="font-bold text-on-surface">(client-side)</span></div>
                    </div>
                    <div className="mt-3 bg-surface-container-high p-2 rounded-sm flex items-center gap-2 font-mono-civic text-xs md:text-xs text-on-surface-variant">
                      <span className="material-symbols-outlined text-primary text-lg">lock</span> Selection recorded (demo) only in this browser's localStorage.
                    </div>
                  </div>

                  <div className="border border-dashed border-on-surface/40 rounded-sm p-3 text-center">
                    <span className="material-symbols-outlined text-[44px] text-secondary">shield</span>
                    <p className="font-mono-civic text-xs md:text-xs font-bold uppercase text-on-surface">Classroom Demo</p>
                    <p className="font-sans text-xs md:text-xs text-on-surface-variant">Demo chit for the classroom prototype.</p>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </section>
        )}

        {/* ═══════════════ VOTED ═══════════════ */}
        {state === STATES.VOTED && (
          <section className="relative px-4 md:px-8 py-8">
            <div className="max-w-3xl mx-auto text-center border-2 border-on-surface rounded-xl bg-surface-container-low shadow-[4px_4px_0px_#1e1b17] p-6 md:p-8 relative overflow-hidden">
              <div aria-hidden="true" className="absolute -right-4 -top-8 font-serif-civic font-bold text-[110px] select-none opacity-10">03</div>
              <span className="inline-flex items-center gap-2 bg-surface-container-high px-3 py-1 rounded-sm font-mono-civic text-xs md:text-xs uppercase font-bold"><span className="w-2 h-2 rounded-full bg-primary animate-blink" />STATE 03 · RECORDED</span>
              <div className="stamp-double inline-flex flex-col items-center px-6 md:px-10 py-3 md:py-4 my-5 -rotate-2 select-none">
                <span className="font-serif-civic font-bold text-4xl md:text-6xl tracking-widest uppercase">RECORDED</span>
                <span className="font-mono-civic text-xs md:text-xs tracking-widest uppercase mt-1">IMMUTABLE ENTRY · T-MINUS 0</span>
              </div>
              <h1 className="font-serif-civic font-bold text-3xl md:text-4xl text-on-surface">Your vote is in.</h1>
              <p className="font-sans text-xs md:text-sm text-on-surface-variant max-w-md mx-auto mt-2 leading-relaxed">Nobody can see what you chose. Your selection has been encrypted and separated from your voter registration record.</p>
              <div className="flex items-center justify-center gap-2 mt-4 font-mono-civic text-xs md:text-xs text-on-surface-variant"><span className="material-symbols-outlined text-sm animate-spin" style={{ animationDuration: '4s' }}>hourglass_top</span>Session auto-resets in <span className="font-bold text-on-surface tabular-nums">{countdown}s</span></div>
              <div className="mt-5"><FlowButton size="md" text="RETURN TO TERMINAL STANDBY" onClick={resetToIdle} /></div>
            </div>
          </section>
        )}

        {/* ═══════════════ LOCKED ═══════════════ */}
        {state === STATES.LOCKED && (
          <section className="relative px-4 md:px-8 py-8">
            <div className="max-w-2xl mx-auto text-center border-2 border-on-surface rounded-xl bg-surface-container shadow-[4px_4px_0px_#1e1b17] p-6 md:p-8">
              <span className="inline-flex items-center gap-2 bg-error-container text-on-error-container px-3 py-1 rounded-sm font-mono-civic text-xs md:text-xs uppercase font-bold"><span className="material-symbols-outlined text-sm">lock</span>STATE 04 · CLOSED (demo)</span>
              <div className="w-28 h-28 md:w-32 md:h-32 mx-auto rounded-full border-4 border-double border-primary flex flex-col items-center justify-center my-5">
                <span className="material-symbols-outlined text-primary text-[44px] md:text-[52px]">lock</span>
                <span className="font-mono-civic text-xs md:text-xs font-bold text-primary uppercase tracking-widest">PAUSED</span>
              </div>
              <h1 className="font-serif-civic font-bold text-3xl md:text-4xl text-on-surface">Voting closed.<br />Run paused.</h1>
              <p className="font-sans text-xs md:text-sm text-on-surface-variant max-w-md mx-auto mt-2 leading-relaxed">All simulated ballot keys are disabled. In the real world, an election official — not a webpage — pauses polling. This is a course prototype.</p>
              <div className="mt-5"><FlowButton size="md" text="OFFICER SIGN-IN TO REOPEN" onClick={() => setOfficerOpen(true)} /></div>
            </div>
          </section>
        )}

        {/* ═══════════════ RESULTS & TALLY ═══════════════ */}
        {state === STATES.RESULT && (
          <section className="relative px-4 md:px-8 py-8">
            <div className="max-w-4xl mx-auto border-2 border-on-surface rounded-xl bg-surface-container-low shadow-[4px_4px_0px_#1e1b17] overflow-hidden">
              {auditTampered ? (
                <div className="p-6">
                  <div className="bg-error-container text-on-error-container px-4 py-5 rounded-sm border-l-4 border-error">
                    <h2 className="font-serif-civic font-bold text-xl md:text-2xl uppercase tracking-tight">Audit chain FAILED</h2>
                    <p className="font-sans text-sm md:text-base mt-3">Local tally and audit log do not match the hash chain. Do not trust the numbers on this screen. An election officer must reset this demo before the next session.</p>
                    <p className="font-mono-civic text-xs uppercase mt-4 opacity-80">CODE: AUDIT_CHAIN_TAMPERED</p>
                  </div>
                </div>
              ) : (
              <>
              <div className="bg-surface-container-high px-5 py-3 border-b-2 border-on-surface/15 flex items-center justify-between gap-2">
                <span className="font-serif-civic font-bold text-base md:text-xl text-on-surface">DEMO SPOOL // CLASSROOM</span>
                <span className="font-mono-civic text-xs md:text-xs uppercase text-on-surface-variant">POLLS CLOSED · FINAL</span>
              </div>
              <div className="p-5 md:p-6">
                <div className="flex items-center gap-3 bg-surface-container border border-on-surface/30 rounded-sm px-4 py-3 mb-4">
                  <span className="material-symbols-outlined text-secondary text-[28px]">receipt_long</span>
                  <div>
                    <div className="font-mono-civic text-xs uppercase text-on-surface-variant">Total accumulated ballots</div>
                    <div className="font-serif-civic font-bold text-xl md:text-2xl text-on-surface">{totalVoters} RECORDED</div>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {CANDIDATES.map((c) => {
                    const v = candidateVotes[c.id] ?? 0;
                    const pct = totalVoters > 0 ? (v / totalVoters) * 100 : 0;
                    const isWinner = winnerId === c.id;
                    return (
                      <div key={c.id} className={`flex items-center gap-3 p-2.5 md:p-3 border-2 rounded-sm ${isWinner ? 'border-on-surface bg-tertiary-fixed/30' : 'border-on-surface/20 bg-surface-container-lowest'}`}>
                        <span className="font-mono-civic font-bold text-xs md:text-xs w-7 h-7 flex items-center justify-center bg-surface-container-high rounded-sm">{c.code}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap"><span className="font-serif-civic font-bold text-xs md:text-sm text-on-surface">{c.name}</span>{isWinner && <span className="font-mono-civic text-xs font-bold bg-tertiary-fixed text-on-tertiary-fixed px-1.5 py-0.5 rounded-sm shadow-[1px_1px_0px_#1e1b17]">WINNER</span>}</div>
                          <div className="w-full h-2 bg-surface-container-highest rounded-full mt-1 overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} /></div>
                        </div>
                        <div className="text-right shrink-0"><div className="font-serif-civic font-bold text-base md:text-lg text-on-surface">{v}</div><div className="font-mono-civic text-xs md:text-xs text-on-surface-variant">{pct.toFixed(1)}%</div></div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <FlowButton size="sm" text="PRINT PAPER TAPE" onClick={() => setPrintClicked(!printClicked)} />
                  <FlowButton size="sm" text="CLOSE AUDIT LOG (demo)" onClick={() => confirmThen('Delete the demo audit log?', 'Demo only: marks the demo tape done. Nothing official exists.', 'CLOSE & LOG', () => setSealClicked(true))} />
                  <FlowButton size="sm" text="COPY TALLY" onClick={() => copyText(`DVM-900 TALLY · ${LAST_UPDATED} · DEMO\nTotal ballots: ${totalVoters}\n${CANDIDATES.map(c => `${c.code} ${c.name}: ${candidateVotes[c.id] ?? 0}`).join('\n')}`, 'Tally copied')} />
                </div>
                {sealClicked && <p className="font-mono-civic text-xs text-secondary font-bold uppercase mt-2">DEMO LOG CLOSED — nothing official was sealed</p>}
                <div className="mt-3"><FlowButton size="md" text="RETURN TO TERMINAL STANDBY" onClick={resetToIdle} className="w-full justify-center" /></div>
              </div>
              </>
              )}
            </div>
          </section>
        )}

        {/* ═══════════════ FAQ ═══════════════ */}
        <section id="faq" className="relative">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-5 md:py-8">
            <details className="border-2 border-on-surface/60 rounded-sm bg-surface-container-low">
              <summary className="cursor-pointer select-none px-5 md:px-6 py-4 md:py-5 flex items-center justify-between font-serif-civic font-bold text-lg md:text-2xl text-on-surface">Election Official FAQ<span className="material-symbols-outlined text-[26px] md:text-[32px]">expand_more</span></summary>
              <div className="px-5 md:px-6 pb-5 md:pb-6 grid md:grid-cols-2 gap-3 md:gap-4 font-sans text-sm md:text-base text-on-surface-variant">
                {[
                  ['Why does the machine have no network port?', 'Simulation only � there is no network at all in this demo. Everything (votes, audit log) lives in the browser\'s localStorage on this device.'],
                  ['How would the paper audit work?', 'In real hardware (VVPAT), every ballot stamps a paper slip for voter inspection before it drops into a sealed hopper. Here we have no printer; this step is simulated.'],
                  ['What happens if power fails mid-poll?', 'In this simulation nothing fails: state is in memory + encrypted localStorage, so a refresh or crash leaves the FSM intact. Real EVMs use battery + sealed registers.'],
                  ['Can one person vote twice?', 'In this demo the ballot locks after one cast (per browser profile) and the voter-ID hash blocks a repeat of the same EPIC on this device. That is demonstration-only enforcement, not a voter roll.'],
                  ['Who can see the running tally?', 'In this demo: whoever opens dev tools. Real deployments keep the tally sealed in the machine and release it only after close + official audit. This is a course prototype.'],
                ].map(([q, a], i) => (
                  <div key={i} className="border border-on-surface/20 rounded-sm p-4 md:p-5 bg-surface-container-lowest">
                    <p className="font-mono-civic text-xs md:text-sm font-bold text-on-surface leading-snug">{q}</p>
                    <p className="mt-2 leading-relaxed">{a}</p>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </section>

      </main>

      {/* ═══════════════ OFFICER OVERLAY — Station Administration ═══════════════ */}
      {officerOpen && (
        <div className="fixed inset-0 z-[55] bg-on-surface/60 backdrop-blur-sm overflow-y-auto pt-16" onClick={() => setOfficerOpen(false)} role="dialog" aria-modal="true" aria-label="Officer controls" ref={officerDialogRef}>
          <div className="max-w-6xl mx-auto px-4 md:px-6 pb-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b-2 border-surface/30 pb-2 mb-3">
              <div>
                <p className="font-mono-civic text-xs md:text-xs uppercase text-tertiary-fixed tracking-widest">FORM SEC-88 · DVM TERMINAL OPERATOR</p>
                <h2 className="font-serif-civic font-bold text-xl md:text-3xl text-surface">Station Administration.</h2>
              </div>
              <button onClick={() => setOfficerOpen(false)} aria-label="Close officer panel" className="w-11 h-11 rounded-sm bg-surface text-on-surface flex items-center justify-center border-2 border-surface shadow-[2px_2px_0px_rgba(0,0,0,0.3)]"><span className="material-symbols-outlined">close</span></button>
            </div>

            <div className="grid lg:grid-cols-12 gap-4">
              {/* LEFT — PIN authentication register */}
              <div className="lg:col-span-5 border-2 border-on-surface bg-surface-container-low rounded-sm shadow-[4px_4px_0px_#000] p-4 md:p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono-civic text-xs md:text-xs uppercase text-on-surface-variant">PIN Register Entry</span>
                  <button onClick={() => setPinVisible(v => !v)} aria-pressed={pinVisible} aria-label={pinVisible ? 'Hide PIN' : 'Show PIN'} className="flex items-center gap-1 font-mono-civic text-xs md:text-xs uppercase text-on-surface-variant hover:text-primary transition-colors"><span className="material-symbols-outlined text-sm">{pinVisible ? 'visibility_off' : 'visibility'}</span>{pinVisible ? 'HIDE' : 'SHOW'}</button>
                </div>
                <div className="grid grid-cols-4 gap-2 my-3">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="h-14 md:h-16 rounded-sm border-2 border-on-surface/40 bg-surface-container-highest flex items-center justify-center shadow-inner">
                      <span className="font-mono-civic font-bold text-2xl md:text-3xl text-on-surface">{pinVisible ? (pin[i] || '') : (pin[i] ? '•' : '')}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  {[0, 1, 2].map(i => (
                    <span key={i} className={`w-3 h-3 rounded-full border border-on-surface/50 ${i < (3 - pinFailCount) ? 'bg-secondary' : 'bg-error'}`} />
                  ))}
                  <span className="font-mono-civic text-xs text-on-surface-variant uppercase">{3 - pinFailCount}/3 attempts</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
                    <button key={d} onClick={() => handlePinDigit(String(d))} className="h-12 md:h-14 bg-surface-container-high hover:bg-surface-container-highest active:translate-y-0.5 border border-on-surface/30 rounded-sm font-mono-civic font-bold text-base md:text-lg text-on-surface">{d}</button>
                  ))}
                  <button onClick={clearPin} className="h-12 md:h-14 bg-error-container active:translate-y-0.5 rounded-sm font-mono-civic font-bold text-xs text-on-error-container border border-on-error-container">CLR</button>
                  <button onClick={() => handlePinDigit('0')} className="h-12 md:h-14 bg-surface-container-high hover:bg-surface-container-highest active:translate-y-0.5 border border-on-surface/30 rounded-sm font-mono-civic font-bold text-base md:text-lg">0</button>
                  <button onClick={submitPin} disabled={pinLockUntil > Date.now()} className="h-12 md:h-14 bg-primary-container active:translate-y-0.5 rounded-sm font-mono-civic font-bold text-xs md:text-xs text-on-primary-container">ENT</button>
                </div>
                {pinError === 'LOCKOUT' ? <div role="alert" className="mt-2 font-mono-civic text-xs font-bold text-error uppercase">KEYPAD LOCKED — 30S BACKOFF</div> : pinError ? <div role="alert" className="mt-2 font-mono-civic text-xs font-bold text-error uppercase">{pinError}</div> : null}
                <p className="mt-2 font-mono-civic text-xs md:text-xs text-on-surface-variant uppercase">Default PIN 1234 · 3 attempts → 30s lockout · Auto-relock after 5 min idle</p>
                <p className="mt-1 font-mono-civic text-xs md:text-xs text-on-surface-variant uppercase">Keyboard: 1-9 · 0 · Backspace = clear · Enter = enter · Esc = close</p>
              </div>

              {/* RIGHT — Operations cards */}
              <div className="lg:col-span-7 flex flex-col gap-3">
                {/* Op 1 — Open ballot */}
                <div className="border-2 border-on-surface rounded-sm bg-surface-container p-4 md:p-5 relative shadow-[4px_4px_0px_#000]">
                  <span className="absolute top-2 right-2 font-mono-civic text-xs md:text-xs font-bold border-2 border-secondary text-secondary px-2 py-0.5 rotate-3 uppercase">READY</span>
                  <div className="flex items-center gap-2 mb-2"><span className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center font-mono-civic text-xs font-bold">1</span><h3 className="font-serif-civic font-bold text-base md:text-xl text-on-surface">Open ballot</h3></div>
                  <p className="font-sans text-xs md:text-xs text-on-surface-variant max-w-md">Authorize and issue one single-use encrypted ballot sheet for the next waiting voter.</p>
                  <div className="mt-3"><FlowButton size="md" text="RELEASE NEXT BALLOT" onClick={submitPin} className="w-full justify-center font-extrabold" /></div>
                  <p className="font-mono-civic text-xs md:text-xs text-on-surface-variant text-center mt-1.5 uppercase">Issues a demo ballot sheet · </p>
                </div>

                {/* Op 2 — Close election */}
                <div className="border-2 border-on-surface rounded-sm bg-surface-container p-4 md:p-5 shadow-[4px_4px_0px_#000]">
                  <div className="flex items-center gap-2 mb-2"><span className="w-6 h-6 rounded-full bg-on-surface text-surface flex items-center justify-center font-mono-civic text-xs font-bold">2</span><h3 className="font-serif-civic font-bold text-base md:text-xl text-on-surface">Close election</h3></div>
                  <p className="font-sans text-xs md:text-xs text-on-surface-variant max-w-md">Demo only: disables voting in this simulation.</p>
                  <div className="mt-3"><FlowButton size="md" text="CLOSE VOTING (demo)" onClick={() => confirmThen('Seal the election?', 'Demo only: voting is disabled in this simulation. Nothing is mechanically sealed anywhere � this is a course prototype.', 'SEAL & LOCK', () => { goTo(STATES.LOCKED); setOfficerOpen(false); notify('Simulated election closed and sealed'); })} className="w-full justify-center font-extrabold text-error" /></div>
                </div>

                {/* Op 3 — Results */}
                <div className="border-2 border-on-surface rounded-sm bg-surface-container p-4 md:p-5 shadow-[4px_4px_0px_#000]">
                  <div className="flex items-center justify-between gap-2 mb-2"><div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-on-surface-variant text-surface flex items-center justify-center font-mono-civic text-xs font-bold">3</span><h3 className="font-serif-civic font-bold text-base md:text-xl text-on-surface">View results</h3></div><span className="font-mono-civic text-xs md:text-xs uppercase text-on-surface-variant bg-surface-variant px-2 py-0.5 rounded-sm">INTERLOCKED</span></div>
                  <p className="font-sans text-xs md:text-xs text-on-surface-variant max-w-md">Shows the classroom demo tally sheet (not official, not cryptographic).</p>
                  <div className="mt-3"><FlowButton size="md" text="OPEN TALLY &amp; AUDIT REGISTER" onClick={() => { goTo(STATES.RESULT); setOfficerOpen(false); }} className="w-full justify-center" /></div>
                </div>

                {/* Change PIN */}
                <div className="border-2 border-on-surface/40 rounded-sm bg-surface-container-low p-4">
                  {!pinChangeOpen ? (
                    <div className="flex justify-center"><FlowButton size="sm" text="CHANGE OFFICER PIN" onClick={() => setPinChangeOpen(true)} /></div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <span className="font-mono-civic text-xs uppercase text-on-surface-variant">Change officer PIN (4–8 digits)</span>
                      <input type="password" inputMode="numeric" autoComplete="off" value={pinChangeCurrent} onChange={e => { setPinChangeCurrent(e.target.value.replace(/\D/g, '').slice(0, 8)); setPinChangeError(''); }} placeholder="Current PIN" className="field" aria-label="Current officer PIN" />
                      <input type="password" inputMode="numeric" autoComplete="off" value={pinChangeNew} onChange={e => { setPinChangeNew(e.target.value.replace(/\D/g, '').slice(0, 8)); setPinChangeError(''); }} placeholder="New PIN" className="field" aria-label="New officer PIN" />
                      {pinChangeError && <span role="alert" className="font-mono-civic text-xs font-bold text-error uppercase">{pinChangeError}</span>}
                      <div className="flex gap-1.5"><FlowButton size="sm" text="CANCEL" onClick={() => { setPinChangeOpen(false); setPinChangeCurrent(''); setPinChangeNew(''); setPinChangeError(''); }} className="flex-1 justify-center" /><FlowButton size="sm" text="SAVE PIN" onClick={changePinHash} className="flex-1 justify-center" /></div>
                    </div>
                  )}
                </div>

                {/* Audit register tail */}
                <div className="border-2 border-on-surface/40 rounded-sm bg-surface-container-lowest p-3 max-h-40 overflow-y-auto">
                  <p className="font-mono-civic text-xs md:text-xs uppercase text-on-surface-variant mb-1">Audit register · last entries</p>
                  <div className="font-mono text-xs md:text-xs text-on-surface-variant space-y-0.5">
                    {auditLog.length === 0 && <div>No entries yet this session.</div>}
                    {auditLog.slice(-6).map((line, i) => (<div key={i} className="truncate" title={`${line.ts} ${line.event} ${line.detail}`}>[{line.ts}] {line.event}{line.detail ? ` — ${line.detail}` : ''}</div>))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ DIAGNOSTICS OVERLAY ═══════════════ */}
      {diagOpen && (
        <div className="fixed inset-0 z-[54] bg-on-surface/60 backdrop-blur-sm overflow-y-auto pt-16" onClick={() => setDiagOpen(false)} role="dialog" aria-modal="true" aria-label="Hardware diagnostics" ref={diagDialogRef}>
          <div className="max-w-4xl mx-auto px-4 md:px-6 pb-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b-2 border-surface/30 pb-2 mb-3">
              <div>
                <p className="font-mono-civic text-xs md:text-xs uppercase text-tertiary-fixed tracking-widest">STATE 06 · CALIBRATION BUS</p>
                <h2 className="font-serif-civic font-bold text-xl md:text-3xl text-surface">Bench test the machine.</h2>
              </div>
              <button onClick={() => setDiagOpen(false)} aria-label="Close diagnostics" className="w-11 h-11 rounded-sm bg-surface text-on-surface flex items-center justify-center border-2 border-surface"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="grid md:grid-cols-12 gap-4">
              <div className="md:col-span-5 border-2 border-on-surface bg-surface-container-low rounded-sm p-4 shadow-[4px_4px_0px_#000]">
                <p className="font-mono-civic text-xs md:text-xs uppercase text-on-surface-variant mb-2">Rotary test-harness selector</p>
                <div className="flex flex-col gap-1.5">
                  {['SOLENOID FORCE', 'DIODE LATTICE', 'PAPER FEED CALIPER', 'TAMPER BUS CIRCUIT', 'LED LATTICE', 'BATTERY TRICKLE'].map(t => (
                    <button key={t} onClick={() => setDiagTest(t)} className={`text-left px-3 py-2 rounded-sm border-2 font-mono-civic text-xs md:text-xs uppercase flex items-center justify-between transition-colors ${diagTest === t ? 'border-on-surface bg-secondary-container/40' : 'border-on-surface/25 bg-surface-container-lowest hover:bg-surface-container'}`}><span>{t}</span><span className="material-symbols-outlined text-sm">{diagTest === t ? 'radio_button_checked' : 'radio_button_unchecked'}</span></button>
                  ))}
                </div>
                <div className="mt-3"><FlowButton size="sm" text={selfTestRunning ? 'RUNNING SELF-TEST…' : 'RUN COMPREHENSIVE SELF-TEST'} onClick={runSelfTest} disabled={selfTestRunning} className="w-full justify-center" /></div>
              </div>
              <div className="md:col-span-7 flex flex-col gap-3">
                <div className="border-2 border-on-surface bg-on-surface rounded-sm p-4 text-surface shadow-[4px_4px_0px_#000]">
                  <div className="flex items-center justify-between mb-2"><span className="font-mono-civic text-xs md:text-xs uppercase text-tertiary-fixed">{diagTest}</span><span className="font-mono-civic text-xs md:text-xs uppercase text-secondary-fixed">WITHIN TOLERANCE</span></div>
                  <div className="font-mono-civic text-xs uppercase text-surface/70 mb-1">Actuation force</div>
                  <div className="flex items-end justify-between mb-1"><span className="font-mono text-lg text-tertiary-fixed">4.2 <span className="text-xs">N</span></span><span className="font-mono-civic text-xs text-surface/50">SPEC 3.8–4.6 N</span></div>
                  <div className="w-full h-3 bg-black/50 rounded-full overflow-hidden"><div className="h-full bg-tertiary-fixed" style={{ width: '62%' }} /></div>
                  <div className="grid grid-cols-10 gap-1 mt-3">
                    {Array.from({ length: 20 }).map((_, i) => (<div key={i} className="h-5 rounded-sm bg-secondary-fixed flex items-center justify-center"><span className="font-mono text-xs font-bold text-on-secondary-fixed">D{i + 1}</span></div>))}
                  </div>
                  <p className="font-mono-civic text-xs md:text-xs uppercase text-surface/70 mt-2">LED / diode lattice — 20/20 conducting</p>
                </div>
                <div className="border-2 border-on-surface bg-on-surface rounded-sm p-3 flex-1 min-h-[7rem] shadow-[4px_4px_0px_#000]">
                  <div className="flex items-center justify-between mb-1"><span className="font-mono-civic text-xs uppercase text-tertiary-fixed">Diagnostic event log</span><button onClick={() => confirmThen('Purge diagnostic log?', 'All bench-test entries will be erased from the view. The physical machine audit register is unaffected.', 'PURGE', () => setDiagLog([]))} className="font-mono-civic text-xs md:text-xs uppercase text-surface/50 hover:text-surface">PURGE</button></div>
                  <div className="font-mono text-xs md:text-xs text-secondary-fixed space-y-0.5 max-h-36 overflow-y-auto">
                    {diagLog.length === 0 && <div>[LOG EMPTY]</div>}
                    {diagLog.map((line, i) => (<div key={i}>{line}</div>))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ SEARCH OVERLAY ═══════════════ */}
      {searchOpen && (
        <div className="fixed inset-0 z-[58] bg-on-surface/70 backdrop-blur-sm pt-20 px-4" onClick={() => setSearchOpen(false)} role="dialog" aria-label="Site search" ref={searchDialogRef}>
          <div className="max-w-xl mx-auto bg-surface-container-low border-2 border-on-surface rounded-sm shadow-[4px_4px_0px_#000] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-on-surface/20">
              <span className="material-symbols-outlined text-primary">search</span>
              <input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && searchResults[0]) runSearch(searchResults[0]); if (e.key === 'Escape') setSearchOpen(false); }} placeholder="Search pages, states, actions…" className="flex-1 bg-transparent outline-none font-mono-civic text-sm text-on-surface placeholder-on-surface-variant" aria-label="Search query" />
              <kbd className="font-mono-civic text-xs text-on-surface-variant bg-surface-container-high px-1.5 py-0.5 rounded-sm">ESC</kbd>
            </div>
            <ul className="max-h-72 overflow-y-auto py-2">
              {searchResults.length === 0 && <li className="px-4 py-3 font-mono-civic text-xs uppercase text-on-surface-variant">No matches for “{searchQuery}”</li>}
              {searchResults.map((r, i) => (
                <li key={i}><button onClick={() => runSearch(r)} className="w-full text-left px-4 py-2 font-sans text-xs text-on-surface hover:bg-secondary-container/40 flex items-center gap-2 transition-colors"><span className="material-symbols-outlined text-sm text-outline">subdirectory_arrow_right</span>{r.label}</button></li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ═══════════════ COOKIE BANNER ═══════════════ */}
      {!cookieConsent && (
        <div className="no-print fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-[52] w-[min(94vw,36rem)] bg-on-surface text-surface rounded-sm border border-surface/20 shadow-[4px_4px_0px_#000] p-3 flex flex-col sm:flex-row sm:items-center gap-2" role="region" aria-label="Cookie notice">
          <p className="font-sans text-xs sm:text-xs leading-snug flex-1">One local-storage key (<code className="text-tertiary-fixed">dvm_cookie</code>) remembers this choice. Vote records never leave this machine.</p>
          <div className="flex gap-1.5 shrink-0"><FlowButton size="sm" text="DECLINE" onClick={() => acceptCookie('declined')} /><FlowButton size="sm" text="ACCEPT" onClick={() => acceptCookie('accepted')} /></div>
        </div>
      )}

      {/* ═══════════════ PRINT-ONLY ELECTION SUMMARY ═══════════════ */}
      <div className="print-only" aria-hidden="true">
        <h1>DVM-900 — Official Tally Summary</h1>
        <p>Precinct 04-A · Rev C.3 · Generated {LAST_UPDATED}</p>
        <table border={1} cellPadding={6} style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr><th>Slot</th><th>Candidate</th><th>Votes</th><th>Share</th></tr></thead>
          <tbody>{CANDIDATES.map(c => { const v = candidateVotes[c.id] ?? 0; return <tr key={c.id}><td>{c.code}</td><td>{c.name}</td><td>{v}</td><td>{totalVoters > 0 ? ((v / totalVoters) * 100).toFixed(1) + '%' : '0.0%'}</td></tr>; })}</tbody>
        </table>
        <p>Total ballots recorded: {totalVoters}</p>
        <p>checksum (demo, not verified)</p>
        <p>Simulated printout for the demo � no real hardware standard applies.</p>
      </div>

      {/* ═══════════════ BACK TO TOP ═══════════════ */}
      {scrollY > 300 && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to top" className="no-print fixed bottom-24 lg:bottom-24 right-4 z-[48] w-12 h-12 rounded-full bg-on-surface text-surface flex items-center justify-center shadow-[2px_2px_0px_#000]"><span className="material-symbols-outlined">arrow_upward</span></button>
      )}

      {/* ═══════════════ FLOATING CONTACT BUTTON ═══════════════ */}
      <button onClick={() => { setContactOpen(true); setContactStatus('idle'); }} aria-label="Contact the election board" className="no-print fixed bottom-20 lg:bottom-6 right-4 z-[48] w-14 h-14 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shadow-[3px_3px_0px_#000]"><span className="material-symbols-outlined text-[26px]">mail</span></button>

      {/* ═══════════════ CONFIRMATION MODAL ═══════════════ */}
      {confirmCfg && (
        <div className="fixed inset-0 z-[56] flex items-center justify-center bg-on-surface/70 backdrop-blur-sm p-4" onClick={() => setConfirmCfg(null)} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" ref={confirmDialogRef}>
          <div className="w-full max-w-sm bg-surface-container-low border-2 border-primary rounded-sm shadow-[5px_5px_0px_#000] p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2"><span className="material-symbols-outlined text-primary">warning</span><h3 id="confirm-title" className="font-serif-civic font-bold text-base text-on-surface">{confirmCfg.title}</h3></div>
            <p className="font-sans text-xs md:text-xs text-on-surface-variant leading-snug">{confirmCfg.body}</p>
            <div className="flex gap-2 mt-3"><FlowButton size="sm" text="CANCEL" onClick={() => setConfirmCfg(null)} className="flex-1 justify-center" /><FlowButton size="sm" text={confirmCfg.confirmLabel} onClick={() => { const fn = confirmCfg.onConfirm; setConfirmCfg(null); fn(); }} className="flex-1 justify-center" /></div>
          </div>
        </div>
      )}

      {/* ═══════════════ CONTACT / FEEDBACK MODAL ═══════════════ */}
      {contactOpen && (
        <div className="fixed inset-0 z-[56] flex items-end sm:items-center justify-center bg-on-surface/70 backdrop-blur-sm p-4" onClick={() => setContactOpen(false)} role="dialog" aria-modal="true" aria-label="Contact the election board" ref={contactDialogRef}>
          <div className="w-full max-w-md bg-surface-container-low border-2 border-on-surface rounded-sm shadow-[5px_5px_0px_#000] p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2 border-b-2 border-on-surface/15 pb-2">
              <div className="flex items-center gap-2"><span className="material-symbols-outlined text-secondary">mark_email_read</span><span className="font-mono-civic text-xs font-bold uppercase text-on-surface">Demo Inbox</span></div>
              <button onClick={() => setContactOpen(false)} aria-label="Close contact form" className="w-9 h-9 rounded-sm bg-surface-container-high flex items-center justify-center"><span className="material-symbols-outlined text-base">close</span></button>
            </div>
            {contactStatus === 'success' ? (
              <div className="flex flex-col items-center text-center py-6 gap-2">
                <span className="material-symbols-outlined text-[56px] text-secondary">task_alt</span>
                <h4 className="font-serif-civic font-bold text-lg text-on-surface">Message logged.</h4>
                <p className="font-sans text-xs text-on-surface-variant">Sent to the course demo inbox. Nobody real will review it.</p>
                <div className="mt-2"><FlowButton size="md" text="DONE" onClick={() => setContactOpen(false)} /></div>
              </div>
            ) : (
              <form onSubmit={submitContact} noValidate>
                <label className="font-mono-civic text-xs uppercase text-on-surface-variant" htmlFor="contact-name">Full name</label>
                <input id="contact-name" value={contactName} onChange={e => setContactName(e.target.value)} className="field mt-0.5 mb-2" placeholder="Jordan Reyes" autoComplete="name" />
                <label className="font-mono-civic text-xs uppercase text-on-surface-variant" htmlFor="contact-email">Email</label>
                <input id="contact-email" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className="field mt-0.5 mb-2" placeholder="officer@example.com" autoComplete="email" />
                <label className="font-mono-civic text-xs uppercase text-on-surface-variant" htmlFor="contact-message">Message</label>
                <textarea id="contact-message" value={contactMessage} onChange={e => setContactMessage(e.target.value)} rows={3} className="field mt-0.5" placeholder="What should the board know about this terminal? (or attach a document below)" />
                {/* Attachment � manual text OR document upload, both supported */}
                <input id="contact-file" type="file" className="hidden" accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.png,.jpg,.jpeg" onChange={e => { const f = e.target.files?.[0]; if (f) { setContactAttachment({ name: f.name, size: f.size }); setContactError(''); } e.target.value = ''; }} />
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  <label htmlFor="contact-file" className="px-3 py-2 border-2 border-on-surface rounded-sm bg-surface-container-high hover:bg-surface-container-highest font-mono-civic text-xs md:text-xs uppercase cursor-pointer flex items-center gap-1.5 transition-colors"><span className="material-symbols-outlined text-sm">attach_file</span>ATTACH DOCUMENT</label>
                  {contactAttachment && (
                    <span className="font-mono text-xs md:text-xs text-secondary truncate max-w-[60%]" title={contactAttachment.name}>
                      {contactAttachment.name} � {Math.max(1, Math.round(contactAttachment.size / 1024))}KB
                      <button type="button" onClick={() => setContactAttachment(null)} aria-label="Remove attachment" className="text-error ml-1.5 font-bold align-middle">?</button>
                    </span>
                  )}
                </div>
                {uploadedDocs.length > 0 && (
                  <p className="mt-1.5 font-mono-civic text-xs md:text-xs uppercase text-on-surface-variant">Uploaded on this terminal: {uploadedDocs.slice(0, 3).map(d => d.name).join(', ')}</p>
                )}
                {contactStatus === 'error' && (
                  <div role="alert" className="flex items-center gap-1.5 mt-2 bg-error-container border border-on-error-container rounded-sm px-2 py-1.5">
                    <span className="material-symbols-outlined text-sm text-on-error-container">error</span>
                    <span className="font-sans text-xs text-on-error-container">{contactError}</span>
                  </div>
                )}
                <div className="mt-3"><FlowButton size="md" text="SEND TO DEMO INBOX" type="submit" className="w-full justify-center" /></div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ TOAST ═══════════════ */}
      {toast && (
        <div role="status" className="no-print fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-[57] px-4 py-2 bg-on-surface text-surface font-mono-civic text-xs md:text-xs uppercase tracking-wider shadow-[2px_2px_0px_#000] whitespace-nowrap rounded-sm">{toast}</div>
      )}

      <Footer />
    </div>
    </KineticGrid>
  );
}

