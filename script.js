/**
 * Cold Call Finder — Main Application Script (Korrigiert & Verbessert v3)
 * 
 * AENDERUNGEN:
 * 1. Bugfix: "aa is not defined" in renderTable() Sortierung behoben
 * 2. Dashboard zeigt jetzt immer die aktuell gefilterte Anzahl
 * 3. Kostenlose Datei-Speicherung (JSON Export/Import) hinzugefuegt
 * 4. localStorage bleibt als primaerer kostenloser Speicher
 * 5. Bessere deutsche Uebersetzungen
 */

const PASSWORD = '26.Af.10';
const STORAGE_KEY = 'coldcallfinder_data';
const STORAGE_AUTH = 'coldcallfinder_auth';
const STORAGE_HISTORY = 'coldcallfinder_history';
const STORAGE_PROVIDER = 'coldcallfinder_provider';
const STORAGE_FILTERS = 'coldcallfinder_filters';
const STORAGE_JSONBIN_KEY = 'coldcallfinder_jsonbin_key';
const STORAGE_JSONBIN_ID = 'coldcallfinder_jsonbin_id';

const JSONBIN_API = 'https://api.jsonbin.io/v3';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OVERPASS_BACKUP = 'https://overpass.kumi.systems/api/interpreter';

let leads = [];
let userLocation = null;
let locationName = '';
let isSearching = false;
let searchProvider = 'osm';
let activeDashboardFilter = '';
let history = [];
let jsonbinKey = '';
let jsonbinId = '';
let lastSyncTime = 0;
let currentBatchId = 0;

const $ = (id) => document.getElementById(id);

const NICHE_CATALOG = {
    'Essen & Trinken': ['restaurant','fast food','cafe','bar','pub','biergarten','ice cream','bakery','butcher','convenience','supermarket','food court','kitchen'],
    'Gesundheit': ['dentist','doctor','clinic','hospital','pharmacy','veterinary','nursing home','social facility'],
    'Beauty & Wellness': ['hairdresser','beauty','spa','sauna','massage','yoga','nail salon','tanning','tattoo','piercing'],
    'Fitness & Sport': ['gym','fitness','sports centre','swimming pool','bowling','skating','ice rink','golf course','mini golf','stadium','dance','martial arts','climbing','tennis'],
    'Automobil': ['car repair','mechanic','car wash','fuel','charging station','car rental','car sharing','tyres','motorcycle','truck'],
    'Professionelle Dienstleistungen': ['lawyer','attorney','accountant','real estate','insurance','bank','notary','architect','consulting','marketing'],
    'Heimwerker & Handwerk': ['plumber','electrician','roofer','carpenter','painter','locksmith','cleaning','gardening','landscaping','moving','hvac','pest control','handyman'],
    'Einzelhandel': ['clothing','shoes','jewelry','watch','electronics','phone','computer','bookstore','toy','furniture','hardware','paint','garden centre','florist','pet','optician','stationery','photo','copyshop','laundry','dry cleaning','tailor','antiques','bed','carpet','lighting','tiles','doors','security','tool hire','trade'],
    'Kunst & Unterhaltung': ['cinema','theatre','museum','gallery','casino','nightclub','music venue','arts centre','library','community centre','conference centre','events venue'],
    'Reisen & Gastgewerbe': ['hotel','motel','hostel','guest house','bed and breakfast','campsite','travel agency','taxi','bus station','train station','ferry terminal','airport'],
    'Bildung': ['school','university','college','kindergarten','language school','music school','driving school','surf school','training','research institute','library'],
    'Technologie': ['computer','electronics','phone','software','internet cafe','gaming','video games','camera','drone'],
    'Bau & Handwerk': ['hardware','paint','plumber','electrician','carpenter','roofer','flooring','tiles','doors','kitchen','tool hire','trade','builder','contractor'],
    'Sonstiges': ['post office','police','fire station','townhall','courthouse','prison','marketplace','place of worship','funeral hall','crematorium','mortuary','internet cafe']
};

const ALL_NICHES = Object.values(NICHE_CATALOG).flat();

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initLocation();
    initJsonbin();
    bindEvents();
    loadData();
    loadHistory();
    initProviderToggle();
    initFilters();
    initNicheDropdown();
    renderDashboard();
    renderTable();
});

// ============================================
// JSONBin.io Cloud Sync (Optional)
// ============================================
function initJsonbin() {
    jsonbinKey = localStorage.getItem(STORAGE_JSONBIN_KEY) || '';
    jsonbinId = localStorage.getItem(STORAGE_JSONBIN_ID) || '';
    if (jsonbinKey) $('jsonbinKeyInput').value = jsonbinKey;
    if (jsonbinId) {
        $('jsonbinIdInput').value = jsonbinId;
        syncFromCloud();
    }
}

function showSyncMessage(text, type) {
    const msg = $('syncMessage');
    msg.textContent = text;
    msg.className = 'sync-message show ' + type;
    setTimeout(() => { msg.className = 'sync-message'; }, 5000);
}

function updateSyncStatus(status, text) {
    const el = $('syncStatus');
    el.className = 'sync-status';
    if (status === 'synced') { el.classList.add('synced'); el.textContent = '\u2705 Synchronisiert'; }
    else if (status === 'error') { el.classList.add('error'); el.textContent = '\u274C ' + (text || 'Sync-Fehler'); }
    else if (status === 'syncing') { el.textContent = '\u23F3 Synchronisiere...'; }
    else { el.textContent = '\u2705 ' + (text || 'Lokal gespeichert'); }
}

async function connectJsonbin() {
    const key = $('jsonbinKeyInput').value.trim();
    const binId = $('jsonbinIdInput').value.trim();
    if (!key) { showSyncMessage('Bitte gib deinen JSONBin.io API Key ein.', 'error'); return; }
    jsonbinKey = key;
    localStorage.setItem(STORAGE_JSONBIN_KEY, key);
    if (binId) {
        jsonbinId = binId;
        localStorage.setItem(STORAGE_JSONBIN_ID, binId);
        updateSyncStatus('syncing');
        const success = await syncFromCloud();
        if (success) showSyncMessage('Verbunden! Daten aus der Cloud geladen.', 'success');
    } else {
        updateSyncStatus('syncing');
        try {
            const res = await fetch(JSONBIN_API + '/b', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Master-Key': jsonbinKey, 'X-Bin-Private': 'false' },
                body: JSON.stringify({ leads: [], history: [], version: 1 })
            });
            if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || 'HTTP ' + res.status); }
            const data = await res.json();
            jsonbinId = data.metadata.id;
            localStorage.setItem(STORAGE_JSONBIN_ID, jsonbinId);
            $('jsonbinIdInput').value = jsonbinId;
            await syncToCloud();
            showSyncMessage('Neue Bin erstellt! ID: ' + jsonbinId, 'success');
            updateSyncStatus('synced');
        } catch (err) {
            showSyncMessage('Fehler beim Erstellen der Bin: ' + err.message, 'error');
            updateSyncStatus('error', err.message);
        }
    }
}

async function syncToCloud() {
    if (!jsonbinKey || !jsonbinId) return false;
    updateSyncStatus('syncing');
    try {
        const res = await fetch(JSONBIN_API + '/b/' + jsonbinId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-Master-Key': jsonbinKey },
            body: JSON.stringify({ leads: leads, history: history, version: Date.now() })
        });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || 'HTTP ' + res.status); }
        lastSyncTime = Date.now();
        updateSyncStatus('synced');
        return true;
    } catch (err) {
        updateSyncStatus('error', err.message);
        return false;
    }
}

