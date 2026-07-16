'use strict';

/* =========================================================
   Cold Call Finder – optimierte Version
   Alle Funktionen wie gehabt, Bugs behoben.
   ========================================================= */

// ===== Konfiguration =====
const PASSWORD = '26.Af.10';
const STORAGE_KEY = 'coldcallfinder_data';
const STORAGE_AUTH = 'coldcallfinder_auth';
const STORAGE_HISTORY = 'coldcallfinder_history';
const STORAGE_PROVIDER = 'coldcallfinder_provider';
const STORAGE_FILTERS = 'coldcallfinder_filters';
const STORAGE_JSONBIN_KEY = 'coldcallfinder_jsonbin_key';
const STORAGE_JSONBIN_ID = 'coldcallfinder_jsonbin_id';
const STORAGE_API_KEY = 'coldcallfinder_apikey';
const JSONBIN_API = 'https://api.jsonbin.io/v3';
const OVERPASS_URLS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
];

// ===== State =====
let leads = [];
let userLocation = null;
let locationName = '';
let isSearching = false;
let searchProvider = 'osm';
let activeDashboardFilter = '';
let history = [];
let jsonbinKey = '';
let jsonbinId = '';
let currentBatchId = 0;
let locationRequested = false;
let syncTimer = null;
let alertTimer = null;
let syncMsgTimer = null;

const $ = id => document.getElementById(id);

// ===== Nischen-Katalog =====
const NICHE_CATALOG = {
    'Essen & Trinken': ['restaurant', 'fast food', 'cafe', 'bar', 'pub', 'biergarten', 'ice cream', 'bakery', 'butcher', 'convenience', 'supermarket', 'food court', 'kitchen'],
    'Gesundheit': ['dentist', 'doctor', 'clinic', 'hospital', 'pharmacy', 'veterinary', 'nursing home', 'social facility'],
    'Beauty & Wellness': ['hairdresser', 'beauty', 'spa', 'sauna', 'massage', 'yoga', 'nail salon', 'tanning', 'tattoo', 'piercing'],
    'Fitness & Sport': ['gym', 'fitness', 'sports centre', 'swimming pool', 'bowling', 'skating', 'ice rink', 'golf course', 'mini golf', 'stadium', 'dance', 'martial arts', 'climbing', 'tennis'],
    'Automobil': ['car repair', 'mechanic', 'car wash', 'fuel', 'charging station', 'car rental', 'car sharing', 'tyres', 'motorcycle', 'truck'],
    'Professionelle Dienstleistungen': ['lawyer', 'attorney', 'accountant', 'real estate', 'insurance', 'bank', 'notary', 'architect', 'consulting', 'marketing'],
    'Heimwerker & Handwerk': ['plumber', 'electrician', 'roofer', 'carpenter', 'painter', 'locksmith', 'cleaning', 'gardening', 'landscaping', 'moving', 'hvac', 'pest control', 'handyman'],
    'Einzelhandel': ['clothing', 'shoes', 'jewelry', 'watch', 'electronics', 'phone', 'computer', 'bookstore', 'toy', 'furniture', 'hardware', 'paint', 'garden centre', 'florist', 'pet', 'optician', 'stationery', 'photo', 'copyshop', 'laundry', 'dry cleaning', 'tailor', 'antiques', 'bed', 'carpet', 'lighting', 'tiles', 'doors', 'security', 'tool hire', 'trade'],
    'Kunst & Unterhaltung': ['cinema', 'theatre', 'museum', 'gallery', 'casino', 'nightclub', 'music venue', 'arts centre', 'library', 'community centre', 'conference centre', 'events venue'],
    'Reisen & Gastgewerbe': ['hotel', 'motel', 'hostel', 'guest house', 'bed and breakfast', 'campsite', 'travel agency', 'taxi', 'bus station', 'train station', 'ferry terminal', 'airport'],
    'Bildung': ['school', 'university', 'college', 'kindergarten', 'language school', 'music school', 'driving school', 'surf school', 'training', 'research institute', 'library'],
    'Technologie': ['computer', 'electronics', 'phone', 'software', 'internet cafe', 'gaming', 'video games', 'camera', 'drone'],
    'Bau & Handwerk': ['hardware', 'paint', 'plumber', 'electrician', 'carpenter', 'roofer', 'flooring', 'tiles', 'doors', 'kitchen', 'tool hire', 'trade', 'builder', 'contractor'],
    'Sonstiges': ['post office', 'police', 'fire station', 'townhall', 'courthouse', 'prison', 'marketplace', 'place of worship', 'funeral hall', 'crematorium', 'mortuary', 'internet cafe']
};
const ALL_NICHES = [...new Set(Object.values(NICHE_CATALOG).flat())];

