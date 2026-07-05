const
PASSWORD='26.Af.10',STORAGE_KEY='coldcallfinder_data',STORAGE_AUTH='coldcallfinder_auth',STORAGE_HISTORY='coldcallfinder_history',STORAGE_PROVIDER='coldcallfinder_provider',STORAGE_FILTERS='coldcallfinder_filters',STORAGE_JSONBIN_KEY='coldcallfinder_jsonbin_key',STORAGE_JSONBIN_ID='coldcallfinder_jsonbin_id',JSONBIN_API='https://api.jsonbin.io/v3',OVERPASS_URL='https://overpass-api.de/api/interpreter',OVERPASS_BACKUP='https://overpass.kumi.systems/api/interpreter';
let leads=[],userLocation=null,locationName='',isSearching=false,searchProvider='osm',activeDashboardFilter='',history=[],jsonbinKey='',jsonbinId='',lastSyncTime=0,currentBatchId=0;
const $=id=>document.getElementById(id);
const NICHE_CATALOG={'Essen & Trinken':['restaurant','fast food','cafe','bar','pub','biergarten','ice cream','bakery','butcher','convenience','supermarket','food court','kitchen'],'Gesundheit':['dentist','doctor','clinic','hospital','pharmacy','veterinary','nursing home','social facility'],'Beauty & Wellness':['hairdresser','beauty','spa','sauna','massage','yoga','nail salon','tanning','tattoo','piercing'],'Fitness & Sport':['gym','fitness','sports centre','swimming pool','bowling','skating','ice rink','golf course','mini golf','stadium','dance','martial arts','climbing','tennis'],'Automobil':['car repair','mechanic','car wash','fuel','charging station','car rental','car sharing','tyres','motorcycle','truck'],'Professionelle Dienstleistungen':['lawyer','attorney','accountant','real estate','insurance','bank','notary','architect','consulting','marketing'],'Heimwerker & Handwerk':['plumber','electrician','roofer','carpenter','painter','locksmith','cleaning','gardening','landscaping','moving','hvac','pest control','handyman'],'Einzelhandel':['clothing','shoes','jewelry','watch','electronics','phone','computer','bookstore','toy','furniture','hardware','paint','garden centre','florist','pet','optician','stationery','photo','copyshop','laundry','dry cleaning','tailor','antiques','bed','carpet','lighting','tiles','doors','security','tool hire','trade'],'Kunst & Unterhaltung':['cinema','theatre','museum','gallery','casino','nightclub','music venue','arts centre','library','community centre','conference centre','events venue'],'Reisen & Gastgewerbe':['hotel','motel','hostel','guest house','bed and breakfast','campsite','travel agency','taxi','bus station','train station','ferry terminal','airport'],'Bildung':['school','university','college','kindergarten','language school','music school','driving school','surf school','training','research institute','library'],'Technologie':['computer','electronics','phone','software','internet cafe','gaming','video games','camera','drone'],'Bau & Handwerk':['hardware','paint','plumber','electrician','carpenter','roofer','flooring','tiles','doors','kitchen','tool hire','trade','builder','contractor'],'Sonstiges':['post office','police','fire station','townhall','courthouse','prison','marketplace','place of worship','funeral hall','crematorium','mortuary','internet cafe']};
const ALL_NICHES=Object.values(NICHE_CATALOG).flat();

document.addEventListener('DOMContentLoaded',()=>{initAuth();initLocation();initJsonbin();bindEvents();loadData();loadHistory();initProviderToggle();initFilters();initNicheDropdown();renderDashboard();renderTable();});

// ===== Cloud Sync =====
function initJsonbin(){jsonbinKey=localStorage.getItem(STORAGE_JSONBIN_KEY)||'';jsonbinId=localStorage.getItem(STORAGE_JSONBIN_ID)||'';if(jsonbinKey)$('jsonbinKeyInput').value=jsonbinKey;if(jsonbinId){$('jsonbinIdInput').value=jsonbinId;syncFromCloud();}}
function showSyncMessage(text,type){const msg=$('syncMessage');msg.textContent=text;msg.className='sync-message show '+type;setTimeout(()=>{msg.className='sync-message';},5000);}
function updateSyncStatus(status,text){const el=$('syncStatus');el.className='sync-status';if(status==='synced'){el.classList.add('synced');el.textContent='\\u2705 Synchronisiert';}else if(status==='error'){el.classList.add('error');el.textContent='\\u274C '+(text||'Sync-Fehler');}else if(status==='syncing'){el.textContent='\\u23F3 Synchronisiere...';}else{el.textContent='\\u2705 '+(text||'Lokal gespeichert');}}
async function connectJsonbin(){const key=$('jsonbinKeyInput').value.trim();const binId=$('jsonbinIdInput').value.trim();if(!key){showSyncMessage('Bitte gib deinen JSONBin.io API Key ein.','error');return;}jsonbinKey=key;localStorage.setItem(STORAGE_JSONBIN_KEY,key);if(binId){jsonbinId=binId;localStorage.setItem(STORAGE_JSONBIN_ID,binId);updateSyncStatus('syncing');const success=await syncFromCloud();if(success)showSyncMessage('Verbunden! Daten aus der Cloud geladen.','success');}else{updateSyncStatus('syncing');try{const res=await fetch(JSONBIN_API+'/b',{method:'POST',headers:{'Content-Type':'application/json','X-Master-Key':jsonbinKey,'X-Bin-Private':'false'},body:JSON.stringify({leads:[],history:[],version:1})});if(!res.ok){const err=await res.json().catch(()=>({}));throw new Error(err.message||'HTTP '+res.status);}const data=await res.json();jsonbinId=data.metadata.id;localStorage.setItem(STORAGE_JSONBIN_ID,jsonbinId);$('jsonbinIdInput').value=jsonbinId;await syncToCloud();showSyncMessage('Neue Bin erstellt! ID: '+jsonbinId,'success');updateSyncStatus('synced');}catch(err){showSyncMessage('Fehler beim Erstellen der Bin: '+err.message,'error');updateSyncStatus('error',err.message);}}}
async function syncToCloud(){if(!jsonbinKey||!jsonbinId)return false;updateSyncStatus('syncing');try{const res=await fetch(JSONBIN_API+'/b/'+jsonbinId,{method:'PUT',headers:{'Content-Type':'application/json','X-Master-Key':jsonbinKey},body:JSON.stringify({leads:leads,history:history,version:Date.now()})});if(!res.ok){const err=await res.json().catch(()=>({}));throw new Error(err.message||'HTTP '+res.status);}lastSyncTime=Date.now();updateSyncStatus('synced');return true;}catch(err){updateSyncStatus('error',err.message);return false;}}
async function syncFromCloud(){if(!jsonbinKey||!jsonbinId)return false;updateSyncStatus('syncing');try{const res=await fetch(JSONBIN_API+'/b/'+jsonbinId+'/latest',{method:'GET',headers:{'X-Master-Key':jsonbinKey}});if(!res.ok){const err=await res.json().catch(()=>({}));throw new Error(err.message||'HTTP '+res.status);}const data=await res.json();const record=data.record||{};if(record.leads&&Array.isArray(record.leads)){const localIds=new Set(leads.map(l=>l.id));let merged=[...leads];for(const cloudLead of record.leads){const idx=merged.findIndex(l=>l.id===cloudLead.id);if(idx===-1)merged.push(cloudLead);else if((cloudLead.updatedAt||cloudLead.createdAt||0)>(merged[idx].updatedAt||merged[idx].createdAt||0))merged[idx]=cloudLead;}leads=merged;saveData();}if(record.history&&Array.isArray(record.history)){const localHistIds=new Set(history.map(h=>h.id));for(const cloudHist of record.history){if(!localHistIds.has(cloudHist.id))history.push(cloudHist);}history.sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));if(history.length>200)history=history.slice(0,200);saveHistory();}lastSyncTime=Date.now();updateSyncStatus('synced');renderDashboard();renderTable();renderHistory();updateCategoryFilter();return true;}catch(err){updateSyncStatus('error',err.message);return false;}}
setInterval(()=>{if(jsonbinKey&&jsonbinId)syncToCloud();},60000);

