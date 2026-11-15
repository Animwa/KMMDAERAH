const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwmvZR_yBio0OGkVN1X3Mm3Xk54NqWLrUyWfDybdzXJicb4wANrHCIl6vevpncx7uwE/exec";
const API_KEY = "KMM_DAERAH_SECRET_KEY_2026";

let appData = {
  pengurus: [],
  tupoksi: [],
  agenda: [],
  piket: [],
  tupoksiPiket: [],
  panitia: [],
  monitoring: []
};
let currentAdminTab = "Pengurus";
let currentAgendaFilter = "all";

document.getElementById("year-now").textContent = new Date().getFullYear();

// 1. KEAMANAN CLIENT-SIDE
(function initSecurityShield() {
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.altKey && (e.key === "m" || e.key === "M")) {
      e.preventDefault();
      openAdminAccess();
      return;
    }
    if (e.key === "F12" || (e.ctrlKey && e.shiftKey && ["I", "i", "J", "j", "C", "c"].includes(e.key)) || (e.ctrlKey && ["U", "u", "S", "s"].includes(e.key))) {
      e.preventDefault();
      return false;
    }
  });

  const warningEl = document.getElementById("devtools-warning");
  setInterval(() => {
    const widthDiff = window.outerWidth - window.innerWidth > 160;
    const heightDiff = window.outerHeight - window.innerHeight > 160;
    if ((widthDiff || heightDiff) && !sessionStorage.getItem("kmm_admin_token")) {
      document.body.classList.add("devtools-open");
      warningEl.classList.remove("hidden");
    } else {
      document.body.classList.remove("devtools-open");
      warningEl.classList.add("hidden");
    }
  }, 1000);
})();

// 2. TRIGGER RAHASIA ADMIN (5x KLIK)
(function initSecretClickTrigger() {
  let clickCount = 0;
  let clickTimer = null;
  [document.getElementById("secret-admin-trigger"), document.getElementById("hero-title-trigger")].forEach((el) => {
    if (!el) return;
    el.addEventListener("click", () => {
      clickCount++;
      if (clickCount === 1) clickTimer = setTimeout(() => { clickCount = 0; }, 3000);
      if (clickCount >= 5) {
        clearTimeout(clickTimer);
        clickCount = 0;
        openAdminAccess();
      }
    });
  });
})();

// 3. FETCH DATA
async function fetchAllData() {
  try {
    const response = await fetch(`${SCRIPT_URL}?api_key=${encodeURIComponent(API_KEY)}`);
    const result = await response.json();

    if (result.status === "success") {
      appData = result.data;
      updateDashboardStats();
      populateDesaFilter();
      renderPengurus();
      renderTupoksi();
      renderAgenda();
      renderPiket();
      renderTupoksiPiket();
      renderPanitia();
      renderMonitoring();

      if (!document.getElementById("admin-panel-modal").classList.contains("hidden")) {
        renderAdminDataList();
      }
    }
  } catch (error) {
    console.error("Koneksi API gagal:", error);
  }
}

function updateDashboardStats() {
  document.getElementById("stat-pengurus").textContent = appData.pengurus.length;
  document.getElementById("stat-piket").textContent = appData.piket.length;
  document.getElementById("stat-panitia").textContent = appData.panitia.length;
  document.getElementById("stat-monitoring").textContent = appData.monitoring.length;

  const today = new Date().toISOString().split("T")[0];
  const upcoming = appData.agenda.filter((a) => a.Tanggal >= today).sort((a, b) => a.Tanggal.localeCompare(b.Tanggal));
  const highlightEl = document.getElementById("highlight-agenda");
  if (upcoming.length > 0) {
    highlightEl.textContent = `${upcoming[0].Kegiatan} (${formatTanggalIndo(upcoming[0].Tanggal)})`;
  } else if (appData.agenda.length > 0) {
    highlightEl.textContent = `${appData.agenda[0].Kegiatan} (${formatTanggalIndo(appData.agenda[0].Tanggal)})`;
  } else {
    highlightEl.textContent = "Belum ada agenda kegiatan terjadwal.";
  }
}