// ===== OSM-Tag-Mapping =====
const OSM_TAG_MAP = {
    'restaurant': ['amenity=restaurant', 'amenity=fast_food'],
    'restaurants': ['amenity=restaurant', 'amenity=fast_food'],
    'fast food': ['amenity=fast_food'],
    'cafe': ['amenity=cafe'],
    'cafes': ['amenity=cafe'],
    'bar': ['amenity=bar', 'amenity=pub'],
    'bars': ['amenity=bar', 'amenity=pub'],
    'pub': ['amenity=pub'],
    'biergarten': ['amenity=biergarten'],
    'ice cream': ['amenity=ice_cream'],
    'hotel': ['tourism=hotel', 'tourism=motel'],
    'hotels': ['tourism=hotel', 'tourism=motel'],
    'motel': ['tourism=motel'],
    'hostel': ['tourism=hostel'],
    'hostels': ['tourism=hostel'],
    'guest house': ['tourism=guest_house'],
    'bed and breakfast': ['tourism=guest_house'],
    'bnb': ['tourism=guest_house'],
    'campsite': ['tourism=camp_site'],
    'camping': ['tourism=camp_site'],
    'dentist': ['amenity=dentist'],
    'dentists': ['amenity=dentist'],
    'doctor': ['amenity=doctors'],
    'doctors': ['amenity=doctors'],
    'clinic': ['amenity=clinic'],
    'clinics': ['amenity=clinic'],
    'hospital': ['amenity=hospital'],
    'pharmacy': ['amenity=pharmacy'],
    'pharmacies': ['amenity=pharmacy'],
    'veterinary': ['amenity=veterinary'],
    'vet': ['amenity=veterinary'],
    'nursing home': ['amenity=social_facility', 'social_facility=nursing_home'],
    'social facility': ['amenity=social_facility'],
    'hair': ['shop=hairdresser'],
    'hairdresser': ['shop=hairdresser'],
    'hair salon': ['shop=hairdresser'],
    'salon': ['shop=hairdresser', 'shop=beauty'],
    'beauty': ['shop=beauty'],
    'nail salon': ['shop=beauty', 'beauty=nails'],
    'tanning': ['shop=beauty', 'beauty=tanning'],
    'spa': ['leisure=spa'],
    'sauna': ['leisure=sauna'],
    'massage': ['shop=massage'],
    'yoga': ['leisure=yoga', 'sport=yoga'],
    'gym': ['leisure=fitness_centre', 'leisure=sports_centre'],
    'gyms': ['leisure=fitness_centre', 'leisure=sports_centre'],
    'fitness': ['leisure=fitness_centre'],
    'sports centre': ['leisure=sports_centre'],
    'swimming pool': ['leisure=swimming_pool'],
    'pool': ['leisure=swimming_pool'],
    'bowling': ['leisure=bowling_alley'],
    'skating': ['leisure=ice_rink'],
    'ice rink': ['leisure=ice_rink'],
    'golf course': ['leisure=golf_course'],
    'mini golf': ['leisure=miniature_golf'],
    'stadium': ['leisure=stadium'],
    'stadiums': ['leisure=stadium'],
    'dance': ['leisure=dance', 'amenity=dancing_school'],
    'martial arts': ['sport=martial_arts', 'leisure=sports_centre'],
    'climbing': ['sport=climbing', 'leisure=sports_centre'],
    'tennis': ['sport=tennis', 'leisure=sports_centre'],
    'plumber': ['craft=plumber'],
    'plumbers': ['craft=plumber'],
    'electrician': ['craft=electrician'],
    'electricians': ['craft=electrician'],
    'roofer': ['craft=roofer'],
    'roofers': ['craft=roofer'],
    'carpenter': ['craft=carpenter'],
    'carpenters': ['craft=carpenter'],
    'painter': ['craft=painter'],
    'locksmith': ['craft=locksmith', 'shop=locksmith'],
    'cleaning': ['shop=cleaning'],
    'gardening': ['shop=garden_centre'],
    'landscaping': ['craft=landscaper'],
    'moving': ['shop=moving'],
    'hvac': ['craft=hvac'],
    'pest control': ['shop=pest_control'],
    'handyman': ['craft=handyman'],
    'mechanic': ['shop=car_repair'],
    'mechanics': ['shop=car_repair'],
    'car repair': ['shop=car_repair'],
    'car wash': ['amenity=car_wash'],
    'fuel': ['amenity=fuel'],
    'gas': ['amenity=fuel'],
    'gas station': ['amenity=fuel'],
    'charging station': ['amenity=charging_station'],
    'car rental': ['amenity=car_rental'],
    'car sharing': ['amenity=car_sharing'],
    'tyres': ['shop=tyres'],
    'motorcycle': ['shop=motorcycle'],
    'truck': ['shop=truck'],
    'lawyer': ['office=lawyer'],
    'lawyers': ['office=lawyer'],
    'attorney': ['office=lawyer'],
    'attorneys': ['office=lawyer'],
    'accountant': ['office=accountant'],
    'accountants': ['office=accountant'],
    'real estate': ['office=estate_agent'],
    'realtor': ['office=estate_agent'],
    'realtors': ['office=estate_agent'],
    'estate agent': ['office=estate_agent'],
    'insurance': ['office=insurance'],
    'bank': ['amenity=bank'],
    'banks': ['amenity=bank'],
    'notary': ['office=notary'],
    'architect': ['office=architect'],
    'consulting': ['office=consulting'],
    'marketing': ['office=advertising_agency', 'office=marketing'],
    'supermarket': ['shop=supermarket'],
    'supermarkets': ['shop=supermarket'],
    'bakery': ['shop=bakery'],
    'bakeries': ['shop=bakery'],
    'butcher': ['shop=butcher'],
    'butchers': ['shop=butcher'],
    'florist': ['shop=florist'],
    'florists': ['shop=florist'],
    'optician': ['shop=optician'],
    'opticians': ['shop=optician'],
    'shoe': ['shop=shoes'],
    'shoes': ['shop=shoes'],
    'clothing': ['shop=clothes'],
    'clothes': ['shop=clothes'],
    'pet': ['shop=pet'],
    'pets': ['shop=pet'],
    'tattoo': ['shop=tattoo'],
    'tattoos': ['shop=tattoo'],
    'piercing': ['shop=piercing'],
    'laundry': ['shop=laundry'],
    'dry cleaning': ['shop=dry_cleaning'],
    'tailor': ['shop=tailor'],
    'tailors': ['shop=tailor'],
    'jewelry': ['shop=jewelry'],
    'jeweller': ['shop=jewelry'],
    'jewellers': ['shop=jewelry'],
    'watch': ['shop=watches'],
    'watches': ['shop=watches'],
    'electronics': ['shop=electronics'],
    'phone': ['shop=mobile_phone'],
    'phones': ['shop=mobile_phone'],
    'computer': ['shop=computer'],
    'computers': ['shop=computer'],
    'software': ['shop=software', 'office=software'],
    'bookstore': ['shop=books'],
    'toy': ['shop=toys'],
    'furniture': ['shop=furniture'],
    'hardware': ['shop=hardware'],
    'paint': ['shop=paint'],
    'garden centre': ['shop=garden_centre'],
    'stationery': ['shop=stationery'],
    'photo': ['shop=photo'],
    'copyshop': ['shop=copyshop'],
    'antiques': ['shop=antiques'],
    'bed': ['shop=bed'],
    'carpet': ['shop=carpet'],
    'lighting': ['shop=lighting'],
    'tiles': ['shop=tiles'],
    'doors': ['shop=doors'],
    'security': ['shop=security'],
    'tool hire': ['shop=tool_hire'],
    'trade': ['shop=trade'],
    'cinema': ['amenity=cinema'],
    'theatre': ['amenity=theatre'],
    'museum': ['tourism=museum'],
    'gallery': ['tourism=gallery'],
    'casino': ['amenity=casino'],
    'nightclub': ['amenity=nightclub'],
    'music venue': ['amenity=music_venue'],
    'arts centre': ['amenity=arts_centre'],
    'library': ['amenity=library'],
    'community centre': ['amenity=community_centre'],
    'conference centre': ['amenity=conference_centre'],
    'events venue': ['amenity=events_venue'],
    'travel agency': ['shop=travel_agency'],
    'taxi': ['amenity=taxi'],
    'bus station': ['amenity=bus_station'],
    'train station': ['amenity=train_station'],
    'ferry terminal': ['amenity=ferry_terminal'],
    'airport': ['aeroway=aerodrome'],
    'school': ['amenity=school'],
    'university': ['amenity=university'],
    'college': ['amenity=college'],
    'kindergarten': ['amenity=kindergarten'],
    'language school': ['amenity=language_school'],
    'music school': ['amenity=music_school'],
    'driving school': ['amenity=driving_school'],
    'surf school': ['amenity=surf_school'],
    'training': ['amenity=training'],
    'research institute': ['amenity=research_institute'],
    'internet cafe': ['amenity=internet_cafe'],
    'gaming': ['shop=video_games'],
    'video games': ['shop=video_games'],
    'camera': ['shop=camera'],
    'drone': ['shop=drone'],
    'flooring': ['shop=flooring'],
    'builder': ['craft=builder'],
    'contractor': ['craft=contractor'],
    'post office': ['amenity=post_office'],
    'police': ['amenity=police'],
    'fire station': ['amenity=fire_station'],
    'townhall': ['amenity=townhall'],
    'courthouse': ['amenity=courthouse'],
    'prison': ['amenity=prison'],
    'marketplace': ['amenity=marketplace'],
    'place of worship': ['amenity=place_of_worship'],
    'funeral hall': ['amenity=funeral_hall'],
    'crematorium': ['amenity=crematorium'],
    'mortuary': ['amenity=mortuary'],
    'convenience': ['shop=convenience'],
    'food court': ['amenity=food_court'],
    'kitchen': ['shop=kitchen']
};