// ===== File Storage =====
function saveToFile(){if(leads.length===0&&history.length===0){showAlert('Keine Daten zum Speichern.','warn');return;}const data={leads:leads,history:history,version:1,exportedAt:Date.now(),app:'ColdCallFinder',exportDate:new Date().toISOString()};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='coldcallfinder-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);showAlert('Backup gespeichert! '+leads.length+' Leads, '+history.length+' Verlaufseinträge.','info');addHistory('export','Backup als Datei gespeichert ('+leads.length+' Leads)');}
function loadFromFile(file){if(!file)return;const reader=new FileReader();reader.onload=(e)=>{try{const data=JSON.parse(e.target.result);if(!data.leads||!Array.isArray(data.leads)){showAlert('Ungültige Datei: Keine Leads gefunden.','error');return;}const oldCount=leads.length;const existingIds=new Set(leads.map(l=>l.id));let added=0;for(const newLead of data.leads){if(!existingIds.has(newLead.id)){leads.push(newLead);existingIds.add(newLead.id);added++;}}if(data.history&&Array.isArray(data.history)){const existingHistIds=new Set(history.map(h=>h.id));for(const newHist of data.history){if(!existingHistIds.has(newHist.id)){history.push(newHist);existingHistIds.add(newHist.id);}}history.sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));if(history.length>200)history=history.slice(0,200);}saveData();saveHistory();const maxBatch=Math.max(...leads.map(l=>l.batchId||0),0);currentBatchId=maxBatch;renderDashboard();renderTable();renderHistory();updateCategoryFilter();showAlert('Backup geladen! '+added+' neue Leads importiert. Gesamt: '+leads.length+' Leads.','info');addHistory('export','Backup aus Datei geladen ('+added+' neue Leads)');if(jsonbinKey&&jsonbinId)syncToCloud();}catch(err){showAlert('Fehler beim Laden der Datei: '+err.message,'error');}};reader.onerror=()=>showAlert('Fehler beim Lesen der Datei.','error');reader.readAsText(file);}

// ===== Niche Dropdown =====
function initNicheDropdown(){const nicheList=$('nicheList');nicheList.innerHTML='';for(const[category,niches]of Object.entries(NICHE_CATALOG)){const header=document.createElement('div');header.className='niche-category-header';header.textContent=category;nicheList.appendChild(header);for(const niche of niches){const item=document.createElement('button');item.className='niche-item';item.textContent=niche;item.addEventListener('click',()=>{$('nicheInput').value=niche;closeNicheModal();});nicheList.appendChild(item);}}const datalist=$('nicheOptions');datalist.innerHTML='';for(const niche of ALL_NICHES){const opt=document.createElement('option');opt.value=niche;datalist.appendChild(opt);}$('nicheSearchInput').addEventListener('input',(e)=>{const term=e.target.value.toLowerCase().trim();document.querySelectorAll('.niche-item').forEach(item=>{item.classList.toggle('hidden',term&&!item.textContent.toLowerCase().includes(term));});});}
function openNicheModal(){$('nicheModal').style.display='flex';$('nicheSearchInput').value='';$('nicheSearchInput').focus();document.querySelectorAll('.niche-item').forEach(item=>item.classList.remove('hidden'));}
function closeNicheModal(){$('nicheModal').style.display='none';}