async function syncFromCloud() {
    if (!jsonbinKey || !jsonbinId) return false;
    updateSyncStatus('syncing');
    try {
        const res = await fetch(JSONBIN_API + '/b/' + jsonbinId + '/latest', {
            method: 'GET',
            headers: { 'X-Master-Key': jsonbinKey }
        });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || 'HTTP ' + res.status); }
        const data = await res.json();
        const record = data.record || {};
        if (record.leads && Array.isArray(record.leads)) {
            const localIds = new Set(leads.map(l => l.id));
            let merged = [...leads];
            for (const cloudLead of record.leads) {
                const idx = merged.findIndex(l => l.id === cloudLead.id);
                if (idx === -1) merged.push(cloudLead);
                else if ((cloudLead.updatedAt || cloudLead.createdAt || 0) > (merged[idx].updatedAt || merged[idx].createdAt || 0)) merged[idx] = cloudLead;
            }
            leads = merged;
            saveData();
        }
        if (record.history && Array.isArray(record.history)) {
            const localHistIds = new Set(history.map(h => h.id));
            for (const cloudHist of record.history) {
                if (!localHistIds.has(cloudHist.id)) history.push(cloudHist);
            }
            history.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            if (history.length > 200) history = history.slice(0, 200);
            saveHistory();
        }
        lastSyncTime = Date.now();
        updateSyncStatus('synced');
        renderDashboard(); renderTable(); renderHistory(); updateCategoryFilter();
        return true;
    } catch (err) {
        updateSyncStatus('error', err.message);
        return false;
    }
}

setInterval(() => { if (jsonbinKey && jsonbinId) syncToCloud(); }, 60000);

// ============================================
// KOSTENLOSE Datei-Speicherung (JSON Export/Import)
// ============================================
function saveToFile() {
    if (leads.length === 0 && history.length === 0) { showAlert('Keine Daten zum Speichern.', 'warn'); return; }
    const data = { 
        leads: leads, 
        history: history, 
        version: 1, 
        exportedAt: Date.now(),
        app: 'ColdCallFinder',
        exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'coldcallfinder-backup-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showAlert('Backup gespeichert! ' + leads.length + ' Leads, ' + history.length + ' Verlaufseintraege.', 'info');
    addHistory('export', 'Backup als Datei gespeichert (' + leads.length + ' Leads)');
}

function loadFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.leads || !Array.isArray(data.leads)) {
                showAlert('Ungueltige Datei: Keine Leads gefunden.', 'error');
                return;
            }
            const oldCount = leads.length;
            const existingIds = new Set(leads.map(l => l.id));
            let added = 0;
            for (const newLead of data.leads) {
                if (!existingIds.has(newLead.id)) {
                    leads.push(newLead);
                    existingIds.add(newLead.id);
                    added++;
                }
            }
            if (data.history && Array.isArray(data.history)) {
                const existingHistIds = new Set(history.map(h => h.id));
                for (const newHist of data.history) {
                    if (!existingHistIds.has(newHist.id)) {
                        history.push(newHist);
                        existingHistIds.add(newHist.id);
                    }
                }
                history.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                if (history.length > 200) history = history.slice(0, 200);
            }
            saveData(); saveHistory();
            const maxBatch = Math.max(...leads.map(l => l.batchId || 0), 0);
            currentBatchId = maxBatch;
            renderDashboard(); renderTable(); renderHistory(); updateCategoryFilter();
            showAlert('Backup geladen! ' + added + ' neue Leads importiert. Gesamt: ' + leads.length + ' Leads.', 'info');
            addHistory('export', 'Backup aus Datei geladen (' + added + ' neue Leads)');
            if (jsonbinKey && jsonbinId) syncToCloud();
        } catch (err) {
            showAlert('Fehler beim Laden der Datei: ' + err.message, 'error');
        }
    };
    reader.onerror = () => showAlert('Fehler beim Lesen der Datei.', 'error');
    reader.readAsText(file);
}

// ============================================
// Niche Dropdown
// ============================================
function initNicheDropdown() {
    const nicheList = $('nicheList');
    nicheList.innerHTML = '';
    for (const [category, niches] of Object.entries(NICHE_CATALOG)) {
        const header = document.createElement('div');
        header.className = 'niche-category-header';
        header.textContent = category;
        nicheList.appendChild(header);
        for (const niche of niches) {
            const item = document.createElement('button');
            item.className = 'niche-item';
            item.textContent = niche;
            item.addEventListener('click', () => { $('nicheInput').value = niche; closeNicheModal(); });
            nicheList.appendChild(item);
        }
    }
    const datalist = $('nicheOptions');
    datalist.innerHTML = '';
    for (const niche of ALL_NICHES) { const opt = document.createElement('option'); opt.value = niche; datalist.appendChild(opt); }
    $('nicheSearchInput').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        document.querySelectorAll('.niche-item').forEach(item => {
            item.classList.toggle('hidden', term && !item.textContent.toLowerCase().includes(term));
        });
    });
}
function openNicheModal() {
    $('nicheModal').style.display = 'flex';
    $('nicheSearchInput').value = '';
    $('nicheSearchInput').focus();
    document.querySelectorAll('.niche-item').forEach(item => item.classList.remove('hidden'));
}
function closeNicheModal() { $('nicheModal').style.display = 'none'; }

// ============================================
// Provider Toggle
// ============================================
function initProviderToggle() {
    const saved = localStorage.getItem(STORAGE_PROVIDER);
    if (saved) searchProvider = saved;
    updateProviderUI();
}
function setProvider(provider) {
    searchProvider = provider;
    localStorage.setItem(STORAGE_PROVIDER, provider);
    updateProviderUI();
}
function updateProviderUI() {
    const googleBtn = $('providerGoogle');
    const osmBtn = $('providerOsm');
    if (!googleBtn || !osmBtn) return;
    if (searchProvider === 'google') {
        googleBtn.classList.add('active'); osmBtn.classList.remove('active'); $('apiKeyBox').style.display = '';
    } else {
        googleBtn.classList.remove('active'); osmBtn.classList.add('active'); $('apiKeyBox').style.display = 'none';
    }
}

// ============================================
// Filters
// ============================================
function initFilters() {
    const saved = localStorage.getItem(STORAGE_FILTERS);
    if (saved) {
        try {
            const f = JSON.parse(saved);
            if (f.status) $('filterStatus').value = f.status;
            if (f.website) $('filterWebsite').value = f.website;
            if (f.phone) $('filterPhone').value = f.phone;
            if (f.rating) $('filterRating').value = f.rating;
            if (f.source) $('filterSource').value = f.source;
            if (f.category) $('filterCategory').value = f.category;
            if (f.text) $('filterInput').value = f.text;
            if (f.dashboard) { activeDashboardFilter = f.dashboard; updateDashboardActiveState(); }
        } catch (e) {}
    }
    ['filterStatus','filterWebsite','filterPhone','filterRating','filterSource','filterCategory'].forEach(id => {
        $(id).addEventListener('change', () => { saveFilters(); renderDashboard(); renderTable(); });
    });
    $('filterInput').addEventListener('input', () => { saveFilters(); renderDashboard(); renderTable(); });
    $('resetFiltersBtn').addEventListener('click', resetFilters);
}
function saveFilters() {
    localStorage.setItem(STORAGE_FILTERS, JSON.stringify({
        status: $('filterStatus').value, website: $('filterWebsite').value, phone: $('filterPhone').value,
        rating: $('filterRating').value, source: $('filterSource').value, category: $('filterCategory').value,
        text: $('filterInput').value, dashboard: activeDashboardFilter
    }));
}
function resetFilters() {
    $('filterStatus').value = ''; $('filterWebsite').value = ''; $('filterPhone').value = '';
    $('filterRating').value = ''; $('filterSource').value = ''; $('filterCategory').value = '';
    $('filterInput').value = ''; activeDashboardFilter = '';
    updateDashboardActiveState(); saveFilters(); renderDashboard(); renderTable();
}
function updateDashboardActiveState() {
    document.querySelectorAll('.dash-card.clickable').forEach(card => {
        card.classList.toggle('active', card.dataset.filter === activeDashboardFilter);
    });
}