function populateDesaFilter() {
  const select = document.getElementById("filter-desa");
  const currentVal = select.value;
  const desaSet = new Set(appData.pengurus.map((p) => p.Desa).filter(Boolean));
  select.innerHTML = `<option value="">Semua Desa</option>`;
  desaSet.forEach((desa) => {
    select.innerHTML += `<option value="${escapeHtml(desa)}">${escapeHtml(desa)}</option>`;
  });
  select.value = currentVal;
}

function renderPengurus() {
  const tbody = document.getElementById("table-pengurus-body");
  const keyword = document.getElementById("search-pengurus").value.toLowerCase();
  const filterDesa = document.getElementById("filter-desa").value;

  const filtered = appData.pengurus.filter((item) => {
    const matchText = String(item.Nama).toLowerCase().includes(keyword) || String(item.Dapukan).toLowerCase().includes(keyword) || String(item.Kelompok).toLowerCase().includes(keyword);
    const matchDesa = filterDesa === "" || item.Desa === filterDesa;
    return matchText && matchDesa;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-slate-400">Data pengurus tidak ditemukan.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((item, index) => `
    <tr class="hover:bg-emerald-50/50 transition">
      <td class="py-3.5 px-6 text-slate-500 font-medium">${index + 1}</td>
      <td class="py-3.5 px-6 font-bold text-slate-900">${escapeHtml(item.Nama)}</td>
      <td class="py-3.5 px-6"><span class="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-semibold text-xs">${escapeHtml(item.Dapukan)}</span></td>
      <td class="py-3.5 px-6 text-slate-700">${escapeHtml(item.Desa)}</td>
      <td class="py-3.5 px-6 text-slate-700">${escapeHtml(item.Kelompok)}</td>
    </tr>
  `).join("");
}

document.getElementById("search-pengurus").addEventListener("input", renderPengurus);
document.getElementById("filter-desa").addEventListener("change", renderPengurus);

function renderTupoksi() {
  const container = document.getElementById("tupoksi-container");
  if (appData.tupoksi.length === 0) {
    container.innerHTML = `<div class="col-span-full py-10 text-center text-slate-400">Belum ada rincian tupoksi.</div>`;
    return;
  }
  container.innerHTML = appData.tupoksi.map((item) => {
    const lines = String(item.Tupoksi).split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    const listHtml = lines.map((line) => `
      <li class="flex items-start gap-2.5 text-sm text-slate-700 leading-relaxed">
        <span class="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0"></span>
        <span>${escapeHtml(line.replace(/^[-•*]\s*/, ""))}</span>
      </li>
    `).join("");

    return `
      <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div class="flex items-center gap-3 border-b border-slate-100 pb-3 mb-4">
          <div class="w-9 h-9 rounded-lg bg-emerald-900 text-amber-400 flex items-center justify-center font-bold text-sm shrink-0">📋</div>
          <h3 class="font-bold text-lg text-emerald-950">${escapeHtml(item.Dapukan)}</h3>
        </div>
        <ul class="space-y-2.5">${listHtml}</ul>
      </div>
    `;
  }).join("");
}

function filterAgenda(type) {
  currentAgendaFilter = type;
  document.querySelectorAll(".agenda-filter-btn").forEach((btn) => {
    btn.className = btn.dataset.filter === type ? "agenda-filter-btn px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-900 text-white transition" : "agenda-filter-btn px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition";
  });
  renderAgenda();
}

function renderAgenda() {
  const container = document.getElementById("agenda-container");
  const today = new Date().toISOString().split("T")[0];
  const filtered = appData.agenda.filter((item) => {
    if (currentAgendaFilter === "upcoming") return item.Tanggal >= today;
    if (currentAgendaFilter === "past") return item.Tanggal < today;
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="col-span-full py-10 text-center text-slate-400">Tidak ada agenda kegiatan.</div>`;
    return;
  }

  container.innerHTML = filtered.map((item) => {
    const isUpcoming = item.Tanggal >= today;
    return `
      <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between gap-2 mb-3">
            <span class="text-xs font-bold px-2.5 py-1 rounded-full ${isUpcoming ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}">${isUpcoming ? "Akan Datang" : "Terlaksana"}</span>
            <span class="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">${formatTanggalIndo(item.Tanggal)}</span>
          </div>
          <h3 class="font-bold text-lg text-slate-900 mb-2">${escapeHtml(item.Kegiatan)}</h3>
          ${item.WaktuTempat ? `<p class="text-xs font-medium text-emerald-700 mb-2">📍 ${escapeHtml(item.WaktuTempat)}</p>` : ""}
          <p class="text-sm text-slate-600 leading-relaxed">${escapeHtml(item.Keterangan || "-")}</p>
        </div>
      </div>
    `;
  }).join("");
}

// Render Tupoksi Piket (Terpisah di bagian atas Navbar Piket secara rapi)
function renderTupoksiPiket() {
  const container = document.getElementById("tupoksi-piket-container");
  if (appData.tupoksiPiket.length === 0) {
    container.innerHTML = `<div class="col-span-full py-6 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">Belum ada panduan tupoksi piket.</div>`;
    return;
  }

  container.innerHTML = appData.tupoksiPiket.map((item) => {
    const lines = String(item.IsiTupoksi).split("\n").map(l => l.trim()).filter(Boolean);
    const listHtml = lines.map(line => `
      <li class="flex items-start gap-2.5 text-sm text-slate-700 leading-relaxed">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-700 mt-2 shrink-0"></span>
        <span>${escapeHtml(line.replace(/^[-•*]\s*/, ""))}</span>
      </li>
    `).join("");

    return `
      <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <h4 class="font-bold text-base text-emerald-950 mb-3 flex items-center gap-2">
          <svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          ${escapeHtml(item.JudulBagian)}
        </h4>
        <ul class="space-y-2">${listHtml}</ul>
      </div>
    `;
  }).join("");
}

// Render Jadwal Piket Bulanan (Maksimal 3 Bulan Terbaru dengan Grid Rapi & Poin Tugas)
function renderPiket() {
  const container = document.getElementById("piket-container");
  if (appData.piket.length === 0) {
    container.innerHTML = `<div class="col-span-full py-10 text-center text-slate-400">Belum ada jadwal piket bulanan.</div>`;
    return;
  }

  // Ambil maksimal 3 data piket terakhir
  const latestPiket = appData.piket.slice(-3);

  container.innerHTML = latestPiket.map((item) => {
    // Format Anggota Terjadwal
    const petugasList = String(item.NamaPetugas).split("\n").map(l => l.trim()).filter(Boolean);
    const petugasHtml = petugasList.map(p => `
      <li class="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2.5 py-1">
        <span class="w-2 h-2 rounded-full bg-emerald-600 shrink-0"></span>
        <span>${escapeHtml(p)}</span>
      </li>
    `).join("");

    // Format Catatan Tugas Menjadi Poin-Poin
    const catatanList = String(item.CatatanTugas || "Menjaga kebersihan dan ketertiban sekretariat.")
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean);
    
    const catatanHtml = catatanList.map(c => `
      <li class="flex items-start gap-2 text-xs sm:text-sm text-emerald-900 leading-relaxed py-0.5">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-700 mt-1.5 shrink-0"></span>
        <span>${escapeHtml(c.replace(/^[-•*]\s*/, ""))}</span>
      </li>
    `).join("");

    return `
      <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
        <div>
          <!-- Tulisan Bulan di Tengah (Center) -->
          <div class="flex justify-center mb-5">
            <span class="px-4 py-1.5 rounded-full bg-amber-100 text-amber-900 font-extrabold text-xs sm:text-sm tracking-wide uppercase shadow-sm">
              Periode: ${escapeHtml(item.Bulan)}
            </span>
          </div>

          <div class="mb-5">
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Anggota Terjadwal:</p>
            <ul class="space-y-1 bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">${petugasHtml || "<li>-</li>"}</ul>
          </div>
        </div>

        <!-- Catatan Tugas Piket Berbentuk Poin-Poin -->
        <div class="bg-emerald-50/80 border border-emerald-100 p-4 rounded-xl mt-2">
          <p class="text-xs font-bold text-emerald-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <svg class="w-4 h-4 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Catatan Tugas Piket:
          </p>
          <ul class="space-y-1">${catatanHtml}</ul>
        </div>
      </div>
    `;
  }).join("");
}