// ===== Provider Toggle =====
function initProviderToggle(){const saved=localStorage.getItem(STORAGE_PROVIDER);if(saved)searchProvider=saved;updateProviderUI();}
function setProvider(provider){searchProvider=provider;localStorage.setItem(STORAGE_PROVIDER,provider);updateProviderUI();}
function updateProviderUI(){const googleBtn=$('providerGoogle');const osmBtn=$('providerOsm');if(!googleBtn||!osmBtn)return;if(searchProvider==='google'){googleBtn.classList.add('active');osmBtn.classList.remove('active');$('apiKeyBox').style.display='';}else{googleBtn.classList.remove('active');osmBtn.classList.add('active');$('apiKeyBox').style.display='none';}}

// ===== Filters =====
function getFilteredLeads(){
    let visible=[...leads];
    if(activeDashboardFilter&&activeDashboardFilter!=='all')visible=visible.filter(l=>l.status===activeDashboardFilter);
    const statusFilter=$('filterStatus').value;
    if(statusFilter)visible=visible.filter(l=>l.status===statusFilter);
    const websiteFilter=$('filterWebsite').value;
    if(websiteFilter==='has')visible=visible.filter(l=>l.website&&l.website.trim()!=='');
    else if(websiteFilter==='none')visible=visible.filter(l=>!l.website||l.website.trim()==='');
    const phoneFilter=$('filterPhone').value;
    if(phoneFilter==='has')visible=visible.filter(l=>l.phone&&l.phone.trim()!=='');
    else if(phoneFilter==='none')visible=visible.filter(l=>!l.phone||l.phone.trim()==='');
    const ratingFilter=$('filterRating').value;
    if(ratingFilter==='4plus')visible=visible.filter(l=>l.rating&&l.rating>=4);
    else if(ratingFilter==='3plus')visible=visible.filter(l=>l.rating&&l.rating>=3);
    else if(ratingFilter==='none')visible=visible.filter(l=>!l.rating);
    const sourceFilter=$('filterSource').value;
    if(sourceFilter)visible=visible.filter(l=>l.source===sourceFilter);
    const categoryFilter=$('filterCategory').value;
    if(categoryFilter)visible=visible.filter(l=>l.category===categoryFilter);
    const textFilter=($('filterInput').value||'').toLowerCase().trim();
    if(textFilter)visible=visible.filter(l=>(l.name||'').toLowerCase().includes(textFilter)||(l.phone||'').toLowerCase().includes(textFilter)||(l.address||'').toLowerCase().includes(textFilter)||(l.category||'').toLowerCase().includes(textFilter)||(l.notes||'').toLowerCase().includes(textFilter));
    return visible;
}
function initFilters(){const saved=localStorage.getItem(STORAGE_FILTERS);if(saved){try{const f=JSON.parse(saved);if(f.status)$('filterStatus').value=f.status;if(f.website)$('filterWebsite').value=f.website;if(f.phone)$('filterPhone').value=f.phone;if(f.rating)$('filterRating').value=f.rating;if(f.source)$('filterSource').value=f.source;if(f.category)$('filterCategory').value=f.category;if(f.text)$('filterInput').value=f.text;if(f.dashboard){activeDashboardFilter=f.dashboard;updateDashboardActiveState();}}catch(e){}}['filterStatus','filterWebsite','filterPhone','filterRating','filterSource','filterCategory'].forEach(id=>{$(id).addEventListener('change',()=>{saveFilters();renderDashboard();renderTable();});});$('filterInput').addEventListener('input',()=>{saveFilters();renderDashboard();renderTable();});$('resetFiltersBtn').addEventListener('click',resetFilters);}
function saveFilters(){localStorage.setItem(STORAGE_FILTERS,JSON.stringify({status:$('filterStatus').value,website:$('filterWebsite').value,phone:$('filterPhone').value,rating:$('filterRating').value,source:$('filterSource').value,category:$('filterCategory').value,text:$('filterInput').value,dashboard:activeDashboardFilter}));}
function resetFilters(){$('filterStatus').value='';$('filterWebsite').value='';$('filterPhone').value='';$('filterRating').value='';$('filterSource').value='';$('filterCategory').value='';$('filterInput').value='';activeDashboardFilter='';updateDashboardActiveState();saveFilters();renderDashboard();renderTable();}
function updateDashboardActiveState(){document.querySelectorAll('.dash-card.clickable').forEach(card=>{card.classList.toggle('active',card.dataset.filter===activeDashboardFilter);});}

// ===== Auth & Location =====
function initAuth(){if(localStorage.getItem(STORAGE_AUTH)==='true')showApp();else showLogin();}
function showLogin(){$('loginScreen').style.display='flex';$('appScreen').style.display='none';$('passwordInput').focus();}
function showApp(){$('loginScreen').style.display='none';$('appScreen').style.display='block';renderDashboard();renderTable();renderHistory();}
function attemptLogin(){if($('passwordInput').value.trim()===PASSWORD){localStorage.setItem(STORAGE_AUTH,'true');$('loginError').textContent='';showApp();}else{$('loginError').textContent='Falsches Passwort.';$('passwordInput').value='';$('passwordInput').focus();}}
function logout(){localStorage.removeItem(STORAGE_AUTH);showLogin();$('passwordInput').value='';}
function initLocation(){if(!navigator.geolocation){$('locationStatus').textContent='Geolocation nicht unterstützt. Bitte manuellen Standort verwenden.';$('manualLocationBox').style.display='flex';return;}$('locationStatus').textContent='Standort wird ermittelt...';navigator.geolocation.getCurrentPosition((pos)=>{userLocation={lat:pos.coords.latitude,lng:pos.coords.longitude};$('locationStatus').textContent='Standort erkannt. Bereit zur Suche.';reverseGeocode(userLocation.lat,userLocation.lng);},(err)=>{console.warn('Geolocation error:',err);$('locationStatus').textContent='Standortzugriff verweigert. Bitte manuellen Standort verwenden.';$('manualLocationBox').style.display='flex';},{timeout:10000,maximumAge:60000});}
function reverseGeocode(lat,lng){fetch('https://nominatim.openstreetmap.org/reverse?lat='+lat+'&lon='+lng+'&format=json',{headers:{'Accept-Language':'de'}}).then(r=>r.json()).then(data=>{if(data&&data.address){const city=data.address.city||data.address.town||data.address.village||data.address.county||'';const country=data.address.country||'';locationName=city+(city&&country?', ':'')+country;if(locationName)$('locationStatus').textContent='Standort: '+locationName;}}).catch(()=>{});}
function setManualLocation(){const query=$('manualLocationInput').value.trim();if(!query)return;$('locationStatus').textContent='Standort wird gesucht...';fetch('https://nominatim.openstreetmap.org/search?q='+encodeURIComponent(query)+'&format=json&limit=1',{headers:{'Accept-Language':'de'}}).then(r=>r.json()).then(data=>{if(data&&data.length>0){userLocation={lat:parseFloat(data[0].lat),lng:parseFloat(data[0].lon)};locationName=data[0].display_name.split(',')[0];$('locationStatus').textContent='Standort: '+locationName;$('manualLocationBox').style.display='none';}else{$('locationStatus').textContent='Standort nicht gefunden. Bitte erneut versuchen.';}}).catch(()=>{$('locationStatus').textContent='Fehler bei der Standortsuche. Bitte erneut versuchen.';});}