// ============================================
// Auth & Location
// ============================================
function initAuth() {
    if (localStorage.getItem(STORAGE_AUTH) === 'true') showApp(); else showLogin();
}
function showLogin() { $('loginScreen').style.display = 'flex'; $('appScreen').style.display = 'none'; $('passwordInput').focus(); }
function showApp() { $('loginScreen').style.display = 'none'; $('appScreen').style.display = 'block'; renderDashboard(); renderTable(); renderHistory(); }
function attemptLogin() {
    if ($('passwordInput').value.trim() === PASSWORD) {
        localStorage.setItem(STORAGE_AUTH, 'true'); $('loginError').textContent = ''; showApp();
    } else { $('loginError').textContent = 'Falsches Passwort.'; $('passwordInput').value = ''; $('passwordInput').focus(); }
}
function logout() { localStorage.removeItem(STORAGE_AUTH); showLogin(); $('passwordInput').value = ''; }

function initLocation() {
    if (!navigator.geolocation) { $('locationStatus').textContent = 'Geolocation nicht unterstuetzt. Bitte manuellen Standort verwenden.'; $('manualLocationBox').style.display = 'flex'; return; }
    $('locationStatus').textContent = 'Standort wird ermittelt...';
    navigator.geolocation.getCurrentPosition(
        (pos) => { userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude }; $('locationStatus').textContent = 'Standort erkannt. Bereit zur Suche.'; reverseGeocode(userLocation.lat, userLocation.lng); },
        (err) => { console.warn('Geolocation error:', err); $('locationStatus').textContent = 'Standortzugriff verweigert. Bitte manuellen Standort verwenden.'; $('manualLocationBox').style.display = 'flex'; },
        { timeout: 10000, maximumAge: 60000 }
    );
}
function reverseGeocode(lat, lng) {
    fetch('https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lng + '&format=json', { headers: { 'Accept-Language': 'de' } })
    .then(r => r.json()).then(data => {
        if (data && data.address) {
            const city = data.address.city || data.address.town || data.address.village || data.address.county || '';
            const country = data.address.country || '';
            locationName = city + (city && country ? ', ' : '') + country;
            if (locationName) $('locationStatus').textContent = 'Standort: ' + locationName;
        }
    }).catch(() => {});
}
function setManualLocation() {
    const query = $('manualLocationInput').value.trim();
    if (!query) return;
    $('locationStatus').textContent = 'Standort wird gesucht...';
    fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(query) + '&format=json&limit=1', { headers: { 'Accept-Language': 'de' } })
    .then(r => r.json()).then(data => {
        if (data && data.length > 0) {
            userLocation = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
            locationName = data[0].display_name.split(',')[0];
            $('locationStatus').textContent = 'Standort: ' + locationName;
            $('manualLocationBox').style.display = 'none';
        } else { $('locationStatus').textContent = 'Standort nicht gefunden. Bitte erneut versuchen.'; }
    }).catch(() => { $('locationStatus').textContent = 'Fehler bei der Standortsuche. Bitte erneut versuchen.'; });
}

// ============================================
// Event Bindings
// ============================================
function bindEvents() {
    $('loginBtn').addEventListener('click', attemptLogin);
    $('passwordInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptLogin(); });
    $('logoutBtn').addEventListener('click', logout);
    $('manualLocationBtn').addEventListener('click', () => {
        const box = $('manualLocationBox');
        box.style.display = box.style.display === 'none' ? 'flex' : 'none';
        if (box.style.display !== 'none') $('manualLocationInput').focus();
    });
    $('setLocationBtn').addEventListener('click', setManualLocation);
    $('manualLocationInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') setManualLocation(); });
    $('searchBtn').addEventListener('click', performSearch);
    $('nicheInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') performSearch(); });
    $('nicheDropdownBtn').addEventListener('click', openNicheModal);
    $('closeNicheModal').addEventListener('click', closeNicheModal);
    $('nicheModal').querySelector('.modal-overlay').addEventListener('click', closeNicheModal);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNicheModal(); });
    $('providerGoogle').addEventListener('click', () => setProvider('google'));
    $('providerOsm').addEventListener('click', () => setProvider('osm'));
    $('saveApiKeyBtn').addEventListener('click', saveApiKey);
    $('apiKeyInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveApiKey(); });
    $('connectJsonbinBtn').addEventListener('click', connectJsonbin);
    $('syncNowBtn').addEventListener('click', () => { syncFromCloud().then(ok => { if (ok) showSyncMessage('Aus Cloud synchronisiert!', 'success'); }); });

    // Datei-Speicherung Events
    $('saveFileBtn').addEventListener('click', saveToFile);
    $('loadFileBtn').addEventListener('click', () => $('fileInput').click());
    $('fileInput').addEventListener('change', (e) => { if (e.target.files[0]) loadFromFile(e.target.files[0]); e.target.value = ''; });

    document.querySelectorAll('.dash-card.clickable').forEach(card => {
        card.addEventListener('click', () => {
            activeDashboardFilter = activeDashboardFilter === card.dataset.filter ? '' : card.dataset.filter;
            updateDashboardActiveState(); saveFilters(); renderDashboard(); renderTable();
        });
    });
    $('exportBtn').addEventListener('click', exportCSV);
    $('clearBtn').addEventListener('click', () => {
        if (confirm('Alle Leads loeschen? Dies kann nicht rueckgaengig gemacht werden.')) {
            const count = leads.length; leads = []; saveData(); renderDashboard(); renderTable(); updateCategoryFilter();
            addHistory('clear', 'Alle ' + count + ' Leads geloescht');
        }
    });
    $('clearHistoryBtn').addEventListener('click', () => {
        if (confirm('Gesamten Verlauf loeschen?')) { history = []; saveHistory(); renderHistory(); }
    });
}
function saveApiKey() {
    const key = $('apiKeyInput').value.trim();
    if (key) { localStorage.setItem('coldcallfinder_apikey', key); $('apiKeyInput').value = ''; showAlert('API Key gespeichert.', 'info'); }
}

// ============================================
// History System
// ============================================
function addHistory(type, text, meta) {
    meta = meta || '';
    const entry = { id: 'hist-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8), type, text, meta, timestamp: Date.now() };
    history.unshift(entry);
    if (history.length > 200) history = history.slice(0, 200);
    saveHistory(); renderHistory();
    if (jsonbinKey && jsonbinId) syncToCloud();
}
function saveHistory() {
    try { localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history)); } catch (e) { console.warn('Verlauf konnte nicht gespeichert werden:', e); }
}
function loadHistory() {
    try {
        const raw = localStorage.getItem(STORAGE_HISTORY);
        if (raw) { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) history = parsed; }
    } catch (e) { console.warn('Verlauf konnte nicht geladen werden:', e); }
}
function renderHistory() {
    const list = $('historyList');
    if (history.length === 0) { list.innerHTML = '<div class="empty-history">Noch keine Aktivitaet.</div>'; return; }
    const icons = { search: '\u{1F50D}', status: '\u{1F4DE}', add: '\u2795', delete: '\u{1F5D1}\uFE0F', export: '\u{1F4E4}', clear: '\u{1F9F9}', note: '\u{1F4DD}', contact: '\u{1F4C5}' };
    let html = '';
    for (const entry of history.slice(0, 50)) {
        const date = new Date(entry.timestamp);
        const timeStr = date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const icon = icons[entry.type] || '\u{1F4CB}';
        html += '<div class="history-item type-' + escAttr(entry.type) + '"><span class="history-icon">' + icon + '</span><div class="history-content"><div class="history-text">' + esc(entry.text) + '</div><div class="history-meta">' + esc(entry.meta || timeStr) + '</div></div></div>';
    }
    list.innerHTML = html;
}