// ===== Initialisierung =====
document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    bindTableEvents();
    loadData();
    restoreBatchCounter();
    loadHistory();
    initJsonbin();
    initProviderToggle();
    initNicheDropdown();
    updateCategoryFilter();
    initFilters();
    initAuth();
    renderDashboard();
    renderTable();
});

// ===== Auth =====
function initAuth() {
    if (localStorage.getItem(STORAGE_AUTH) === 'true') showApp();
    else showLogin();
}
function showLogin() {
    $('loginScreen').style.display = 'flex';
    $('appScreen').style.display = 'none';
    $('passwordInput').focus();
}
function showApp() {
    $('loginScreen').style.display = 'none';
    $('appScreen').style.display = 'block';
    requestLocation();
    renderDashboard();
    renderTable();
    renderHistory();
}
function attemptLogin() {
    if ($('passwordInput').value.trim() === PASSWORD) {
        localStorage.setItem(STORAGE_AUTH, 'true');
        $('loginError').textContent = '';
        showApp();
    } else {
        $('loginError').textContent = 'Falsches Passwort.';
        $('passwordInput').value = '';
        $('passwordInput').focus();
    }
}
function logout() {
    localStorage.removeItem(STORAGE_AUTH);
    showLogin();
    $('passwordInput').value = '';
}

// ===== Standort =====
function requestLocation() {
    if (locationRequested) return;
    locationRequested = true;
    initLocation();
}
function initLocation() {
    if (!navigator.geolocation) {
        $('locationStatus').textContent = 'Geolocation nicht unterstützt. Bitte manuellen Standort verwenden.';
        $('manualLocationBox').style.display = 'flex';
        return;
    }
    $('locationStatus').textContent = 'Standort wird ermittelt...';
    navigator.geolocation.getCurrentPosition(
        pos => {
            userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            $('locationStatus').textContent = 'Standort erkannt. Bereit zur Suche.';
            reverseGeocode(userLocation.lat, userLocation.lng);
        },
        err => {
            console.warn('Geolocation error:', err);
            $('locationStatus').textContent = 'Standortzugriff verweigert. Bitte manuellen Standort verwenden.';
            $('manualLocationBox').style.display = 'flex';
        },
        { timeout: 10000, maximumAge: 60000 }
    );
}
function reverseGeocode(lat, lng) {
    fetch('https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lng + '&format=json', { headers: { 'Accept-Language': 'de' } })
        .then(r => r.json())
        .then(data => {
            if (data && data.address) {
                const city = data.address.city || data.address.town || data.address.village || data.address.county || '';
                const country = data.address.country || '';
                locationName = city + (city && country ? ', ' : '') + country;
                if (locationName) $('locationStatus').textContent = 'Standort: ' + locationName;
            }
        })
        .catch(() => {});
}
function setManualLocation() {
    const query = $('manualLocationInput').value.trim();
    if (!query) return;
    $('locationStatus').textContent = 'Standort wird gesucht...';
    fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(query) + '&format=json&limit=1', { headers: { 'Accept-Language': 'de' } })
        .then(r => r.json())
        .then(data => {
            if (data && data.length > 0) {
                userLocation = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
                locationName = data[0].display_name.split(',')[0];
                $('locationStatus').textContent = 'Standort: ' + locationName;
                $('manualLocationBox').style.display = 'none';
            } else {
                $('locationStatus').textContent = 'Standort nicht gefunden. Bitte erneut versuchen.';
            }
        })
        .catch(() => {
            $('locationStatus').textContent = 'Fehler bei der Standortsuche. Bitte erneut versuchen.';
        });
}

// ===== Cloud Sync (JSONBin.io) =====
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
    clearTimeout(syncMsgTimer);
    syncMsgTimer = setTimeout(() => { msg.className = 'sync-message'; }, 5000);
}
function updateSyncStatus(status, text) {
    const el = $('syncStatus');
    el.className = 'sync-status';
    if (status === 'synced') {
        el.classList.add('synced');
        el.textContent = '✅ Synchronisiert';
    } else if (status === 'error') {
        el.classList.add('error');
        el.textContent = '❌ ' + (text || 'Sync-Fehler');
    } else if (status === 'syncing') {
        el.textContent = '⏳ Synchronisiere...';
    } else {
        el.textContent = '✅ ' + (text || 'Lokal gespeichert');
    }
}
async function connectJsonbin() {
    const key = $('jsonbinKeyInput').value.trim();
    const binId = $('jsonbinIdInput').value.trim();
    if (!key) {
        showSyncMessage('Bitte gib deinen JSONBin.io API Key ein.', 'error');
        return;
    }
    jsonbinKey = key;
    localStorage.setItem(STORAGE_JSONBIN_KEY, key);
    if (binId) {
        jsonbinId = binId;
        localStorage.setItem(STORAGE_JSONBIN_ID, binId);
        updateSyncStatus('syncing');
        const success = await syncFromCloud();
        if (success) showSyncMessage('Verbunden! Daten aus der Cloud geladen.', 'success');
        else showSyncMessage('Verbindung fehlgeschlagen. Bitte Key und Bin ID prüfen.', 'error');
    } else {
        updateSyncStatus('syncing');
        try {
            const res = await fetch(JSONBIN_API + '/b', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Master-Key': jsonbinKey, 'X-Bin-Private': 'false' },
                body: JSON.stringify({ leads: [], history: [], version: 1 })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || 'HTTP ' + res.status);
            }
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
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'HTTP ' + res.status);
        }
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
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'HTTP ' + res.status);
        }
        const data = await res.json();
        const record = data.record || {};
        if (record.leads && Array.isArray(record.leads)) {
            const merged = [...leads];
            for (const cloudLead of record.leads) {
                const idx = merged.findIndex(l => l.id === cloudLead.id);
                if (idx === -1) merged.push(cloudLead);
                else if ((cloudLead.updatedAt || cloudLead.createdAt || 0) > (merged[idx].updatedAt || merged[idx].createdAt || 0)) merged[idx] = cloudLead;
            }
            leads = merged;
            saveData();
            restoreBatchCounter();
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
        updateSyncStatus('synced');
        renderDashboard();
        renderTable();
        renderHistory();
        updateCategoryFilter();
        return true;
    } catch (err) {
        updateSyncStatus('error', err.message);
        return false;
    }
}
// Sync-Aufrufe bündeln, damit die kostenlose JSONBin-Rate-Limit nicht überschritten wird
function scheduleCloudSync() {
    if (!jsonbinKey || !jsonbinId) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncToCloud(), 2500);
}
setInterval(() => { if (jsonbinKey && jsonbinId) syncToCloud(); }, 60000);