// ===== Event Bindings =====
function bindEvents(){$('loginBtn').addEventListener('click',attemptLogin);$('passwordInput').addEventListener('keydown',(e)=>{if(e.key==='Enter')attemptLogin();});$('logoutBtn').addEventListener('click',logout);$('manualLocationBtn').addEventListener('click',()=>{const box=$('manualLocationBox');box.style.display=box.style.display==='none'?'flex':'none';if(box.style.display!=='none')$('manualLocationInput').focus();});$('setLocationBtn').addEventListener('click',setManualLocation);$('manualLocationInput').addEventListener('keydown',(e)=>{if(e.key==='Enter')setManualLocation();});$('searchBtn').addEventListener('click',performSearch);$('nicheInput').addEventListener('keydown',(e)=>{if(e.key==='Enter')performSearch();});$('nicheDropdownBtn').addEventListener('click',openNicheModal);$('closeNicheModal').addEventListener('click',closeNicheModal);$('nicheModal').querySelector('.modal-overlay').addEventListener('click',closeNicheModal);document.addEventListener('keydown',(e)=>{if(e.key==='Escape')closeNicheModal();});$('providerGoogle').addEventListener('click',()=>setProvider('google'));$('providerOsm').addEventListener('click',()=>setProvider('osm'));$('saveApiKeyBtn').addEventListener('click',saveApiKey);$('apiKeyInput').addEventListener('keydown',(e)=>{if(e.key==='Enter')saveApiKey();});$('connectJsonbinBtn').addEventListener('click',connectJsonbin);$('syncNowBtn').addEventListener('click',()=>{syncFromCloud().then(ok=>{if(ok)showSyncMessage('Aus Cloud synchronisiert!','success');});});$('saveFileBtn').addEventListener('click',saveToFile);$('loadFileBtn').addEventListener('click',()=>$('fileInput').click());$('fileInput').addEventListener('change',(e)=>{if(e.target.files[0])loadFromFile(e.target.files[0]);e.target.value='';});document.querySelectorAll('.dash-card.clickable').forEach(card=>{card.addEventListener('click',()=>{activeDashboardFilter=activeDashboardFilter===card.dataset.filter?'':card.dataset.filter;updateDashboardActiveState();saveFilters();renderDashboard();renderTable();});});$('exportBtn').addEventListener('click',exportCSV);$('clearBtn').addEventListener('click',()=>{if(confirm('Alle Leads löschen? Dies kann nicht rückgängig gemacht werden.')){const count=leads.length;leads=[];saveData();renderDashboard();renderTable();updateCategoryFilter();addHistory('clear','Alle '+count+' Leads gelöscht');}});$('clearHistoryBtn').addEventListener('click',()=>{if(confirm('Gesamten Verlauf löschen?')){history=[];saveHistory();renderHistory();}});}
function saveApiKey(){const key=$('apiKeyInput').value.trim();if(key){localStorage.setItem('coldcallfinder_apikey',key);$('apiKeyInput').value='';showAlert('API Key gespeichert.','info');}}

// ===== History =====
function addHistory(type,text,meta){meta=meta||'';const entry={id:'hist-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),type,text,meta,timestamp:Date.now()};history.unshift(entry);if(history.length>200)history=history.slice(0,200);saveHistory();renderHistory();if(jsonbinKey&&jsonbinId)syncToCloud();}
function saveHistory(){try{localStorage.setItem(STORAGE_HISTORY,JSON.stringify(history));}catch(e){console.warn('Verlauf konnte nicht gespeichert werden:',e);}}
function loadHistory(){try{const raw=localStorage.getItem(STORAGE_HISTORY);if(raw){const parsed=JSON.parse(raw);if(Array.isArray(parsed))history=parsed;}}catch(e){console.warn('Verlauf konnte nicht geladen werden:',e);}}
function renderHistory(){const list=$('historyList');if(history.length===0){list.innerHTML='<div class="empty-history">Noch keine Aktivität.</div>';return;}const icons={search:'\\u{1F50D}',status:'\\u{1F4DE}',add:'\\u2795',delete:'\\u{1F5D1}\\uFE0F',export:'\\u{1F4E4}',clear:'\\u{1F9F9}',note:'\\u{1F4DD}',contact:'\\u{1F4C5}'};let html='';for(const entry of history.slice(0,50)){const date=new Date(entry.timestamp);const timeStr=date.toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});const icon=icons[entry.type]||'\\u{1F4CB}';html+='<div class="history-item type-'+escAttr(entry.type)+'"><span class="history-icon">'+icon+'</span><div class="history-content"><div class="history-text">'+esc(entry.text)+'</div><div class="history-meta">'+esc(entry.meta||timeStr)+'</div></div></div>';}list.innerHTML=html;}