// ============================================
// Search Entry Point
// ============================================
async function performSearch() {
    const niche = $('nicheInput').value.trim();
    if (!niche) { showAlert('Bitte gib eine Branchen-Nische ein.', 'warn'); return; }
    if (!userLocation) { showAlert('Standort nicht festgelegt. Bitte Geolocation erlauben oder Stadt manuell eingeben.', 'warn'); $('manualLocationBox').style.display = 'flex'; return; }
    currentBatchId++;
    if (searchProvider === 'google') await searchGoogle(niche); else await searchOpenStreetMap(niche);
}

// ============================================
// Google Places Search
// ============================================
async function searchGoogle(niche) {
    const apiKey = localStorage.getItem('coldcallfinder_apikey');
    if (!apiKey) { showAlert('Google Places API Key erforderlich. Key unten eingeben oder zu OpenStreetMap (kostenlos) wechseln.', 'warn'); $('apiKeyBox').style.display = ''; $('apiKeyInput').focus(); return; }
    const radius = parseInt($('radiusSelect').value, 10);
    setSearching(true); clearAlert();
    try {
        const searchBody = { textQuery: niche, locationBias: { circle: { center: { latitude: userLocation.lat, longitude: userLocation.lng }, radius: radius } }, pageSize: 20 };
        const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.rating,places.userRatingCount,places.primaryTypeDisplayName,places.businessStatus,places.location' },
            body: JSON.stringify(searchBody)
        });
        if (!searchRes.ok) {
            const errData = await searchRes.json().catch(() => ({}));
            if (searchRes.status === 403 || searchRes.status === 401) { localStorage.removeItem('coldcallfinder_apikey'); }
            throw new Error(errData.error?.message || 'HTTP ' + searchRes.status);
        }
        const searchData = await searchRes.json();
        const places = searchData.places || [];
        if (places.length === 0) { showAlert('Keine Unternehmen gefunden. Bitte andere Nische oder groesseren Radius versuchen.', 'info'); setSearching(false); return; }
        processResults(places, 'google');
    } catch (err) { showAlert(err.message || 'Suche fehlgeschlagen. Bitte zu OpenStreetMap wechseln.', 'error'); }
    finally { setSearching(false); }
}