// ===== Datei-Backup =====
function saveToFile() {
    if (leads.length === 0 && history.length === 0) {
        showAlert('Keine Daten zum Speichern.', 'warn');
        return;
    }
    const data = { leads: leads, history: history, version: 1, exportedAt: Date.now(), app: 'ColdCallFinder', exportDate: new Date().toISOString() };
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'coldcallfinder-backup-' + new Date().toISOString().slice(0, 10) + '.json');
    showAlert('Backup gespeichert! ' + leads.length + ' Leads, ' + history.length + ' Verlaufseinträge.', 'info');
    addHistory('export', 'Backup als Datei gespeichert (' + leads.length + ' Leads)');
}
function loadFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.leads || !Array.isArray(data.leads)) {
                showAlert('Ungültige Datei: Keine Leads gefunden.', 'error');
                return;
            }
            const existingIds = new Set(leads.map(l => l.id));
            let added = 0;
            for (const newLead of data.leads) {
                if (newLead && newLead.id && !existingIds.has(newLead.id)) {
                    leads.push(newLead);
                    existingIds.add(newLead.id);
                    added++;
                }
            }
            if (data.history && Array.isArray(data.history)) {
                const existingHistIds = new Set(history.map(h => h.id));
                for (const newHist of data.history) {
                    if (newHist && newHist.id && !existingHistIds.has(newHist.id)) {
                        history.push(newHist);
                        existingHistIds.add(newHist.id);
                    }
                }
                history.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                if (history.length > 200) history = history.slice(0, 200);
            }
            saveData();
            saveHistory();
            restoreBatchCounter();
            renderDashboard();
            renderTable();
            renderHistory();
            updateCategoryFilter();
            showAlert('Backup geladen! ' + added + ' neue Leads importiert. Gesamt: ' + leads.length + ' Leads.', 'info');
            addHistory('import', 'Backup aus Datei geladen (' + added + ' neue Leads)');
            scheduleCloudSync();
        } catch (err) {
            showAlert('Fehler beim Laden der Datei: ' + err.message, 'error');
        }
    };
    reader.onerror = () => showAlert('Fehler beim Lesen der Datei.', 'error');
    reader.readAsText(file);
}
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ===== Nischen-Dropdown =====
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
            item.type = 'button';
            item.textContent = niche;
            item.addEventListener('click', () => {
                $('nicheInput').value = niche;
                closeNicheModal();
            });
            nicheList.appendChild(item);
        }
    }
    const datalist = $('nicheOptions');
    datalist.innerHTML = '';
    for (const niche of ALL_NICHES) {
        const opt = document.createElement('option');
        opt.value = niche;
        datalist.appendChild(opt);
    }
    $('nicheSearchInput').addEventListener('input', e => {
        const term = e.target.value.toLowerCase().trim();
        document.querySelectorAll('.niche-item').forEach(item => {
            item.classList.toggle('hidden', !!term && !item.textContent.toLowerCase().includes(term));
        });
        // Kategorie-Header ausblenden, wenn keine sichtbaren Einträge darunter sind
        document.querySelectorAll('.niche-category-header').forEach(header => {
            let el = header.nextElementSibling;
            let anyVisible = false;
            while (el && !el.classList.contains('niche-category-header')) {
                if (el.classList.contains('niche-item') && !el.classList.contains('hidden')) anyVisible = true;
                el = el.nextElementSibling;
            }
            header.classList.toggle('hidden', !!term && !anyVisible);
        });
    });
}
function openNicheModal() {
    $('nicheModal').style.display = 'flex';
    $('nicheSearchInput').value = '';
    document.querySelectorAll('.niche-item, .niche-category-header').forEach(item => item.classList.remove('hidden'));
    $('nicheSearchInput').focus();
}
function closeNicheModal() {
    $('nicheModal').style.display = 'none';
}

// ===== Provider Toggle =====
function initProviderToggle() {
    const saved = localStorage.getItem(STORAGE_PROVIDER);
    if (saved === 'google' || saved === 'osm') searchProvider = saved;
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
        googleBtn.classList.add('active');
        osmBtn.classList.remove('active');
        $('apiKeyBox').style.display = '';
    } else {
        googleBtn.classList.remove('active');
        osmBtn.classList.add('active');
        $('apiKeyBox').style.display = 'none';
    }
}
function saveApiKey() {
    const key = $('apiKeyInput').value.trim();
    if (key) {
        localStorage.setItem(STORAGE_API_KEY, key);
        $('apiKeyInput').value = '';
        showAlert('API Key gespeichert.', 'info');
    }
}