// ===== Search =====
async function performSearch(){const niche=$('nicheInput').value.trim();if(!niche){showAlert('Bitte gib eine Branchen-Nische ein.','warn');return;}if(!userLocation){showAlert('Standort nicht festgelegt. Bitte Geolocation erlauben oder Stadt manuell eingeben.','warn');$('manualLocationBox').style.display='flex';return;}currentBatchId++;if(searchProvider==='google')await searchGoogle(niche);else await searchOpenStreetMap(niche);}

// ===== Google Places =====
async function searchGoogle(niche){const apiKey=localStorage.getItem('coldcallfinder_apikey');if(!apiKey){showAlert('Google Places API Key erforderlich. Key unten eingeben oder zu OpenStreetMap (kostenlos) wechseln.','warn');$('apiKeyBox').style.display='';$('apiKeyInput').focus();return;}const radius=parseInt($('radiusSelect').value,10);setSearching(true);clearAlert();try{const searchBody={textQuery:niche,locationBias:{circle:{center:{latitude:userLocation.lat,longitude:userLocation.lng},radius:radius}},pageSize:20};const searchRes=await fetch('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':apiKey,'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.rating,places.userRatingCount,places.primaryTypeDisplayName,places.businessStatus,places.location'},body:JSON.stringify(searchBody)});if(!searchRes.ok){const errData=await searchRes.json().catch(()=>({}));if(searchRes.status===403||searchRes.status===401){localStorage.removeItem('coldcallfinder_apikey');}throw new Error(errData.error?.message||'HTTP '+searchRes.status);}const searchData=await searchRes.json();const places=searchData.places||[];if(places.length===0){showAlert('Keine Unternehmen gefunden. Bitte andere Nische oder größeren Radius versuchen.','info');setSearching(false);return;}processResults(places,'google');}catch(err){showAlert(err.message||'Suche fehlgeschlagen. Bitte zu OpenStreetMap wechseln.','error');}finally{setSearching(false);}}