// ============================================
// OpenStreetMap Search
// ============================================
async function searchOpenStreetMap(niche) {
    const radius = parseInt($('radiusSelect').value, 10);
    setSearching(true); clearAlert();
    const osmTagMap = {
        'restaurant': ['amenity=restaurant','amenity=fast_food'],'restaurants': ['amenity=restaurant','amenity=fast_food'],'fast food': ['amenity=fast_food'],
        'cafe': ['amenity=cafe'],'cafes': ['amenity=cafe'],'bar': ['amenity=bar','amenity=pub'],'bars': ['amenity=bar','amenity=pub'],'pub': ['amenity=pub'],
        'biergarten': ['amenity=biergarten'],'ice cream': ['amenity=ice_cream'],'hotel': ['tourism=hotel','tourism=motel'],'hotels': ['tourism=hotel','tourism=motel'],
        'motel': ['tourism=motel'],'hostel': ['tourism=hostel'],'hostels': ['tourism=hostel'],'guest house': ['tourism=guest_house'],'bed and breakfast': ['tourism=guest_house'],
        'bnb': ['tourism=guest_house'],'campsite': ['tourism=camp_site'],'camping': ['tourism=camp_site'],'dentist': ['amenity=dentist'],'dentists': ['amenity=dentist'],
        'doctor': ['amenity=doctors'],'doctors': ['amenity=doctors'],'clinic': ['amenity=clinic'],'clinics': ['amenity=clinic'],'hospital': ['amenity=hospital'],
        'pharmacy': ['amenity=pharmacy'],'pharmacies': ['amenity=pharmacy'],'veterinary': ['amenity=veterinary'],'vet': ['amenity=veterinary'],
        'nursing home': ['amenity=social_facility','social_facility=nursing_home'],'social facility': ['amenity=social_facility'],
        'hair': ['shop=hairdresser'],'hairdresser': ['shop=hairdresser'],'hair salon': ['shop=hairdresser'],'salon': ['shop=hairdresser','shop=beauty'],
        'beauty': ['shop=beauty'],'nail salon': ['shop=beauty','beauty=nails'],'tanning': ['shop=beauty','beauty=tanning'],'spa': ['leisure=spa'],
        'sauna': ['leisure=sauna'],'massage': ['shop=massage'],'yoga': ['leisure=yoga','sport=yoga'],'gym': ['leisure=fitness_centre','leisure=sports_centre'],
        'gyms': ['leisure=fitness_centre','leisure=sports_centre'],'fitness': ['leisure=fitness_centre'],'sports centre': ['leisure=sports_centre'],
        'swimming pool': ['leisure=swimming_pool'],'pool': ['leisure=swimming_pool'],'bowling': ['leisure=bowling_alley'],'skating': ['leisure=ice_rink'],
        'ice rink': ['leisure=ice_rink'],'golf course': ['leisure=golf_course'],'mini golf': ['leisure=miniature_golf'],'stadium': ['leisure=stadium'],
        'stadiums': ['leisure=stadium'],'dance': ['leisure=dance','amenity=dancing_school'],'martial arts': ['sport=martial_arts','leisure=sports_centre'],
        'climbing': ['sport=climbing','leisure=sports_centre'],'tennis': ['sport=tennis','leisure=sports_centre'],'plumber': ['craft=plumber'],
        'plumbers': ['craft=plumber'],'electrician': ['craft=electrician'],'electricians': ['craft=electrician'],'roofer': ['craft=roofer'],
        'roofers': ['craft=roofer'],'carpenter': ['craft=carpenter'],'carpenters': ['craft=carpenter'],'painter': ['craft=painter'],
        'locksmith': ['craft=locksmith','shop=locksmith'],'cleaning': ['shop=cleaning'],'gardening': ['shop=garden_centre'],'landscaping': ['craft=landscaper'],
        'moving': ['shop=moving'],'hvac': ['craft=hvac'],'pest control': ['shop=pest_control'],'handyman': ['craft=handyman'],
        'mechanic': ['shop=car_repair'],'mechanics': ['shop=car_repair'],'car repair': ['shop=car_repair'],'car wash': ['amenity=car_wash'],
        'fuel': ['amenity=fuel'],'gas': ['amenity=fuel'],'gas station': ['amenity=fuel'],'charging station': ['amenity=charging_station'],
        'car rental': ['amenity=car_rental'],'car sharing': ['amenity=car_sharing'],'tyres': ['shop=tyres'],'motorcycle': ['shop=motorcycle'],
        'truck': ['shop=truck'],'lawyer': ['office=lawyer'],'lawyers': ['office=lawyer'],'attorney': ['office=lawyer'],'attorneys': ['office=lawyer'],
        'accountant': ['office=accountant'],'accountants': ['office=accountant'],'real estate': ['office=estate_agent'],'realtor': ['office=estate_agent'],
        'realtors': ['office=estate_agent'],'estate agent': ['office=estate_agent'],'insurance': ['office=insurance'],'bank': ['amenity=bank'],
        'banks': ['amenity=bank'],'notary': ['office=notary'],'architect': ['office=architect'],'consulting': ['office=consulting'],
        'marketing': ['office=advertising_agency','office=marketing'],'supermarket': ['shop=supermarket'],'supermarkets': ['shop=supermarket'],
        'bakery': ['shop=bakery'],'bakeries': ['shop=bakery'],'butcher': ['shop=butcher'],'butchers': ['shop=butcher'],'florist': ['shop=florist'],
        'florists': ['shop=florist'],'optician': ['shop=optician'],'opticians': ['shop=optician'],'shoe': ['shop=shoes'],'shoes': ['shop=shoes'],
        'clothing': ['shop=clothes'],'clothes': ['shop=clothes'],'pet': ['shop=pet'],'pets': ['shop=pet'],'tattoo': ['shop=tattoo'],
        'tattoos': ['shop=tattoo'],'piercing': ['shop=piercing'],'laundry': ['shop=laundry'],'dry cleaning': ['shop=dry_cleaning'],
        'tailor': ['shop=tailor'],'tailors': ['shop=tailor'],'jewelry': ['shop=jewelry'],'jeweller': ['shop=jewelry'],'jewellers': ['shop=jewelry'],
        'watch': ['shop=watches'],'watches': ['shop=watches'],'electronics': ['shop=electronics'],'phone': ['shop=mobile_phone'],
        'phones': ['shop=mobile_phone'],'computer': ['shop=computer'],'computers': ['shop=computer'],'software': ['office=it','shop=computer'],
        'gaming': ['shop=video_games','leisure=adult_gaming_centre'],'video games': ['shop=video_games'],'drone': ['shop=electronics'],
        'bookstore': ['shop=books'],'bookstores': ['shop=books'],'books': ['shop=books'],'toy': ['shop=toys'],'toys': ['shop=toys'],
        'furniture': ['shop=furniture'],'hardware': ['shop=hardware'],'paint': ['shop=paint'],'garden centre': ['shop=garden_centre'],
        'stationery': ['shop=stationery'],'photo': ['shop=photo'],'photography': ['shop=photo'],'copyshop': ['shop=copyshop'],'copy': ['shop=copyshop'],
        'travel agency': ['shop=travel_agency'],'travel': ['shop=travel_agency'],'taxi': ['amenity=taxi'],'taxis': ['amenity=taxi'],
        'bus station': ['amenity=bus_station'],'bus': ['amenity=bus_station'],'train station': ['amenity=train_station'],'train': ['amenity=train_station'],
        'ferry terminal': ['amenity=ferry_terminal'],'airport': ['aeroway=aerodrome'],'post office': ['amenity=post_office'],'post': ['amenity=post_office'],
        'library': ['amenity=library'],'libraries': ['amenity=library'],'museum': ['tourism=museum'],'museums': ['tourism=museum'],
        'cinema': ['amenity=cinema'],'cinemas': ['amenity=cinema'],'theatre': ['amenity=theatre'],'theater': ['amenity=theatre'],
        'theatres': ['amenity=theatre'],'theaters': ['amenity=theatre'],'gallery': ['tourism=gallery'],'galleries': ['tourism=gallery'],
        'art': ['tourism=gallery','shop=art'],'casino': ['amenity=casino'],'casinos': ['amenity=casino'],'nightclub': ['amenity=nightclub'],
        'nightclubs': ['amenity=nightclub'],'music venue': ['amenity=music_venue'],'arts centre': ['amenity=arts_centre'],
        'community centre': ['amenity=community_centre'],'conference centre': ['amenity=conference_centre'],'events venue': ['amenity=events_venue'],
        'school': ['amenity=school'],'schools': ['amenity=school'],'university': ['amenity=university'],'college': ['amenity=college'],
        'kindergarten': ['amenity=kindergarten'],'language school': ['amenity=language_school'],'music school': ['amenity=music_school'],
        'driving school': ['amenity=driving_school'],'surf school': ['amenity=surf_school'],'training': ['amenity=training'],
        'research institute': ['amenity=research_institute'],'police': ['amenity=police'],'fire station': ['amenity=fire_station'],
        'townhall': ['amenity=townhall'],'courthouse': ['amenity=courthouse'],'prison': ['amenity=prison'],'marketplace': ['amenity=marketplace'],
        'place of worship': ['amenity=place_of_worship'],'funeral hall': ['amenity=funeral_hall'],'crematorium': ['amenity=crematorium'],
        'mortuary': ['amenity=mortuary'],'internet cafe': ['amenity=internet_cafe'],'convenience': ['shop=convenience'],
        'convenience store': ['shop=convenience'],'kiosk': ['shop=kiosk'],'newsagent': ['shop=newsagent'],'tobacconist': ['shop=tobacco'],
        'tobacco': ['shop=tobacco'],'alcohol': ['shop=alcohol'],'wine': ['shop=wine'],'liquor': ['shop=alcohol'],'cannabis': ['shop=cannabis'],
        'ticket': ['shop=ticket'],'tickets': ['shop=ticket'],'lottery': ['shop=lottery'],'money': ['amenity=bureau_de_change'],
        'exchange': ['amenity=bureau_de_change'],'atm': ['amenity=atm'],'vending': ['amenity=vending_machine'],'recycling': ['amenity=recycling'],
        'waste': ['amenity=waste_disposal'],'toilets': ['amenity=toilets'],'shower': ['amenity=shower'],'drinking': ['amenity=drinking_water'],
        'water': ['amenity=drinking_water'],'bench': ['amenity=bench'],'shelter': ['amenity=shelter'],'telephone': ['amenity=telephone'],
        'clock': ['amenity=clock'],'ambulance': ['emergency=ambulance_station'],'defibrillator': ['emergency=defibrillator'],
        'builder': ['craft=builder'],'contractor': ['craft=builder'],'antiques': ['shop=antiques'],'bed': ['shop=bed'],'carpet': ['shop=carpet'],
        'lighting': ['shop=lighting'],'tiles': ['shop=tiles'],'doors': ['shop=doors'],'security': ['shop=security'],'tool hire': ['shop=tool_hire'],
        'trade': ['shop=trade'],'camera': ['shop=camera'],'collector': ['shop=collector'],'craft': ['shop=craft'],'frame': ['shop=frame'],
        'games': ['shop=games'],'model': ['shop=model'],'music shop': ['shop=music'],'musical instrument': ['shop=musical_instrument'],
        'trophy': ['shop=trophy'],'video': ['shop=video'],'anime': ['shop=anime'],'surf': ['shop=surf'],'swimming pool shop': ['shop=swimming_pool'],
        'trailer': ['shop=trailer'],'food court': ['amenity=food_court'],'kitchen': ['shop=kitchen'],'interior decoration': ['shop=interior_decoration'],
        'household linen': ['shop=household_linen'],'candles': ['shop=candles'],'curtain': ['shop=curtain'],'flooring': ['shop=flooring']
    };

    const nicheLower = niche.toLowerCase().trim();
    let tags = osmTagMap[nicheLower];
    if (!tags) {
        for (const [key, val] of Object.entries(osmTagMap)) {
            if (nicheLower.includes(key) || key.includes(nicheLower)) { tags = val; break; }
        }
    }
    if (!tags) tags = ['name~"' + niche + '"'];

    const lat = userLocation.lat, lon = userLocation.lng, r = radius;
    const tagFilters = tags.map(t => { if (t.includes('=')) { const kv = t.split('='); return '["' + kv[0] + '"="' + kv[1] + '"]' } return t; }).join('');

    const query = '\n[out:json][timeout:60];\n(\n  node' + tagFilters + '(around:' + r + ',' + lat + ',' + lon + ');\n  way' + tagFilters + '(around:' + r + ',' + lat + ',' + lon + ');\n  relation' + tagFilters + '(around:' + r + ',' + lat + ',' + lon + ');\n);\nout body center;\n>;\nout skel qt;\n';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        let res = await fetch(OVERPASS_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'data=' + encodeURIComponent(query), signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!res.ok) {
            res = await fetch(OVERPASS_BACKUP, {
                method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'data=' + encodeURIComponent(query)
            });
        }
        if (!res.ok) throw new Error('Overpass API Fehler: ' + res.status);
        const data = await res.json();
        const elements = data.elements || [];
        if (elements.length === 0) { showAlert('Keine Unternehmen in OpenStreetMap fuer diesen Bereich gefunden. Bitte andere Nische, groesseren Radius oder Google Places versuchen.', 'info'); setSearching(false); return; }
        processOsmResults(elements, niche);
    } catch (err) { showAlert(err.message || 'OpenStreetMap-Suche fehlgeschlagen. Bitte erneut versuchen oder zu Google Places wechseln.', 'error'); }
    finally { setSearching(false); }
}