// ===== Filter =====
function getFilteredLeads() {
    let visible = [...leads];
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
    if (textFilter) visible = visible.filter(l =>
        (l.name || '').toLowerCase().includes(textFilter) ||
        (l.phone || '').toLowerCase().includes(textFilter) ||
        (l.address || '').toLowerCase().includes(textFilter) ||
        (l.category || '').toLowerCase().includes(textFilter) ||
        (l.notes || '').toLowerCase().includes(textFilter)
    );
    return visible;
}
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
            if (f.dashboard) {
                activeDashboardFilter = f.dashboard;
                updateDashboardActiveState();
            }
        } catch (e) { /* ungültige Filterdaten ignorieren */ }
    }
    ['filterStatus', 'filterWebsite', 'filterPhone', 'filterRating', 'filterSource', 'filterCategory'].forEach(id => {
        $(id).addEventListener('change', () => { saveFilters(); renderTable(); });
    });
    $('filterInput').addEventListener('input', () => { saveFilters(); renderTable(); });
    $('resetFiltersBtn').addEventListener('click', resetFilters);
}
function saveFilters() {
    localStorage.setItem(STORAGE_FILTERS, JSON.stringify({
        status: $('filterStatus').value,
        website: $('filterWebsite').value,
        phone: $('filterPhone').value,
        rating: $('filterRating').value,
        source: $('filterSource').value,
        category: $('filterCategory').value,
        text: $('filterInput').value,
        dashboard: activeDashboardFilter
    }));
}
function resetFilters() {
    $('filterStatus').value = '';
    $('filterWebsite').value = '';
    $('filterPhone').value = '';
    $('filterRating').value = '';
    $('filterSource').value = '';
    $('filterCategory').value = '';
    $('filterInput').value = '';
    activeDashboardFilter = '';
    updateDashboardActiveState();
    saveFilters();
    renderTable();
}
function updateDashboardActiveState() {
    document.querySelectorAll('.dash-card.clickable').forEach(card => {
        card.classList.toggle('active', card.dataset.filter === activeDashboardFilter);
    });
}

// ===== Verlauf =====
function addHistory(type, text, meta) {
    meta = meta || '';
    const entry = { id: 'hist-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8), type, text, meta, timestamp: Date.now() };
    history.unshift(entry);
    if (history.length > 200) history = history.slice(0, 200);
    saveHistory();
    renderHistory();
    scheduleCloudSync();
}
function saveHistory() {
    try { localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history)); }
    catch (e) { console.warn('Verlauf konnte nicht gespeichert werden:', e); }
}
function loadHistory() {
    try {
        const raw = localStorage.getItem(STORAGE_HISTORY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) history = parsed;
        }
    } catch (e) { console.warn('Verlauf konnte nicht geladen werden:', e); }
}
function renderHistory() {
    const list = $('historyList');
    if (history.length === 0) {
        list.innerHTML = '<div class="empty-history">Noch keine Aktivität.</div>';
        return;
    }
    const icons = { search: '🔍', status: '📞', add: '➕', delete: '🗑️', export: '📤', import: '📥', clear: '🧹', note: '📝', contact: '📅' };
    let html = '';
    for (const entry of history.slice(0, 50)) {
        const date = new Date(entry.timestamp);
        const timeStr = date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const icon = icons[entry.type] || '📋';
        const metaText = entry.meta ? entry.meta + ' · ' + timeStr : timeStr;
        html += '<div class="history-item type-' + escAttr(entry.type) + '"><span class="history-icon">' + icon + '</span><div class="history-content"><div class="history-text">' + esc(entry.text) + '</div><div class="history-meta">' + esc(metaText) + '</div></div></div>';
    }
    list.innerHTML = html;
}

// ===== Event Bindings =====
function bindEvents() {
    $('loginBtn').addEventListener('click', attemptLogin);
    $('passwordInput').addEventListener('keydown', e => { if (e.key === 'Enter') attemptLogin(); });
    $('logoutBtn').addEventListener('click', logout);
    $('manualLocationBtn').addEventListener('click', () => {
        const box = $('manualLocationBox');
        box.style.display = box.style.display === 'none' ? 'flex' : 'none';
        if (box.style.display !== 'none') $('manualLocationInput').focus();
    });
    $('setLocationBtn').addEventListener('click', setManualLocation);
    $('manualLocationInput').addEventListener('keydown', e => { if (e.key === 'Enter') setManualLocation(); });
    $('searchBtn').addEventListener('click', performSearch);
    $('nicheInput').addEventListener('keydown', e => { if (e.key === 'Enter') performSearch(); });
    $('nicheDropdownBtn').addEventListener('click', openNicheModal);
    $('closeNicheModal').addEventListener('click', closeNicheModal);
    $('nicheModal').querySelector('.modal-overlay').addEventListener('click', closeNicheModal);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNicheModal(); });
    $('providerGoogle').addEventListener('click', () => setProvider('google'));
    $('providerOsm').addEventListener('click', () => setProvider('osm'));
    $('saveApiKeyBtn').addEventListener('click', saveApiKey);
    $('apiKeyInput').addEventListener('keydown', e => { if (e.key === 'Enter') saveApiKey(); });
    $('connectJsonbinBtn').addEventListener('click', connectJsonbin);
    $('syncNowBtn').addEventListener('click', () => {
        syncFromCloud().then(ok => { if (ok) showSyncMessage('Aus Cloud synchronisiert!', 'success'); });
    });
    $('saveFileBtn').addEventListener('click', saveToFile);
    $('loadFileBtn').addEventListener('click', () => $('fileInput').click());
    $('fileInput').addEventListener('change', e => {
        if (e.target.files[0]) loadFromFile(e.target.files[0]);
        e.target.value = '';
    });
    document.querySelectorAll('.dash-card.clickable').forEach(card => {
        card.addEventListener('click', () => {
            activeDashboardFilter = activeDashboardFilter === card.dataset.filter ? '' : card.dataset.filter;
            updateDashboardActiveState();
            saveFilters();
            renderTable();
        });
    });
    $('exportBtn').addEventListener('click', exportCSV);
    $('clearBtn').addEventListener('click', () => {
        if (leads.length === 0) {
            showAlert('Keine Leads vorhanden.', 'info');
            return;
        }
        if (confirm('Alle Leads löschen? Dies kann nicht rückgängig gemacht werden.')) {
            const count = leads.length;
            leads = [];
            saveData();
            renderDashboard();
            renderTable();
            updateCategoryFilter();
            addHistory('clear', 'Alle ' + count + ' Leads gelöscht');
            scheduleCloudSync();
        }
    });
    $('clearHistoryBtn').addEventListener('click', () => {
        if (confirm('Gesamten Verlauf löschen?')) {
            history = [];
            saveHistory();
            renderHistory();
            scheduleCloudSync();
        }
    });
    $('bulkDeleteBtn').addEventListener('click', bulkDelete);
    $('bulkClearBtn').addEventListener('click', clearSelection);
    $('bulkStatusSelect').addEventListener('change', e => {
        if (e.target.value) bulkSetStatus(e.target.value);
        e.target.value = '';
    });
}

// Event-Delegation für die Tabelle (statt Listener pro Zeile)
function bindTableEvents() {
    const wrap = $('resultsTableWrap');
    wrap.addEventListener('click', e => {
        const delBtn = e.target.closest('.del-btn');
        if (delBtn) deleteLead(delBtn.dataset.id);
    });
    wrap.addEventListener('change', e => {
        const t = e.target;
        if (t.classList.contains('status-select')) {
            changeLeadStatus(t.dataset.id, t.value, t.closest('tr'));
        } else if (t.classList.contains('note-input')) {
            updateLeadField(t.dataset.id, 'notes', t.value);
        } else if (t.classList.contains('contact-date')) {
            updateLeadField(t.dataset.id, 'contactDate', t.value);
        } else if (t.id === 'selectAll') {
            document.querySelectorAll('.lead-check').forEach(cb => { cb.checked = t.checked; });
            updateBulkBar();
        } else if (t.classList.contains('lead-check')) {
            updateBulkBar();
        }
    });
}