// ===== OpenStreetMap =====
async function searchOpenStreetMap(niche){const radius=parseInt($('radiusSelect').value,10);setSearching(true);clearAlert();const osmTagMap={'restaurant':['amenity=restaurant','amenity=fast_food'],'restaurants':['amenity=restaurant','amenity=fast_food'],'fast food':['amenity=fast_food'],'cafe':['amenity=cafe'],'cafes':['amenity=cafe'],'bar':['amenity=bar','amenity=pub'],'bars':['amenity=bar','amenity=pub'],'pub':['amenity=pub'],'biergarten':['amenity=biergarten'],'ice cream':['amenity=ice_cream'],'hotel':['tourism=hotel','tourism=motel'],'hotels':['tourism=hotel','tourism=motel'],'motel':['tourism=motel'],'hostel':['tourism=hostel'],'hostels':['tourism=hostel'],'guest house':['tourism=guest_house'],'bed and breakfast':['tourism=guest_house'],'bnb':['tourism=guest_house'],'campsite':['tourism=camp_site'],'camping':['tourism=camp_site'],'dentist':['amenity=dentist'],'dentists':['amenity=dentist'],'doctor':['amenity=doctors'],'doctors':['amenity=doctors'],'clinic':['amenity=clinic'],'clinics':['amenity=clinic'],'hospital':['amenity=hospital'],'pharmacy':['amenity=pharmacy'],'pharmacies':['amenity=pharmacy'],'veterinary':['amenity=veterinary'],'vet':['amenity=veterinary'],'nursing home':['amenity=social_facility','social_facility=nursing_home'],'social facility':['amenity=social_facility'],'hair':['shop=hairdresser'],'hairdresser':['shop=hairdresser'],'hair salon':['shop=hairdresser'],'salon':['shop=hairdresser','shop=beauty'],'beauty':['shop=beauty'],'nail salon':['shop=beauty','beauty=nails'],'tanning':['shop=beauty','beauty=tanning'],'spa':['leisure=spa'],'sauna':['leisure=sauna'],'massage':['shop=massage'],'yoga':['leisure=yoga','sport=yoga'],'gym':['leisure=fitness_centre','leisure=sports_centre'],'gyms':['leisure=fitness_centre','leisure=sports_centre'],'fitness':['leisure=fitness_centre'],'sports centre':['leisure=sports_centre'],'swimming pool':['leisure=swimming_pool'],'pool':['leisure=swimming_pool'],'bowling':['leisure=bowling_alley'],'skating':['leisure=ice_rink'],'ice rink':['leisure=ice_rink'],'golf course':['leisure=golf_course'],'mini golf':['leisure=miniature_golf'],'stadium':['leisure=stadium'],'stadiums':['leisure=stadium'],'dance':['leisure=dance','amenity=dancing_school'],'martial arts':['sport=martial_arts','leisure=sports_centre'],'climbing':['sport=climbing','leisure=sports_centre'],'tennis':['sport=tennis','leisure=sports_centre'],'plumber':['craft=plumber'],'plumbers':['craft=plumber'],'electrician':['craft=electrician'],'electricians':['craft=electrician'],'roofer':['craft=roofer'],'roofers':['craft=roofer'],'carpenter':['craft=carpenter'],'carpenters':['craft=carpenter'],'painter':['craft=painter'],'locksmith':['craft=locksmith','shop=locksmith'],'cleaning':['shop=cleaning'],'gardening':['shop=garden_centre'],'landscaping':['craft=landscaper'],'moving':['shop=moving'],'hvac':['craft=hvac'],'pest control':['shop=pest_control'],'handyman':['craft=handyman'],'mechanic':['shop=car_repair'],'mechanics':['shop=car_repair'],'car repair':['shop=car_repair'],'car wash':['amenity=car_wash'],'fuel':['amenity=fuel'],'gas':['amenity=fuel'],'gas station':['amenity=fuel'],'charging station':['amenity=charging_station'],'car rental':['amenity=car_rental'],'car sharing':['amenity=car_sharing'],'tyres':['shop=tyres'],'motorcycle':['shop=motorcycle'],'truck':['shop=truck'],'lawyer':['office=lawyer'],'lawyers':['office=lawyer'],'attorney':['office=lawyer'],'attorneys':['office=lawyer'],'accountant':['office=accountant'],'accountants':['office=accountant'],'real estate':['office=estate_agent'],'realtor':['office=estate_agent'],'realtors':['office=estate_agent'],'estate agent':['office=estate_agent'],'insurance':['office=insurance'],'bank':['amenity=bank'],'banks':['amenity=bank'],'notary':['office=notary'],'architect':['office=architect'],'consulting':['office=consulting'],'marketing':['office=advertising_agency','office=marketing'],'supermarket':['shop=supermarket'],'supermarkets':['shop=supermarket'],'bakery':['shop=bakery'],'bakeries':['shop=bakery'],'butcher':['shop=butcher'],'butchers':['shop=butcher'],'florist':['shop=florist'],'florists':['shop=florist'],'optician':['shop=optician'],'opticians':['shop=optician'],'shoe':['shop=shoes'],'shoes':['shop=shoes'],'clothing':['shop=clothes'],'clothes':['shop=clothes'],'pet':['shop=pet'],'pets':['shop=pet'],'tattoo':['shop=tattoo'],'tattoos':['shop=tattoo'],'piercing':['shop=piercing'],'laundry':['shop=laundry'],'dry cleaning':['shop=dry_cleaning'],'tailor':['shop=tailor'],'tailors':['shop=tailor'],'jewelry':['shop=jewelry'],'jeweller':['shop=jewelry'],'jewellers':['shop=jewelry'],'watch':['shop=watches'],'watches':['shop=watches'],'electronics':['shop=electronics'],'phone':['shop=mobile_phone'],'phones':['shop=mobile_phone'],'computer':['shop=computer'],'computers':['shop=computer'],'software':['shop=software','office=software'],'internet cafe':['amenity=internet_cafe'],'gaming':['shop=video_games'],'video games':['shop=video_games'],'camera':['shop=camera'],'drone':['shop=electronics'],'bookstore':['shop=books'],'books':['shop=books'],'toy':['shop=toys'],'toys':['shop=toys'],'furniture':['shop=furniture'],'hardware':['shop=hardware'],'paint':['shop=paint'],'garden centre':['shop=garden_centre'],'stationery':['shop=stationery'],'photo':['shop=photo'],'copyshop':['shop=copyshop'],'antiques':['shop=antiques'],'bed':['shop=bed'],'carpet':['shop=carpet'],'lighting':['shop=lighting'],'tiles':['shop=tiles'],'doors':['shop=doors'],'security':['shop=security'],'tool hire':['shop=tool_hire'],'trade':['shop=trade'],'builder':['craft=builder'],'contractor':['craft=builder'],'flooring':['shop=flooring'],'cinema':['amenity=cinema'],'theatre':['amenity=theatre'],'museum':['tourism=museum'],'gallery':['tourism=gallery'],'casino':['amenity=casino'],'nightclub':['amenity=nightclub'],'music venue':['amenity=music_venue'],'arts centre':['amenity=arts_centre'],'library':['amenity=library'],'community centre':['amenity=community_centre'],'conference centre':['amenity=conference_centre'],'events venue':['amenity=events_venue'],'travel agency':['shop=travel_agency'],'taxi':['amenity=taxi'],'bus station':['amenity=bus_station'],'train station':['railway=station'],'ferry terminal':['amenity=ferry_terminal'],'airport':['aeroway=aerodrome'],'school':['amenity=school'],'university':['amenity=university'],'college':['amenity=college'],'kindergarten':['amenity=kindergarten'],'language school':['amenity=language_school'],'music school':['amenity=music_school'],'driving school':['amenity=driving_school'],'surf school':['sport=surfing'],'training':['amenity=training'],'research institute':['amenity=research_institute'],'post office':['amenity=post_office'],'police':['amenity=police'],'fire station':['amenity=fire_station'],'townhall':['amenity=townhall'],'courthouse':['amenity=courthouse'],'prison':['amenity=prison'],'marketplace':['amenity=marketplace'],'place of worship':['amenity=place_of_worship'],'funeral hall':['amenity=funeral_hall'],'crematorium':['amenity=crematorium'],'mortuary':['amenity=mortuary']};

    const tags=osmTagMap[niche.toLowerCase()];
    let query;
    if(tags&&tags.length>0){
        const parts=tags.map(t=>{
            const [k,v]=t.split('=');
            return 'node["'+k+'"="'+v+'"](around:'+radius+','+userLocation.lat+','+userLocation.lng+');way["'+k+'"="'+v+'"](around:'+radius+','+userLocation.lat+','+userLocation.lng+');';
        }).join('');
        query='[out:json][timeout:30];('+parts+');out center tags 50;';
    }else{
        query='[out:json][timeout:30];node["name"~"'+niche+'",i](around:'+radius+','+userLocation.lat+','+userLocation.lng+');way["name"~"'+niche+'",i](around:'+radius+','+userLocation.lat+','+userLocation.lng+');out center tags 50;';
    }
    try{
        const res=await fetch(OVERPASS_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(query)});
        if(!res.ok)throw new Error('HTTP '+res.status);
        const data=await res.json();
        const elements=data.elements||[];
        if(elements.length===0){showAlert('Keine Unternehmen gefunden. Bitte andere Nische oder größeren Radius versuchen.','info');setSearching(false);return;}
        processResults(elements,'osm');
    }catch(err){
        try{
            const res2=await fetch(OVERPASS_BACKUP,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(query)});
            if(!res2.ok)throw new Error('HTTP '+res2.status);
            const data2=await res2.json();
            const elements2=data2.elements||[];
            if(elements2.length===0){showAlert('Keine Unternehmen gefunden.','info');setSearching(false);return;}
            processResults(elements2,'osm');
        }catch(err2){showAlert('Suche fehlgeschlagen: '+err2.message,'error');}
    }finally{setSearching(false);}
}