function processOsmResults(elements, niche) {
    let added = 0;
    const existingIds = new Set(leads.map(l => l.id));
    const existingPhones = new Set(leads.map(l => normalizePhone(l.phone)));
    for (const el of elements) {
        const tags = el.tags || {};
        const phone = tags.phone || tags['contact:phone'] || tags.telephone || '';
        if (!phone) continue;
        const normPhone = normalizePhone(phone);
        if (existingPhones.has(normPhone)) continue;
        const id = 'osm-' + el.type + '-' + el.id;
        if (existingIds.has(id)) continue;
        let lat, lon;
        if (el.lat && el.lon) { lat = el.lat; lon = el.lon; }
        else if (el.center) { lat = el.center.lat; lon = el.center.lon; }
        else if (el.bounds) { lat = (el.bounds.minlat + el.bounds.maxlat) / 2; lon = (el.bounds.minlon + el.bounds.maxlon) / 2; }
        else continue;
        const addressParts = [];
        if (tags['addr:street']) { let street = tags['addr:street']; if (tags['addr:housenumber']) street += ' ' + tags['addr:housenumber']; addressParts.push(street); }
        if (tags['addr:postcode']) addressParts.push(tags['addr:postcode']);
        if (tags['addr:city']) addressParts.push(tags['addr:city']);
        if (tags['addr:country']) addressParts.push(tags['addr:country']);
        const address = addressParts.join(', ') || '';
        let category = niche;
        if (tags.amenity) category = tags.amenity;
        else if (tags.shop) category = tags.shop;
        else if (tags.tourism) category = tags.tourism;
        else if (tags.leisure) category = tags.leisure;
        else if (tags.craft) category = tags.craft;
        else if (tags.office) category = tags.office;
        else if (tags.healthcare) category = tags.healthcare;
        category = category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        leads.push({
            id: id, name: tags.name || tags['name:en'] || 'Unbenannt ' + category, phone: phone, address: address,
            website: tags.website || tags['contact:website'] || tags['contact:url'] || '',
            mapsLink: 'https://www.openstreetmap.org/' + el.type + '/' + el.id,
            rating: null, reviews: 0, category: category, status: 'tocall', notes: '', lastContact: '', called: false,
            createdAt: Date.now(), updatedAt: Date.now(), source: 'osm', lat: lat, lon: lon, batchId: currentBatchId
        });
        existingIds.add(id); existingPhones.add(normPhone); added++;
    }
    if (added === 0) showAlert(elements.length + ' Orte in OSM gefunden, aber keiner hatte eine Telefonnummer. Bitte anderen Bereich oder Nische versuchen.', 'warn');
    else { showAlert(added + ' neue Lead' + (added !== 1 ? 's' : '') + ' ueber OpenStreetMap (kostenlos) gefunden.', 'info'); addHistory('search', added + ' Leads fuer "' + niche + '" ueber OpenStreetMap gefunden', locationName || 'Unbekannter Standort'); }
    saveData(); renderDashboard(); renderTable(); updateCategoryFilter(); syncToCloud();
}

function normalizePhone(phone) { return String(phone).replace(/\D/g, '').replace(/^0+/, ''); }

// ============================================
// Process Google Results
// ============================================
function processResults(places, source) {
    let added = 0;
    const existingIds = new Set(leads.map(l => l.id));
    const existingPhones = new Set(leads.map(l => normalizePhone(l.phone)));
    for (const place of places) {
        const phone = place.internationalPhoneNumber || '';
        if (!phone) continue;
        const normPhone = normalizePhone(phone);
        if (existingPhones.has(normPhone)) continue;
        const id = place.id || (place.displayName?.text || '') + '-' + (place.formattedAddress || '');
        if (existingIds.has(id)) continue;
        leads.push({
            id: id, name: place.displayName?.text || 'Unbekannt', phone: phone, address: place.formattedAddress || '',
            website: place.websiteUri || '',
            mapsLink: place.googleMapsUri || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place.location?.latitude || 0) + ',' + encodeURIComponent(place.location?.longitude || 0),
            rating: place.rating || null, reviews: place.userRatingCount || 0, category: place.primaryTypeDisplayName?.text || '',
            status: 'tocall', notes: '', lastContact: '', called: false, createdAt: Date.now(), updatedAt: Date.now(),
            source: source, batchId: currentBatchId
        });
        existingIds.add(id); existingPhones.add(normPhone); added++;
    }
    if (added === 0 && places.length > 0) showAlert(places.length + ' Orte gefunden, aber keiner hatte eine Telefonnummer. Bitte andere Nische versuchen.', 'warn');
    else { showAlert(added + ' neue Lead' + (added !== 1 ? 's' : '') + ' gefunden.', 'info'); addHistory('search', added + ' Leads ueber Google Places gefunden', locationName || 'Unbekannter Standort'); }
    saveData(); renderDashboard(); renderTable(); updateCategoryFilter(); syncToCloud();
}

function setSearching(active) {
    isSearching = active;
    const btn = $('searchBtn');
    const text = $('searchBtnText');
    if (active) { btn.disabled = true; text.innerHTML = '<span class="spinner"></span>Suche...'; }
    else { btn.disabled = false; text.textContent = 'Suchen'; }
}