// ===== Lead-Aktionen =====
function changeLeadStatus(id, newStatus, row) {
    const lead = leads.find(l => l.id === id);
    if (lead && lead.status !== newStatus) {
        lead.status = newStatus;
        lead.updatedAt = Date.now();
        saveData();
        renderDashboard();
        if (row) row.className = 'status-' + newStatus;
        addHistory('status', 'Status geändert: ' + lead.name + ' → ' + getStatusLabel(newStatus));
        scheduleCloudSync();
    }
}
function updateLeadField(id, field, value) {
    const lead = leads.find(l => l.id === id);
    if (lead && lead[field] !== value) {
        lead[field] = value;
        lead.updatedAt = Date.now();
        saveData();
        scheduleCloudSync();
    }
}
function deleteLead(id) {
    const lead = leads.find(l => l.id === id);
    if (lead && confirm('"' + lead.name + '" wirklich löschen?')) {
        leads = leads.filter(l => l.id !== id);
        saveData();
        renderDashboard();
        renderTable();
        updateCategoryFilter();
        addHistory('delete', 'Lead gelöscht: ' + lead.name);
        scheduleCloudSync();
    }
}

// ===== Bulk-Aktionen =====
function getSelectedIds() {
    return [...document.querySelectorAll('.lead-check:checked')].map(cb => cb.dataset.id);
}
function updateBulkBar() {
    const ids = getSelectedIds();
    $('bulkBar').style.display = ids.length > 0 ? 'flex' : 'none';
    $('bulkCount').textContent = ids.length + ' ausgewählt';
}
function clearSelection() {
    document.querySelectorAll('.lead-check').forEach(cb => { cb.checked = false; });
    const selectAll = $('selectAll');
    if (selectAll) selectAll.checked = false;
    updateBulkBar();
}
function bulkDelete() {
    const ids = getSelectedIds();
    if (ids.length === 0) return;
    if (!confirm(ids.length + ' ausgewählte Leads wirklich löschen?')) return;
    const idSet = new Set(ids);
    leads = leads.filter(l => !idSet.has(l.id));
    saveData();
    renderDashboard();
    renderTable();
    updateCategoryFilter();
    addHistory('delete', ids.length + ' Leads per Mehrfachauswahl gelöscht');
    scheduleCloudSync();
}
function bulkSetStatus(newStatus) {
    const ids = getSelectedIds();
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const now = Date.now();
    let changed = 0;
    for (const lead of leads) {
        if (idSet.has(lead.id) && lead.status !== newStatus) {
            lead.status = newStatus;
            lead.updatedAt = now;
            changed++;
        }
    }
    if (changed > 0) {
        saveData();
        renderDashboard();
        renderTable();
        addHistory('status', changed + ' Leads → ' + getStatusLabel(newStatus));
        scheduleCloudSync();
    } else {
        updateBulkBar();
    }
}

// ===== Suche =====
async function performSearch() {
    if (isSearching) return;
    const niche = $('nicheInput').value.trim();
    if (!niche) {
        showAlert('Bitte gib eine Branchen-Nische ein.', 'warn');
        $('nicheInput').focus();
        return;
    }
    if (!userLocation) {
        showAlert('Standort nicht festgelegt. Bitte Geolocation erlauben oder Stadt manuell eingeben.', 'warn');
        $('manualLocationBox').style.display = 'flex';
        return;
    }
    currentBatchId++;
    if (searchProvider === 'google') await searchGoogle(niche);
    else await searchOpenStreetMap(niche);
}

// ===== Google Places =====
async function searchGoogle(niche) {
    const apiKey = localStorage.getItem(STORAGE_API_KEY);
    if (!apiKey) {
        showAlert('Google Places API Key erforderlich. Key unten eingeben oder zu OpenStreetMap (kostenlos) wechseln.', 'warn');
        $('apiKeyBox').style.display = '';
        $('apiKeyInput').focus();
        return;
    }
    const radius = parseInt($('radiusSelect').value, 10);
    setSearching(true);
    clearAlert();
    try {
        const searchBody = {
            textQuery: niche,
            locationBias: { circle: { center: { latitude: userLocation.lat, longitude: userLocation.lng }, radius: radius } },
            pageSize: 20
        };
        const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.rating,places.userRatingCount,places.primaryTypeDisplayName,places.businessStatus,places.location'
            },
            body: JSON.stringify(searchBody)
        });
        if (!searchRes.ok) {
            const errData = await searchRes.json().catch(() => ({}));
            if (searchRes.status === 403 || searchRes.status === 401) {
                localStorage.removeItem(STORAGE_API_KEY);
            }
            throw new Error((errData.error && errData.error.message) || 'HTTP ' + searchRes.status);
        }
        const searchData = await searchRes.json();
        const places = (searchData.places || []).filter(p => p.businessStatus !== 'CLOSED_PERMANENTLY');
        if (places.length === 0) {
            showAlert('Keine Unternehmen gefunden. Bitte andere Nische oder größeren Radius versuchen.', 'info');
            return;
        }
        processResults(places, 'google');
    } catch (err) {
        showAlert(err.message || 'Suche fehlgeschlagen. Bitte zu OpenStreetMap wechseln.', 'error');
    } finally {
        setSearching(false);
    }
}

// ===== OpenStreetMap (Overpass) =====
async function searchOpenStreetMap(niche) {
    const radius = parseInt($('radiusSelect').value, 10);
    setSearching(true);
    clearAlert();
    const nicheKey = niche.toLowerCase().trim();
    const tags = OSM_TAG_MAP[nicheKey] || ['amenity=' + nicheKey.replace(/\s+/g, '_')];
    const lat = userLocation.lat;
    const lng = userLocation.lng;

    let queryParts = [];
    for (const tag of tags) {
        const eq = tag.indexOf('=');
        const key = tag.slice(0, eq);
        const val = tag.slice(eq + 1);
        queryParts.push('node["' + key + '"="' + val + '"](around:' + radius + ',' + lat + ',' + lng + ');');
        queryParts.push('way["' + key + '"="' + val + '"](around:' + radius + ',' + lat + ',' + lng + ');');
        queryParts.push('relation["' + key + '"="' + val + '"](around:' + radius + ',' + lat + ',' + lng + ');');
    }
    const query = '[out:json][timeout:30];(' + queryParts.join('') + ');out center tags 50;';

    try {
        let elements = null;
        let lastError = null;
        for (const url of OVERPASS_URLS) {
            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: 'data=' + encodeURIComponent(query)
                });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                elements = data.elements || [];
                break;
            } catch (err) {
                lastError = err;
            }
        }
        if (elements === null) throw lastError || new Error('Alle Overpass-Server nicht erreichbar.');
        if (elements.length === 0) {
            showAlert('Keine Unternehmen gefunden. Bitte andere Nische oder größeren Radius versuchen.', 'info');
            return;
        }
        processResults(elements, 'osm');
    } catch (err) {
        showAlert('Suche fehlgeschlagen: ' + err.message, 'error');
    } finally {
        setSearching(false);
    }
}