// ===== Process Results =====
function processResults(items,source){
    const existingIds=new Set(leads.map(l=>l.id));
    let added=0;
    const batchId=currentBatchId;
    for(const item of items){
        let id,name,address,phone,website,lat,lng,category,rating,ratingCount;
        if(source==='google'){
            id='g-'+item.id;
            if(existingIds.has(id))continue;
            name=item.displayName?.text||'';
            address=item.formattedAddress||'';
            phone=item.internationalPhoneNumber||'';
            website=item.websiteUri||'';
            lat=item.location?.latitude||0;
            lng=item.location?.longitude||0;
            category=item.primaryTypeDisplayName?.text||'';
            rating=item.rating||0;
            ratingCount=item.userRatingCount||0;
        }else{
            id='o-'+item.type+'-'+item.id;
            if(existingIds.has(id))continue;
            const tags=item.tags||{};
            name=tags.name||tags['name:de']||'';
            address=[tags['addr:street'],tags['addr:housenumber'],tags['addr:postcode'],tags['addr:city']].filter(Boolean).join(' ');
            phone=tags.phone||tags['contact:phone']||tags.telephone||'';
            website=tags.website||tags['contact:website']||'';
            if(item.type==='node'){lat=item.lat||0;lng=item.lon||0;}
            else{lat=item.center?.lat||0;lng=item.center?.lon||0;}
            category=tags.amenity||tags.shop||tags.tourism||tags.leisure||tags.office||tags.craft||tags.sport||'';
            rating=0;ratingCount=0;
        }
        if(!name)continue;
        const lead={id:id,name:name,address:address,phone:phone,website:website,lat:lat,lng:lng,category:category,status:'tocall',notes:'',contactDate:'',rating:rating,ratingCount:ratingCount,source:source,batchId:batchId,createdAt:Date.now(),updatedAt:Date.now()};
        leads.push(lead);
        existingIds.add(id);
        added++;
    }
    if(added>0){
        saveData();
        renderDashboard();
        renderTable();
        updateCategoryFilter();
        addHistory('search',added+' neue Leads gefunden ('+(source==='google'?'Google Places':'OpenStreetMap')+')',locationName?locationName:'');
        if(jsonbinKey&&jsonbinId)syncToCloud();
    }else{
        showAlert('Keine neuen Leads gefunden. Alle Ergebnisse sind bereits in der Liste.','info');
    }
}

// ===== UI Helpers =====
function setSearching(v){isSearching=v;$('searchBtn').disabled=v;$('searchBtnText').textContent=v?'Suche...':'Suchen';if(v)$('searchBtnText').innerHTML='<span class="spinner"></span> Suche...';else $('searchBtnText').textContent='Suchen';}
function showAlert(msg,type){clearAlert();const wrap=$('resultsTableWrap');const div=document.createElement('div');div.className='alert alert-'+type;div.textContent=msg;wrap.insertBefore(div,wrap.firstChild);setTimeout(clearAlert,8000);}
function clearAlert(){document.querySelectorAll('.alert').forEach(el=>el.remove());}
function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function escAttr(s){return(s||'').replace(/[^a-zA-Z0-9_-]/g,'');}

// ===== Data Persistence =====
function saveData(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(leads));}catch(e){console.warn('Daten konnten nicht gespeichert werden:',e);}}
function loadData(){try{const raw=localStorage.getItem(STORAGE_KEY);if(raw){const parsed=JSON.parse(raw);if(Array.isArray(parsed))leads=parsed;}}catch(e){console.warn('Daten konnten nicht geladen werden:',e);}}

// ===== Dashboard (FIXED: uses getFilteredLeads for counts) =====
function renderDashboard(){
    const filtered=getFilteredLeads();
    const total=filtered.length;
    const tocall=filtered.filter(l=>l.status==='tocall').length;
    const called=filtered.filter(l=>l.status==='called').length;
    const accepted=filtered.filter(l=>l.status==='accepted').length;
    const rejected=filtered.filter(l=>l.status==='rejected').length;
    const progress=filtered.filter(l=>l.status==='progress').length;
    $('dashTotal').textContent=total;
    $('dashToCall').textContent=tocall;
    $('dashCalled').textContent=called;
    $('dashAccepted').textContent=accepted;
    $('dashRejected').textContent=rejected;
    $('dashProgress').textContent=progress;
}