// ============================================
// Rendering
// ============================================
function renderDashboard() {
    // Wende dieselben Filter wie in renderTable() an, damit Dashboard immer aktuelle Zahlen zeigt
    let visible = leads;

    if (activeDashboardFilter && activeDashboardFilter !== 'all') 
        visible = visible.filter(l => l.status === activeDashboardFilter);

    const statusFilter = $('filterStatus').value;
    if (statusFilter) visible = visible.filter(l => l.status === statusFilter);

    const websiteFilter = $('filterWebsite').value;
    if (websiteFilter === 'has') visible = visible.filter(l => l.website && l.website.trim() !== '');
    else if (websiteFilter === 'none') visible = visible.filter(l => !l.website || l.website.trim() === '');

    const phoneFilter = $('filterPhone').value;
    if (phoneFilter === 'has') visible = visible.filter(l => l.phone && l.phone.trim() !== '');
    else if (phoneFilter === 'none') visible = visible.filter(l => !l.phone || l.phone.trim() === '');

    const ratingFilter = $('filterRating').value;
    if (ratingFilter === '4plus') visible = visible.filter(l => l.rating && l.rating >= 4);
    else if (ratingFilter === '3plus') visible = visible.filter(l => l.rating && l.rating >= 3);
    else if (ratingFilter === 'none') visible = visible.filter(l => !l.rating);

    const sourceFilter = $('filterSource').value;
    if (sourceFilter) visible = visible.filter(l => l.source === sourceFilter);

    const categoryFilter = $('filterCategory').value;
    if (categoryFilter) visible = visible.filter(l => l.category === categoryFilter);

    const textFilter = ($('filterInput').value || '').toLowerCase().trim();
    if (textFilter) visible = visible.filter(l => 
        (l.name || '').toLowerCase().includes(textFilter) || 
        (l.phone || '').toLowerCase().includes(textFilter) || 
        (l.address || '').toLowerCase().includes(textFilter) || 
        (l.category || '').toLowerCase().includes(textFilter) || 
        (l.notes || '').toLowerCase().includes(textFilter)
    );

    const counts = { total: visible.length, tocall: 0, called: 0, accepted: 0, rejected: 0, progress: 0 };
    for (const lead of visible) { const st = lead.status || 'tocall'; if (counts[st] !== undefined) counts[st]++; }

    $('dashTotal').textContent = counts.total;
    $('dashToCall').textContent = counts.tocall;
    $('dashCalled').textContent = counts.called;
    $('dashAccepted').textContent = counts.accepted;
    $('dashRejected').textContent = counts.rejected;
    $('dashProgress').textContent = counts.progress;
}

function updateCategoryFilter() {
    const select = $('filterCategory');
    const currentVal = select.value;
    const categories = [...new Set(leads.map(l => l.category).filter(Boolean))].sort();
    select.innerHTML = '<option value="">Alle</option>';
    for (const cat of categories) { const opt = document.createElement('option'); opt.value = cat; opt.textContent = cat; select.appendChild(opt); }
    select.value = currentVal;
}

function renderTable() {
    const wrap = $('resultsTableWrap');
    if (leads.length === 0) {
        wrap.innerHTML = '<div class="empty-state"><p>Gib eine Branchen-Nische ein und klicke auf Suchen, um Leads in deiner Naehe zu finden.</p><p style="margin-top:8px;color:var(--text-dim);font-size:12px">Tipp: OpenStreetMap (kostenlos) verwenden — kein API Key noetig.</p></div>';
        $('resultsCount').textContent = '0 Leads';
        return;
    }

    let visible = leads;
    if (activeDashboardFilter && activeDashboardFilter !== 'all') visible = visible.filter(l => l.status === activeDashboardFilter);
    const statusFilter = $('filterStatus').value;
    if (statusFilter) visible = visible.filter(l => l.status === statusFilter);
    const websiteFilter = $('filterWebsite').value;
    if (websiteFilter === 'has') visible = visible.filter(l => l.website && l.website.trim() !== '');
    else if (websiteFilter === 'none') visible = visible.filter(l => !l.website || l.website.trim() === '');
    const phoneFilter = $('filterPhone').value;
    if (phoneFilter === 'has') visible = visible.filter(l => l.phone && l.phone.trim() !== '');
    else if (phoneFilter === 'none') visible = visible.filter(l => !l.phone || l.phone.trim() === '');
    const ratingFilter = $('filterRating').value;
    if (ratingFilter === '4plus') visible = visible.filter(l => l.rating && l.rating >= 4);
    else if (ratingFilter === '3plus') visible = visible.filter(l => l.rating && l.rating >= 3);
    else if (ratingFilter === 'none') visible = visible.filter(l => !l.rating);
    const sourceFilter = $('filterSource').value;
    if (sourceFilter) visible = visible.filter(l => l.source === sourceFilter);
    const categoryFilter = $('filterCategory').value;
    if (categoryFilter) visible = visible.filter(l => l.category === categoryFilter);
    const textFilter = ($('filterInput').value || '').toLowerCase().trim();
    if (textFilter) visible = visible.filter(l => (l.name || '').toLowerCase().includes(textFilter) || (l.phone || '').toLowerCase().includes(textFilter) || (l.address || '').toLowerCase().includes(textFilter) || (l.category || '').toLowerCase().includes(textFilter) || (l.notes || '').toLowerCase().includes(textFilter));

    $('resultsCount').textContent = visible.length + ' von ' + leads.length + ' Leads';

    if (visible.length === 0) {
        wrap.innerHTML = '<div class="empty-state"><p>Keine Leads entsprechen deinen Filtern.</p><p style="margin-top:8px;color:var(--text-dim);font-size:12px">Versuche die Filter anzupassen oder neue Leads zu suchen.</p></div>';
        return;
    }

    // Sortierung: Status-Reihenfolge, dann batchId absteigend (neueste zuerst), dann Name
    // BUGFIX: 'aa' war nicht definiert! Jetzt korrekt mit a.batchId und b.batchId
    const statusOrder = { tocall: 0, called: 1, progress: 2, accepted: 3, rejected: 4 };
    visible = [...visible].sort((a, b) => {
        const oa = statusOrder[a.status] ?? 99;
        const ob = statusOrder[b.status] ?? 99;
        if (oa !== ob) return oa - ob;
        const batchA = a.batchId || 0;
        const batchB = b.batchId || 0;
        if (batchB !== batchA) return batchB - batchA; // absteigend: neueste zuerst
        return (a.name || '').localeCompare(b.name || '');
    });

    const statusOptions = [
        { value: 'tocall', label: '\u2610 Anrufen' },
        { value: 'called', label: '\uD83D\uDCDE Angerufen' },
        { value: 'rejected', label: '\u274C Abgelehnt' },
        { value: 'accepted', label: '\u2705 Akzeptiert' },
        { value: 'progress', label: '\uD83D\uDFE1 In Bearbeitung' }
    ];

    let html = '<table><thead><tr>';
    html += '<th class="td-check"><input type="checkbox" id="selectAll" title="Alle auswaehlen"></th>';
    html += '<th>Status</th><th>Unternehmen</th><th>Telefon</th><th>Adresse</th><th>Webseite</th><th>Karte</th><th>Bewertung</th><th>Rezensionen</th><th>Notizen</th><th>Letzter Kontakt</th><th></th>';
    html += '</tr></thead><tbody>';

    let lastBatchId = null;
    let batchCounter = 0;

    for (const lead of visible) {
        const leadBatchId = lead.batchId || 0;
        // Roter Separator bei Batch-Wechsel
        if (lastBatchId !== null && leadBatchId !== lastBatchId && leadBatchId > 0) {
            batchCounter++;
            html += '<tr class="new-batch-separator"><td colspan="12">\u{1F504} Neue Such-Batch #' + batchCounter + ' &mdash; ' + new Date(lead.createdAt || Date.now()).toLocaleString('de-DE') + '</td></tr>';
        }
        lastBatchId = leadBatchId;

        const statusClass = 'status-' + (lead.status || 'tocall');
        const ratingStars = lead.rating ? renderStars(lead.rating) : '\u2014';
        const websiteLink = lead.website ? '<a href="' + escAttr(lead.website) + '" target="_blank" rel="noopener" class="website-link">' + esc(shortUrl(lead.website)) + '</a>' : '<span style="color:var(--text-dim)">\u2014</span>';
        const mapsLink = lead.mapsLink ? '<a href="' + escAttr(lead.mapsLink) + '" target="_blank" rel="noopener" class="maps-link" title="Karte oeffnen">\uD83D\uDCCD</a>' : '\u2014';
        const sourceBadge = lead.source === 'osm' ? '<span style="font-size:10px;color:var(--text-dim);margin-left:4px">[OSM]</span>' : '';
        let statusSelect = '<select class="status-select" data-id="' + escAttr(lead.id) + '">';
        for (const o of statusOptions) statusSelect += '<option value="' + o.value + '"' + (lead.status === o.value ? ' selected' : '') + '>' + o.label + '</option>';
        statusSelect += '</select>';

        html += '<tr class="' + statusClass + '">';
        html += '<td class="td-check"><input type="checkbox" class="lead-check" data-id="' + escAttr(lead.id) + '"' + (lead.called ? ' checked' : '') + '></td>';
        html += '<td>' + statusSelect + '</td>';
        html += '<td><strong>' + esc(lead.name) + '</strong>' + sourceBadge + '<br><span style="color:var(--text-muted);font-size:11px">' + esc(lead.category || '') + '</span></td>';
        html += '<td><a href="tel:' + escAttr(lead.phone) + '" class="phone-link">' + esc(lead.phone) + '</a></td>';
        html += '<td>' + esc(lead.address || '') + '</td>';
        html += '<td>' + websiteLink + '</td>';
        html += '<td>' + mapsLink + '</td>';
        html += '<td class="rating-cell">' + ratingStars + '</td>';
        html += '<td>' + (lead.reviews || 0) + '</td>';
        html += '<td><input type="text" class="note-input" data-id="' + escAttr(lead.id) + '" value="' + escAttr(lead.notes || '') + '" placeholder="Notizen..."></td>';
        html += '<td><input type="date" class="contact-date" data-id="' + escAttr(lead.id) + '" value="' + escAttr(lead.lastContact || '') + '"></td>';
        html += '<td><button class="del-btn" data-id="' + escAttr(lead.id) + '" title="Loeschen">\u00D7</button></td>';
        html += '</tr>';
    }

    html += '</tbody></table>';
    wrap.innerHTML = html;
    attachTableListeners();
}