// Render Panitia Kecil
function renderPanitia() {
  const container = document.getElementById("panitia-container");
  if (appData.panitia.length === 0) {
    container.innerHTML = `<div class="col-span-full py-10 text-center text-slate-400">Belum ada data panitia kecil.</div>`;
    return;
  }

  container.innerHTML = appData.panitia.map((item) => {
    const panitiaList = String(item.DaftarPanitia).split("\n").map(l => l.trim()).filter(Boolean);
    const panitiaHtml = panitiaList.map(p => `<span class="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium">${escapeHtml(p)}</span>`).join("");

    return `
      <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
        <div>
          <h3 class="font-bold text-lg text-slate-900 mb-2">${escapeHtml(item.NamaKegiatan)}</h3>
          <p class="text-xs text-slate-500 mb-4">${escapeHtml(item.Keterangan || "-")}</p>
          <div class="mb-2">
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Daftar Panitia:</p>
            <div class="flex flex-wrap gap-1.5">${panitiaHtml || "-"}</div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// Render Monitoring (Center & Tanpa Tanggal)
function renderMonitoring() {
  const container = document.getElementById("monitoring-container");
  if (appData.monitoring.length === 0) {
    container.innerHTML = `<div class="col-span-full py-10 text-center text-emerald-300">Belum ada tautan monitoring.</div>`;
    return;
  }

  container.innerHTML = appData.monitoring.map((item) => `
    <div class="bg-emerald-900/70 border border-emerald-800 rounded-2xl p-6 flex flex-col justify-between items-center text-center hover:border-amber-400/50 transition">
      <div class="w-full">
        <h3 class="font-bold text-lg text-white mb-6 leading-snug px-2">${escapeHtml(item.Kegiatan)}</h3>
      </div>
      <a href="${escapeHtml(item.Link)}" target="_blank" rel="noopener noreferrer" class="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-emerald-950 font-bold text-sm text-center transition flex items-center justify-center gap-2 shadow-md">
        <span>Buka Tautan Kegiatan</span>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
      </a>
    </div>
  `).join("");
}

// 4. ADMIN & CRUD
function openAdminAccess() {
  const token = sessionStorage.getItem("kmm_admin_token");
  if (token) openAdminPanel();
  else {
    document.getElementById("login-error-msg").classList.add("hidden");
    document.getElementById("admin-pin-input").value = "";
    document.getElementById("admin-login-modal").classList.remove("hidden");
    document.getElementById("admin-pin-input").focus();
  }
}

function closeLoginModal() { document.getElementById("admin-login-modal").classList.add("hidden"); }
function openAdminPanel() { closeLoginModal(); document.getElementById("admin-panel-modal").classList.remove("hidden"); switchAdminTab("Pengurus"); }
function closeAdminPanel() { document.getElementById("admin-panel-modal").classList.add("hidden"); }
function logoutAdmin() { sessionStorage.removeItem("kmm_admin_token"); closeAdminPanel(); alert("Sesi Admin diakhiri."); }

document.getElementById("admin-login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pinInput = document.getElementById("admin-pin-input").value.trim();
  const btn = document.getElementById("btn-submit-login");
  const errEl = document.getElementById("login-error-msg");

  btn.disabled = true;
  btn.textContent = "Verifikasi...";
  errEl.classList.add("hidden");

  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ api_key: API_KEY, action: "login", pin: pinInput })
    });
    const res = await response.json();
    if (res.status === "success" && res.token) {
      sessionStorage.setItem("kmm_admin_token", res.token);
      openAdminPanel();
    } else {
      errEl.textContent = res.message || "PIN salah!";
      errEl.classList.remove("hidden");
    }
  } catch (err) {
    errEl.textContent = "Koneksi server gagal.";
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Verifikasi PIN";
  }
});

const adminFieldConfigs = {
  Pengurus: [
    { name: "Nama", label: "Nama Lengkap Pengurus", type: "text", required: true },
    { name: "Dapukan", label: "Dapukan / Jabatan", type: "text", required: true },
    { name: "Desa", label: "Asal Desa", type: "text", required: true },
    { name: "Kelompok", label: "Asal Kelompok", type: "text", required: true }
  ],
  Tupoksi: [
    { name: "Dapukan", label: "Nama Dapukan", type: "text", required: true },
    { name: "Tupoksi", label: "Daftar Tupoksi (Pisahkan tiap poin dengan baris baru)", type: "textarea", required: true }
  ],
  Agenda: [
    { name: "Kegiatan", label: "Nama Kegiatan", type: "text", required: true },
    { name: "Tanggal", label: "Tanggal", type: "date", required: true },
    { name: "WaktuTempat", label: "Waktu & Tempat", type: "text", required: false },
    { name: "Keterangan", label: "Keterangan", type: "textarea", required: false }
  ],
  Piket: [
    { name: "Bulan", label: "Periode Bulan (Contoh: November 2026)", type: "text", required: true },
    { name: "NamaPetugas", label: "Daftar Anggota Terjadwal (Pisahkan dengan baris baru)", type: "textarea", required: true },
    { name: "CatatanTugas", label: "Catatan Tugas Piket", type: "textarea", required: false }
  ],
  TupoksiPiket: [
    { name: "JudulBagian", label: "Judul Bagian Tupoksi (Contoh: Tugas Umum / Kebersihan)", type: "text", required: true },
    { name: "IsiTupoksi", label: "Daftar Poin Tupoksi Piket (Pisahkan dengan baris baru)", type: "textarea", required: true }
  ],
  Panitia: [
    { name: "NamaKegiatan", label: "Nama Kegiatan", type: "text", required: true },
    { name: "DaftarPanitia", label: "Daftar Anggota Panitia (Pilih dari dropdown atau ketik manual)", type: "textarea", required: true, isPanitiaField: true },
    { name: "Keterangan", label: "Keterangan / Deskripsi", type: "text", required: false }
  ],
  Monitoring: [
    { name: "Kegiatan", label: "Nama Kegiatan / Musyawarah", type: "text", required: true },
    { name: "Link", label: "URL Link Tujuan (https://...)", type: "url", required: true }
  ]
};

function switchAdminTab(tabName) {
  currentAdminTab = tabName;
  document.querySelectorAll(".admin-tab-btn").forEach((btn) => {
    btn.className = btn.dataset.tab === tabName ? "admin-tab-btn py-3.5 text-sm font-bold border-b-2 border-emerald-800 text-emerald-900 whitespace-nowrap" : "admin-tab-btn py-3.5 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-800 whitespace-nowrap";
  });
  resetAdminForm();
  renderAdminDataList();
}

function resetAdminForm() {
  document.getElementById("edit-record-id").value = "";
  document.getElementById("admin-form-title").textContent = `Tambah Data ${currentAdminTab}`;
  document.getElementById("btn-cancel-edit").classList.add("hidden");
  const container = document.getElementById("dynamic-form-fields");
  
  container.innerHTML = adminFieldConfigs[currentAdminTab].map((f) => {
    if (f.isPanitiaField) {
      return `
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">${f.label}</label>
          <div class="mb-2 flex flex-wrap gap-1">
            <span class="text-[11px] text-slate-500">Pilih cepat dari data pengurus:</span>
            <select id="quick-pengurus-select" onchange="appendPengurusToPanitia(this)" class="w-full text-xs px-2 py-1.5 rounded border border-slate-300 bg-white">
              <option value="">-- Tarik Nama dari Struktur Pengurus --</option>
              ${appData.pengurus.map(p => `<option value="${escapeHtml(p.Nama)} - ${escapeHtml(p.Dapukan)}">${escapeHtml(p.Nama)} (${escapeHtml(p.Dapukan)})</option>`).join("")}
            </select>
          </div>
          <textarea id="field-${f.name}" rows="5" ${f.required ? "required" : ""} class="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-700 outline-none"></textarea>
        </div>
      `;
    }
    if (f.type === "textarea") {
      return `<div><label class="block text-xs font-semibold text-slate-700 mb-1">${f.label}</label><textarea id="field-${f.name}" rows="5" ${f.required ? "required" : ""} class="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-700 outline-none"></textarea></div>`;
    }
    return `<div><label class="block text-xs font-semibold text-slate-700 mb-1">${f.label}</label><input type="${f.type}" id="field-${f.name}" ${f.required ? "required" : ""} class="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-700 outline-none" /></div>`;
  }).join("");
}

function appendPengurusToPanitia(selectEl) {
  const val = selectEl.value;
  if (!val) return;
  const textarea = document.getElementById("field-DaftarPanitia");
  if (textarea) {
    textarea.value = textarea.value ? textarea.value + "\n" + val : val;
  }
  selectEl.value = "";
}

function renderAdminDataList() {
  const listEl = document.getElementById("admin-data-list");
  const key = currentAdminTab.toLowerCase();
  const items = appData[key] || [];
  document.getElementById("admin-list-count").textContent = items.length;

  if (items.length === 0) {
    listEl.innerHTML = `<p class="text-xs text-slate-400 py-6 text-center">Belum ada data.</p>`;
    return;
  }

  listEl.innerHTML = items.map((item) => {
    const title = item.Nama || item.Dapukan || item.Kegiatan || item.Bulan || item.NamaKegiatan || item.JudulBagian || "Item";
    const subtitle = item.Nama ? `${item.Dapukan} • ${item.Desa}` : (item.NamaPetugas || item.DaftarPanitia || item.IsiTupoksi || item.Link || "");
    return `
      <div class="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3">
        <div class="min-w-0"><p class="font-bold text-sm text-slate-900 truncate">${escapeHtml(title)}</p><p class="text-xs text-slate-500 truncate">${escapeHtml(subtitle)}</p></div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button onclick='editAdminRecord(${JSON.stringify(item).replace(/'/g, "&#39;")})' class="px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-800 text-xs font-semibold">Edit</button>
          <button onclick="deleteAdminRecord('${item.ID}')" class="px-2.5 py-1.5 rounded-lg bg-red-100 text-red-700 text-xs font-semibold">Hapus</button>
        </div>
      </div>
    `;
  }).join("");
}

function editAdminRecord(item) {
  document.getElementById("edit-record-id").value = item.ID;
  document.getElementById("admin-form-title").textContent = `Edit Data ${currentAdminTab}`;
  document.getElementById("btn-cancel-edit").classList.remove("hidden");
  adminFieldConfigs[currentAdminTab].forEach((f) => {
    const el = document.getElementById(`field-${f.name}`);
    if (el) el.value = item[f.name] || "";
  });
}

document.getElementById("admin-crud-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const token = sessionStorage.getItem("kmm_admin_token");
  if (!token) return alert("Sesi habis.");

  const editId = document.getElementById("edit-record-id").value;
  const action = editId ? "update" : "create";
  const record = {};
  adminFieldConfigs[currentAdminTab].forEach((f) => {
    const el = document.getElementById(`field-${f.name}`);
    if (el) record[f.name] = el.value;
  });

  const btn = document.getElementById("btn-save-crud");
  btn.disabled = true;
  btn.textContent = "Menyimpan...";

  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ api_key: API_KEY, token: token, action: action, sheet: currentAdminTab, id: editId, record: record })
    });
    const res = await response.json();
    if (res.status === "success") {
      resetAdminForm();
      await fetchAllData();
      alert(res.message);
    } else alert("Gagal: " + res.message);
  } catch (err) {
    alert("Kesalahan jaringan.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Simpan ke Spreadsheet";
  }
});

async function deleteAdminRecord(id) {
  if (!confirm("Hapus data ini?")) return;
  const token = sessionStorage.getItem("kmm_admin_token");
  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ api_key: API_KEY, token: token, action: "delete", sheet: currentAdminTab, id: id })
    });
    const res = await response.json();
    if (res.status === "success") await fetchAllData();
    else alert("Gagal: " + res.message);
  } catch (err) {
    alert("Kesalahan jaringan.");
  }
}

document.getElementById("mobile-menu-btn").addEventListener("click", () => document.getElementById("mobile-menu").classList.toggle("hidden"));
document.querySelectorAll(".mobile-nav-link").forEach((l) => l.addEventListener("click", () => document.getElementById("mobile-menu").classList.add("hidden")));

function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatTanggalIndo(dateStr) {
  if (!dateStr) return "-";
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const parts = String(dateStr).split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]} ${months[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
}

window.addEventListener("DOMContentLoaded", fetchAllData);