// ===== Table Rendering =====
function renderTable(){
    const visible=getFilteredLeads();
    $('resultsCount').textContent=visible.length+' Leads';
    const wrap=$('resultsTableWrap');
    if(visible.length===0){wrap.innerHTML='<div class="empty-state"><p>Gib eine Branchen-Nische ein und klicke auf Suchen, um Leads in deiner Nähe zu finden.</p></div>';return;}
    let html='<table><thead><tr><th class="td-check"><input type="checkbox" id="selectAll"></th><th>Name</th><th>Kategorie</th><th>Adresse</th><th>Telefon</th><th>Webseite</th><th>Bewertung</th><th>Status</th><th>Kontakt</th><th>Notizen</th><th></th></tr></thead><tbody>';
    let lastBatch=null;
    for(const lead of visible){
        if(lastBatch!==null&&lead.batchId!==lastBatch){
            html+='<tr class="new-batch-separator"><td colspan="11">Neuer Suchdurchlauf #'+lead.batchId+'</td></tr>';
        }
        lastBatch=lead.batchId||0;
        html+='<tr class="status-'+escAttr(lead.status)+'" data-id="'+escAttr(lead.id)+'">';
        html+='<td class="td-check"><input type="checkbox" class="lead-check" data-id="'+escAttr(lead.id)+'"></td>';
        html+='<td>'+esc(lead.name)+'</td>';
        html+='<td>'+esc(lead.category)+'</td>';
        html+='<td>'+esc(lead.address)+'</td>';
        html+='<td>'+(lead.phone?'<a href="tel:'+esc(lead.phone)+'" class="phone-link">'+esc(lead.phone)+'</a>':'')+'</td>';
        html+='<td>'+(lead.website?'<a href="'+esc(lead.website)+'" class="website-link" target="_blank" rel="noopener">Webseite</a>':'')+'</td>';
        html+='<td class="rating-cell">'+(lead.rating?'<span class="rating-stars">'+'\\u2605'.repeat(Math.round(lead.rating))+'</span><span class="rating-num">'+lead.rating+'</span>':'')+'</td>';
        html+='<td><select class="status-select" data-id="'+escAttr(lead.id)+'"><option value="tocall"'+(lead.status==='tocall'?' selected':'')+'>Anrufen</option><option value="called"'+(lead.status==='called'?' selected':'')+'>Angerufen</option><option value="accepted"'+(lead.status==='accepted'?' selected':'')+'>Akzeptiert</option><option value="rejected"'+(lead.status==='rejected'?' selected':'')+'>Abgelehnt</option><option value="progress"'+(lead.status==='progress'?' selected':'')+'>In Bearbeitung</option></select></td>';
        html+='<td><input type="date" class="contact-date" data-id="'+escAttr(lead.id)+'" value="'+esc(lead.contactDate||'')+'"></td>';
        html+='<td><input type="text" class="note-input" data-id="'+escAttr(lead.id)+'" value="'+esc(lead.notes||'')+'" placeholder="Notiz..."></td>';
        html+='<td><button class="del-btn" data-id="'+escAttr(lead.id)+'" title="Löschen">\\u00D7</button></td>';
        html+='</tr>';
    }
    html+='</tbody></table>';
    wrap.innerHTML=html;
    // Event listeners for inline editing
    wrap.querySelectorAll('.status-select').forEach(sel=>{sel.addEventListener('change',(e)=>{const id=e.target.dataset.id;const lead=leads.find(l=>l.id===id);if(lead){const old=lead.status;lead.status=e.target.value;lead.updatedAt=Date.now();saveData();renderDashboard();renderTable();addHistory('status',lead.name+': '+old+' → '+e.target.value);if(jsonbinKey&&jsonbinId)syncToCloud();}});});
    wrap.querySelectorAll('.note-input').forEach(inp=>{inp.addEventListener('change',(e)=>{const id=e.target.dataset.id;const lead=leads.find(l=>l.id===id);if(lead){lead.notes=e.target.value;lead.updatedAt=Date.now();saveData();saveData();if(jsonbinKey&&jsonbinId)syncToCloud();}});});
    wrap.querySelectorAll('.contact-date').forEach(inp=>{inp.addEventListener('change',(e)=>{const id=e.target.dataset.id;const lead=leads.find(l=>l.id===id);if(lead){lead.contactDate=e.target.value;lead.updatedAt=Date.now();saveData();if(jsonbinKey&&jsonbinId)syncToCloud();}});});
    wrap.querySelectorAll('.del-btn').forEach(btn=>{btn.addEventListener('click',(e)=>{const id=e.target.dataset.id;const lead=leads.find(l=>l.id===id);if(lead&&confirm('"'+lead.name+'" löschen?')){leads=leads.filter(l=>l.id!==id);saveData();renderDashboard();renderTable();updateCategoryFilter();addHistory('delete',lead.name+' gelöscht');if(jsonbinKey&&jsonbinId)syncToCloud();}});});
    wrap.querySelectorAll('.lead-check').forEach(chk=>{chk.addEventListener('change',()=>{const all=wrap.querySelectorAll('.lead-check');const allChecked=Array.from(all).every(c=>c.checked);$('selectAll').checked=allChecked;});});
    const selectAll=$('selectAll');if(selectAll){selectAll.addEventListener('change',(e)=>{wrap.querySelectorAll('.lead-check').forEach(c=>c.checked=e.target.checked);});}
}

// ===== Category Filter Update =====
function updateCategoryFilter(){
    const select=$('filterCategory');
    const current=select.value;
    const categories=[...new Set(leads.map(l=>l.category).filter(Boolean))].sort();
    select.innerHTML='<option value="">Alle</option>';
    for(const cat of categories){const opt=document.createElement('option');opt.value=cat;opt.textContent=cat;select.appendChild(opt);}
    if(categories.includes(current))select.value=current;
}

// ===== CSV Export =====
function exportCSV(){if(leads.length===0){showAlert('Keine Leads zum Exportieren.','warn');return;}const visible=getFilteredLeads();const rows=visible.map(l=>[l.name,l.category,l.address,l.phone,l.website,l.rating||'',l.status,l.contactDate||'',l.notes||'',l.source]);const csv=['Name,Kategorie,Adresse,Telefon,Webseite,Bewertung,Status,Kontakt,Notizen,Quelle',...rows.map(r=>r.map(c=>'"'+(c||'').replace(/"/g,'""')+'"').join(','))].join('\\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='leads-'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);addHistory('export','CSV exportiert ('+visible.length+' Leads)');}
'''

# Verify the JS has no "aa" bug
import re
if re.search(r'\baa\b', complete_js):
    print("WARNING: 'aa' still found!")
else:
    print("OK: No standalone 'aa' variable found")

# Check for all required functions
required_funcs = ['processResults', 'setSearching', 'clearAlert', 'showAlert', 
                  'saveData', 'loadData', 'renderTable', 'exportCSV', 
                  'updateCategoryFilter', 'esc', 'escAttr', 'renderDashboard',
                  'getFilteredLeads']
for func in required_funcs:
    if func in complete_js:
        print(f"OK: {func} found")
    else:
        print(f"MISSING: {func}")

print(f"\nJS length: {len(complete_js)} chars")
print(f"JS lines: {len(complete_js.split(chr(10)))}")