// ===== Ergebnisse verarbeiten =====
function processResults(items, source) {
    const newLeads = [];
    const now = Date.now();
    const existingIds = new Set(leads.map(l => l.id));
    const nicheValue = $('nicheInput').value.trim();
    let skippedUnnamed = 0;

    if (source === 'google') {
        for (const place of items) {
            const id = 'google-' + place.id;
            if (existingIds.has(id)) continue;
            newLeads.push({
                id: id,
                name: (place.displayName && place.displayName.text) || 'Unbekannt',
                address: place.formattedAddress || '',
                phone: place.internationalPhoneNumber || '',
                website: normalizeUrl(place.websiteUri || ''),
                mapsUrl: place.googleMapsUri || '',
                rating: place.rating || null,
                ratingCount: place.userRatingCount || 0,
                category: (place.primaryTypeDisplayName && place.primaryTypeDisplayName.text) || nicheValue,
                status: 'tocall',
                notes: '',
                contactDate: '',
                source: 'google',
                batchId: currentBatchId,
                createdAt: now,
                updatedAt: now,
                lat: (place.location && place.location.latitude) || null,
                lng: (place.location && place.location.longitude) || null
            });
            existingIds.add(id);
        }
    } else {
        for (const el of items) {
            if (el.type !== 'node' && el.type !== 'way' && el.type !== 'relation') continue;
            const id = 'osm-' + el.type + '-' + el.id;
            if (existingIds.has(id)) continue;
            const tags = el.tags || {};
            const name = tags.name || tags['name:de'] || '';
            if (!name) {
                skippedUnnamed++;
                continue;
            }
            const center = el.center || {};
            const lat = el.lat || center.lat || null;
            const lon = el.lon || center.lon || null;
            newLeads.push({
                id: id,
                name: name,
                address: buildAddress(tags),
                phone: tags.phone || tags['contact:phone'] || tags['contact:mobile'] || tags.telephone || '',
                website: normalizeUrl(tags.website || tags['contact:website'] || tags['contact:facebook'] || tags['contact:instagram'] || ''),
                mapsUrl: lat && lon ? 'https://www.openstreetmap.org/' + el.type + '/' + el.id : '',
                rating: null,
                ratingCount: 0,
                category: nicheValue || 'Unbekannt',
                status: 'tocall',
                notes: '',
                contactDate: '',
                source: 'osm',
                batchId: currentBatchId,
                createdAt: now,
                updatedAt: now,
                lat: lat,
                lng: lon
            });
            existingIds.add(id);
        }
    }

    if (newLeads.length === 0) {
        showAlert('Keine neuen Leads gefunden. Möglicherweise sind alle bereits in der Liste.', 'info');
        return;
    }

    leads.unshift(...newLeads);
    saveData();
    renderDashboard();
    renderTable();
    updateCategoryFilter();
    const skipNote = skippedUnnamed > 0 ? ' (' + skippedUnnamed + ' Einträge ohne Namen übersprungen)' : '';
    showAlert(newLeads.length + ' neue Leads gefunden!' + skipNote, 'info');
    addHistory('search', newLeads.length + ' neue Leads gefunden (' + source + ', ' + (nicheValue || 'Unbekannt') + ')' + skipNote, locationName);
    scheduleCloudSync();
}

function buildAddress(tags) {
    const parts = [];
    if (tags['addr:street']) parts.push(tags['addr:street'] + (tags['addr:housenumber'] ? ' ' + tags['addr:housenumber'] : ''));
    else if (tags['addr:place']) parts.push(tags['addr:place']);
    if (tags['addr:postcode']) parts.push(tags['addr:postcode']);
    if (tags['addr:city']) parts.push(tags['addr:city']);
    if (tags['addr:country']) parts.push(tags['addr:country']);
    return parts.join(', ');
}