function renderStars(rating) {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    const empty = 5 - full - (half ? 1 : 0);
    let stars = '';
    for (let i = 0; i < full; i++) stars += '\u2605';
    if (half) stars += '\u00BD';
    for (let i = 0; i < empty; i++) stars += '\u2606';
    return '<span class="rating-stars">' + stars + '</span><span class="rating-num">' + rating.toFixed(1) + '</span>';
}

function attachTableListeners() {
    document.querySelectorAll('.status-select').forEach(el => {
        el.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            const lead = leads.find(l => l.id === id);
            if (lead) {
                const oldStatus = lead.status;
                lead.status = e.target.value;
                lead.updatedAt = Date.now();
                if (e.target.value === 'called') lead.called = true;
                saveData(); renderDashboard(); renderTable();
                addHistory('status', '"' + lead.name + '" von ' + oldStatus + ' auf ' + lead.status + ' geaendert');
            }
        });
    });
    document.querySelectorAll('.lead-check').forEach(el => {
        el.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            const lead = leads.find(l => l.id === id);
            if (lead) {
                lead.called = e.target.checked;
                lead.updatedAt = Date.now();
                if (lead.called && lead.status === 'tocall') lead.status = 'called';
                else if (!lead.called && lead.status === 'called') lead.status = 'tocall';
                saveData(); renderDashboard(); renderTable();
            }
        });
    });
    document.querySelectorAll('.note-input').forEach(el => {
        el.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            const lead = leads.find(l => l.id === id);
            if (lead) { lead.notes = e.target.value; lead.updatedAt = Date.now(); saveData(); addHistory('note', 'Notiz zu "' + lead.name + '" hinzugefuegt'); }
        });
    });
    document.querySelectorAll('.contact-date').forEach(el => {
        el.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            const lead = leads.find(l => l.id === id);
            if (lead) { lead.lastContact = e.target.value; lead.updatedAt = Date.now(); saveData(); addHistory('contact', 'Kontaktdatum fuer "' + lead.name + '" aktualisiert', e.target.value); }
        });
    });
    document.querySelectorAll('.del-btn').forEach(el => {
        el.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            const lead = leads.find(l => l.id === id);
            if (lead && confirm('"' + lead.name + '" loeschen?')) {
                leads = leads.filter(l => l.id !== id); saveData(); renderDashboard(); renderTable(); updateCategoryFilter(); addHistory('delete', '"' + lead.name + '" geloescht');
            }
        });
    });
    const selectAll = $('selectAll');
    if (selectAll) {
        selectAll.addEventListener('change', (e) => {
            const checked = e.target.checked;
            document.querySelectorAll('.lead-check').forEach(cb => {
                cb.checked = checked;
                const id = cb.dataset.id;
                const lead = leads.find(l => l.id === id);
                if (lead) {
                    lead.called = checked; lead.updatedAt = Date.now();
                    if (checked && lead.status === 'tocall') lead.status = 'called';
                    else if (!checked && lead.status === 'called') lead.status = 'tocall';
                }
            });
            saveData(); renderDashboard(); renderTable();
        });
    }
}

// ============================================
// CSV Export
// ============================================
function exportCSV() {
    if (leads.length === 0) { showAlert('Keine Leads zum Exportieren.', 'warn'); return; }
    const headers = ['Status','Unternehmen','Telefon','Adresse','Webseite','Kartenlink','Bewertung','Rezensionen','Kategorie','Notizen','Letzter Kontakt','Angerufen','Quelle'];
    const statusLabels = { tocall: 'Anrufen', called: 'Angerufen', rejected: 'Abgelehnt', accepted: 'Akzeptiert', progress: 'In Bearbeitung' };
    const rows = leads.map(l => [statusLabels[l.status] || l.status, l.name, l.phone, l.address, l.website, l.mapsLink, l.rating ?? '', l.reviews, l.category, l.notes, l.lastContact, l.called ? 'Ja' : 'Nein', l.source || 'google']);
    const csvContent = [headers, ...rows].map(row => row.map(cell => { const str = String(cell ?? '').replace(/"/g, '""'); return /[",\n]/.test(str) ? '"' + str + '"' : str; }).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'cold-call-leads-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    showAlert(leads.length + ' Lead' + (leads.length !== 1 ? 's' : '') + ' als CSV exportiert.', 'info');
    addHistory('export', leads.length + ' Leads als CSV exportiert');
}

// ============================================
// Data Persistence
// ============================================
function saveData() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(leads)); } catch (e) { showAlert('Warnung: Lokaler Speicher ist voll. Bitte Daten exportieren um Verlust zu vermeiden.', 'warn'); }
    if (jsonbinKey && jsonbinId) syncToCloud();
}
function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                leads = parsed;
                const maxBatch = Math.max(...leads.map(l => l.batchId || 0), 0);
                currentBatchId = maxBatch;
                renderDashboard(); renderTable(); updateCategoryFilter();
            }
        }
    } catch (e) { console.warn('Fehler beim Laden aus localStorage:', e); }
}

// ============================================
// Utilities
// ============================================
function esc(str) { return String(str ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function escAttr(str) { return String(str ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function shortUrl(url) { try { const u = new URL(url); return u.hostname.replace(/^www\./, ''); } catch { return url; } }
function showAlert(message, type) {
    const existing = document.querySelector('.alert');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.className = 'alert alert-' + type;
    div.textContent = message;
    const searchSection = document.querySelector('.search-section');
    searchSection.parentNode.insertBefore(div, searchSection);
    setTimeout(() => { if (div.parentNode) div.remove(); }, 6000);
}
function clearAlert() { const existing = document.querySelector('.alert'); if (existing) existing.remove(); }