// ===== Tabelle rendern =====
function renderTable() {
    const filtered = getFilteredLeads();
    const wrap = $('resultsTableWrap');
    $('resultsCount').textContent = filtered.length + ' Leads';

    if (filtered.length === 0) {
        wrap.innerHTML = '<div class="empty-state" id="emptyState"><p>' + (leads.length === 0 ? 'Gib eine Branchen-Nische ein und klicke auf Suchen, um Leads in deiner Nähe zu finden.' : 'Keine Leads entsprechen den aktuellen Filtern.') + '</p></div>';
        updateBulkBar();
        return;
    }

    let html = '<table><thead><tr><th class="td-check"><input type="checkbox" id="selectAll" title="Alle auswählen"></th><th>Name</th><th>Adresse</th><th>Telefon</th><th>Webseite</th><th>Karte</th><th>Bewertung</th><th>Kategorie</th><th>Status</th><th>Notizen</th><th>Kontakt</th><th>Quelle</th><th></th></tr></thead><tbody>';
    let lastBatchId = null;

    for (const lead of filtered) {
        const batchId = lead.batchId || 0;
        if (lastBatchId !== null && batchId !== lastBatchId) {
            html += '<tr class="new-batch-separator"><td colspan="13">' + (batchId > 0 ? 'Suchlauf #' + batchId : 'Ältere Leads') + '</td></tr>';
        }
        lastBatchId = batchId;

        const statusClass = 'status-' + (lead.status || 'tocall');
        const phoneHtml = lead.phone ? '<a href="tel:' + escAttr(lead.phone) + '" class="phone-link">' + esc(formatPhone(lead.phone)) + '</a>' : '<span class="cell-empty">—</span>';
        const websiteHtml = lead.website ? '<a href="' + escAttr(lead.website) + '" class="website-link" target="_blank" rel="noopener">Webseite</a>' : '<span class="cell-empty">—</span>';
        const mapsHtml = lead.mapsUrl ? '<a href="' + escAttr(lead.mapsUrl) + '" class="maps-link" target="_blank" rel="noopener" title="Auf Karte öffnen">&#128506;&#65039;</a>' : '<span class="cell-empty">—</span>';
        const ratingHtml = lead.rating ? '<span class="rating-stars">' + getStars(lead.rating) + '</span><span class="rating-num">' + lead.rating + '</span>' : '<span class="cell-empty">—</span>';
        const sourceLabel = lead.source === 'google' ? 'Google' : 'OSM';

        html += '<tr class="' + escAttr(statusClass) + '" data-id="' + escAttr(lead.id) + '">';
        html += '<td class="td-check"><input type="checkbox" class="lead-check" data-id="' + escAttr(lead.id) + '"></td>';
        html += '<td>' + esc(lead.name) + '</td>';
        html += '<td>' + esc(lead.address || '—') + '</td>';
        html += '<td>' + phoneHtml + '</td>';
        html += '<td>' + websiteHtml + '</td>';
        html += '<td>' + mapsHtml + '</td>';
        html += '<td class="rating-cell">' + ratingHtml + '</td>';
        html += '<td>' + esc(lead.category || '—') + '</td>';
        html += '<td><select class="status-select" data-id="' + escAttr(lead.id) + '">';
        html += '<option value="tocall"' + (lead.status === 'tocall' ? ' selected' : '') + '>Anrufen</option>';
        html += '<option value="called"' + (lead.status === 'called' ? ' selected' : '') + '>Angerufen</option>';
        html += '<option value="accepted"' + (lead.status === 'accepted' ? ' selected' : '') + '>Akzeptiert</option>';
        html += '<option value="rejected"' + (lead.status === 'rejected' ? ' selected' : '') + '>Abgelehnt</option>';
        html += '<option value="progress"' + (lead.status === 'progress' ? ' selected' : '') + '>In Bearbeitung</option>';
        html += '</select></td>';
        html += '<td><input type="text" class="note-input" data-id="' + escAttr(lead.id) + '" value="' + escAttr(lead.notes || '') + '" placeholder="Notiz..."></td>';
        html += '<td><input type="date" class="contact-date" data-id="' + escAttr(lead.id) + '" value="' + escAttr(lead.contactDate || '') + '"></td>';
        html += '<td>' + sourceLabel + '</td>';
        html += '<td><button class="del-btn" data-id="' + escAttr(lead.id) + '" title="Löschen">&#128465;&#65039;</button></td>';
        html += '</tr>';
    }

    html += '</tbody></table>';
    wrap.innerHTML = html;
    updateBulkBar();
}

function getStatusLabel(status) {
    const map = { tocall: 'Anrufen', called: 'Angerufen', accepted: 'Akzeptiert', rejected: 'Abgelehnt', progress: 'In Bearbeitung' };
    return map[status] || status;
}
function getStars(rating) {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    let s = '';
    for (let i = 0; i < full; i++) s += '★';
    if (half) s += '☆';
    return s;
}

// ===== Dashboard =====
function renderDashboard() {
    $('dashTotal').textContent = leads.length;
    $('dashToCall').textContent = leads.filter(l => l.status === 'tocall').length;
    $('dashCalled').textContent = leads.filter(l => l.status === 'called').length;
    $('dashAccepted').textContent = leads.filter(l => l.status === 'accepted').length;
    $('dashRejected').textContent = leads.filter(l => l.status === 'rejected').length;
    $('dashProgress').textContent = leads.filter(l => l.status === 'progress').length;
}

// ===== Kategorie-Filter =====
function updateCategoryFilter() {
    const select = $('filterCategory');
    const currentVal = select.value;
    const categories = [...new Set(leads.map(l => l.category).filter(Boolean))].sort();
    select.innerHTML = '<option value="">Alle</option>';
    for (const cat of categories) {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
    }
    if (categories.includes(currentVal)) select.value = currentVal;
}

// ===== Datenspeicherung =====
function saveData() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(leads)); }
    catch (e) {
        console.warn('Daten konnten nicht gespeichert werden:', e);
        showAlert('Speicher voll! Daten konnten nicht lokal gespeichert werden. Bitte Backup exportieren.', 'error');
    }
}
function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) leads = parsed;
        }
    } catch (e) { console.warn('Daten konnten nicht geladen werden:', e); }
}
function restoreBatchCounter() {
    currentBatchId = leads.reduce((max, l) => Math.max(max, l.batchId || 0), 0);
}

// ===== CSV-Export =====
function exportCSV() {
    const filtered = getFilteredLeads();
    if (filtered.length === 0) {
        showAlert('Keine Leads zum Exportieren.', 'warn');
        return;
    }
    const headers = ['Name', 'Adresse', 'Telefon', 'Webseite', 'Bewertung', 'Kategorie', 'Status', 'Notizen', 'Kontaktdatum', 'Quelle', 'Latitude', 'Longitude'];
    const rows = filtered.map(l => [
        l.name || '',
        l.address || '',
        l.phone || '',
        l.website || '',
        l.rating || '',
        l.category || '',
        getStatusLabel(l.status || 'tocall'),
        l.notes || '',
        l.contactDate || '',
        l.source || '',
        l.lat || '',
        l.lng || ''
    ]);
    const csvCell = c => {
        const s = String(c);
        return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = [headers.map(csvCell).join(';'), ...rows.map(r => r.map(csvCell).join(';'))].join('\r\n');
    downloadBlob(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }), 'coldcallfinder-export-' + new Date().toISOString().slice(0, 10) + '.csv');
    showAlert('CSV exportiert! ' + filtered.length + ' Leads.', 'info');
    addHistory('export', 'CSV exportiert (' + filtered.length + ' Leads)');
}

// ===== Helpers =====
function esc(str) {
    return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escAttr(str) {
    return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function normalizeUrl(u) {
    if (!u) return '';
    let url = String(u).split(';')[0].trim();
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return ''; // andere Protokolle (javascript: etc.) blockieren
    return 'https://' + url;
}
function showAlert(msg, type) {
    clearAlert();
    const div = document.createElement('div');
    div.className = 'alert alert-' + type;
    div.textContent = msg;
    div.id = 'activeAlert';
    const anchor = $('searchSection');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(div, anchor.nextSibling);
    else $('appScreen').insertBefore(div, $('appScreen').firstChild);
    clearTimeout(alertTimer);
    alertTimer = setTimeout(clearAlert, 8000);
}
function clearAlert() {
    const el = $('activeAlert');
    if (el) el.remove();
}
function setSearching(v) {
    isSearching = v;
    const btn = $('searchBtn');
    const txt = $('searchBtnText');
    if (v) {
        btn.disabled = true;
        txt.innerHTML = '<span class="spinner"></span>Suchen...';
    } else {
        btn.disabled = false;
        txt.textContent = 'Suchen';
    }
}
function formatPhone(phone) {
    return String(phone).replace(/\s+/g, ' ').trim();
}
