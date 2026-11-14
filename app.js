/**
 * ============================================================================
 * KONFIGURASI UTAMA (SESUAIKAN DENGAN DEPLOYMENT APPS SCRIPT ANDA)
 * ============================================================================
 */
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycby0bIgcOTeToeFB6ZSQisFQW73n57H9igOUMBJJAs5ZftJvbuHPAf5Rm_ZTabTRxBhz/exec";
const API_KEY = "KMM_DAERAH_SECRET_KEY_2026"; // Harus sama persis dengan di Code.gs

// State Global Aplikasi
let appData = {
  pengurus: [],
  tupoksi: [],
  agenda: [],
  monitoring: []
};
let currentAdminTab = "Pengurus";
let currentAgendaFilter = "all";

document.getElementById("year-now").textContent = new Date().getFullYear();

/**
 * ============================================================================
 * 1. PROTEKSI KEAMANAN CLIENT-SIDE (ANTI-INSPECT & DEVTOOLS)
 * ============================================================================
 */
(function initSecurityShield() {
  // 1. Blokir Klik Kanan
  document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });

  // 2. Blokir Shortcut Keyboard DevTools & View Source (Kecuali Ctrl+Alt+M untuk Admin)
  document.addEventListener("keydown", (e) => {
    // Trigger Rahasia Admin: Ctrl + Alt + M
    if (e.ctrlKey && e.altKey && (e.key === "m" || e.key === "M")) {
      e.preventDefault();
      openAdminAccess();
      return;
    }

    // Blokir F12
    if (e.key === "F12") {
      e.preventDefault();
      return false;
    }
    // Blokir Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
    if (e.ctrlKey && e.shiftKey && ["I", "i", "J", "j", "C", "c"].includes(e.key)) {
      e.preventDefault();
      return false;
    }
    // Blokir Ctrl+U (View Source) & Ctrl+S (Save Page)
    if (e.ctrlKey && ["U", "u", "S", "s"].includes(e.key)) {
      e.preventDefault();
      return false;
    }
  });

  // 3. Deteksi Pembukaan DevTools via Perbedaan Ukuran Viewport & Debugger
  const warningEl = document.getElementById("devtools-warning");
  const checkDevTools = () => {
    const threshold = 160;
    const widthDiff = window.outerWidth - window.innerWidth > threshold;
    const heightDiff = window.outerHeight - window.innerHeight > threshold;

    // Hanya aktifkan blokir visual jika bukan sedang login admin
    if ((widthDiff || heightDiff) && !sessionStorage.getItem("kmm_admin_token")) {
      document.body.classList.add("devtools-open");
      warningEl.classList.remove("hidden");
    } else {
      document.body.classList.remove("devtools-open");
      warningEl.classList.add("hidden");
    }
  };

  setInterval(checkDevTools, 1000);
})();

/**
 * ============================================================================
 * 2. TRIGGER RAHASIA ADMIN (5X KLIK DALAM < 3 DETIK)
 * ============================================================================
 */
(function initSecretClickTrigger() {
  let clickCount = 0;
  let clickTimer = null;

  const triggerElements = [
    document.getElementById("secret-admin-trigger"),
    document.getElementById("hero-title-trigger")
  ];

  triggerElements.forEach((el) => {
    if (!el) return;
    el.addEventListener("click", () => {
      clickCount++;
      if (clickCount === 1) {
        clickTimer = setTimeout(() => {
          clickCount = 0;
        }, 3000); // Reset hitungan jika lebih dari 3 detik
      }

      if (clickCount >= 5) {
        clearTimeout(clickTimer);
        clickCount = 0;
        openAdminAccess();
      }
    });
  });
})();

/**
 * ============================================================================
 * 3. FETCH DATA & RENDER TAMPILAN PUBLIK
 * ============================================================================
 */
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
      renderMonitoring();

      // Jika panel admin sedang terbuka, perbarui juga list admin
      if (!document.getElementById("admin-panel-modal").classList.contains("hidden")) {
        renderAdminDataList();
      }
    } else {
      console.error("Gagal mengambil data:", result.message);
    }
  } catch (error) {
    console.error("Koneksi API gagal:", error);
  }
}

function updateDashboardStats() {
  document.getElementById("stat-pengurus").textContent = appData.pengurus.length;
  document.getElementById("stat-tupoksi").textContent = appData.tupoksi.length;
  document.getElementById("stat-agenda").textContent = appData.agenda.length;
  document.getElementById("stat-monitoring").textContent = appData.monitoring.length;

  // Cari agenda terdekat
  const today = new Date().toISOString().split("T")[0];
  const upcoming = appData.agenda
    .filter((a) => a.Tanggal >= today)
    .sort((a, b) => a.Tanggal.localeCompare(b.Tanggal));

  const highlightEl = document.getElementById("highlight-agenda");
  if (upcoming.length > 0) {
    highlightEl.textContent = `${upcoming[0].Kegiatan} (${formatTanggalIndo(upcoming[0].Tanggal)})`;
  } else if (appData.agenda.length > 0) {
    highlightEl.textContent = `${appData.agenda[0].Kegiatan} (${formatTanggalIndo(appData.agenda[0].Tanggal)})`;
  } else {
    highlightEl.textContent = "Belum ada agenda kegiatan terjadwal.";
  }
}

// --- Render Struktur Pengurus ---
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
    const matchText =
      String(item.Nama).toLowerCase().includes(keyword) ||
      String(item.Dapukan).toLowerCase().includes(keyword) ||
      String(item.Kelompok).toLowerCase().includes(keyword);
    const matchDesa = filterDesa === "" || item.Desa === filterDesa;
    return matchText && matchDesa;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-slate-400">Data pengurus tidak ditemukan.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (item, index) => `
      <tr class="hover:bg-emerald-50/50 transition">
        <td class="py-3.5 px-6 text-slate-500 font-medium">${index + 1}</td>
        <td class="py-3.5 px-6 font-bold text-slate-900">${escapeHtml(item.Nama)}</td>
        <td class="py-3.5 px-6">
          <span class="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-semibold text-xs">
            ${escapeHtml(item.Dapukan)}
          </span>
        </td>
        <td class="py-3.5 px-6 text-slate-700">${escapeHtml(item.Desa)}</td>
        <td class="py-3.5 px-6 text-slate-700">${escapeHtml(item.Kelompok)}</td>
      </tr>
    `
    )
    .join("");
}

document.getElementById("search-pengurus").addEventListener("input", renderPengurus);
document.getElementById("filter-desa").addEventListener("change", renderPengurus);

// --- Render Tupoksi Pengurus (Mendukung teks panjang tanpa batas) ---
function renderTupoksi() {
  const container = document.getElementById("tupoksi-container");
  if (appData.tupoksi.length === 0) {
    container.innerHTML = `<div class="col-span-full py-10 text-center text-slate-400">Belum ada rincian tupoksi yang ditambahkan.</div>`;
    return;
  }

  container.innerHTML = appData.tupoksi
    .map((item) => {
      // Ubah baris baru (\n) menjadi poin daftar yang rapi
      const lines = String(item.Tupoksi)
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const listHtml = lines
        .map(
          (line) => `
          <li class="flex items-start gap-2.5 text-sm text-slate-700 leading-relaxed">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0"></span>
            <span>${escapeHtml(line.replace(/^[-•*]\s*/, ""))}</span>
          </li>
        `
        )
        .join("");

      return `
        <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition">
          <div class="flex items-center gap-3 border-b border-slate-100 pb-3 mb-4">
            <div class="w-9 h-9 rounded-lg bg-emerald-900 text-amber-400 flex items-center justify-center font-bold text-sm shrink-0">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            </div>
            <h3 class="font-bold text-lg text-emerald-950">${escapeHtml(item.Dapukan)}</h3>
          </div>
          <ul class="space-y-2.5">${listHtml}</ul>
        </div>
      `;
    })
    .join("");
}

// --- Render Agenda Kegiatan ---
function filterAgenda(type) {
  currentAgendaFilter = type;
  document.querySelectorAll(".agenda-filter-btn").forEach((btn) => {
    if (btn.dataset.filter === type) {
      btn.className = "agenda-filter-btn px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-900 text-white transition";
    } else {
      btn.className = "agenda-filter-btn px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition";
    }
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
    container.innerHTML = `<div class="col-span-full py-10 text-center text-slate-400">Tidak ada agenda kegiatan pada kategori ini.</div>`;
    return;
  }

  container.innerHTML = filtered
    .map((item) => {
      const isUpcoming = item.Tanggal >= today;
      const badgeClass = isUpcoming
        ? "bg-emerald-100 text-emerald-800"
        : "bg-slate-200 text-slate-600";
      const badgeText = isUpcoming ? "Akan Datang" : "Terlaksana";

      return `
        <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-2 mb-3">
              <span class="text-xs font-bold px-2.5 py-1 rounded-full ${badgeClass}">${badgeText}</span>
              <span class="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                ${formatTanggalIndo(item.Tanggal)}
              </span>
            </div>
            <h3 class="font-bold text-lg text-slate-900 mb-2">${escapeHtml(item.Kegiatan)}</h3>
            ${item.WaktuTempat ? `<p class="text-xs font-medium text-emerald-700 mb-2">📍 ${escapeHtml(item.WaktuTempat)}</p>` : ""}
            <p class="text-sm text-slate-600 leading-relaxed">${escapeHtml(item.Keterangan || "-")}</p>
          </div>
        </div>
      `;
    })
    .join("");
}

// --- Render Monitoring ---
function renderMonitoring() {
  const container = document.getElementById("monitoring-container");
  if (appData.monitoring.length === 0) {
    container.innerHTML = `<div class="col-span-full py-10 text-center text-emerald-300">Belum ada tautan monitoring yang tersedia.</div>`;
    return;
  }

  container.innerHTML = appData.monitoring
    .map(
      (item) => `
      <div class="bg-emerald-900/70 border border-emerald-800 rounded-2xl p-6 flex flex-col justify-between hover:border-amber-400/50 transition">
        <div>
          <span class="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
            ${escapeHtml(item.TanggalStatus || "Monitoring Aktif")}
          </span>
          <h3 class="font-bold text-lg text-white mt-1.5 mb-4">${escapeHtml(item.Kegiatan)}</h3>
        </div>
        <a href="${escapeHtml(item.Link)}" target="_blank" rel="noopener noreferrer" class="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-emerald-950 font-bold text-sm text-center transition flex items-center justify-center gap-2">
          <span>Buka Tautan Kegiatan</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
        </a>
      </div>
    `
    )
    .join("");
}

/**
 * ============================================================================
 * 4. SISTEM AUTENTIKASI & CRUD ADMIN TERSEMBUNYI
 * ============================================================================
 */
function openAdminAccess() {
  const token = sessionStorage.getItem("kmm_admin_token");
  if (token) {
    openAdminPanel();
  } else {
    document.getElementById("login-error-msg").classList.add("hidden");
    document.getElementById("admin-pin-input").value = "";
    document.getElementById("admin-login-modal").classList.remove("hidden");
    document.getElementById("admin-pin-input").focus();
  }
}

function closeLoginModal() {
  document.getElementById("admin-login-modal").classList.add("hidden");
}

function openAdminPanel() {
  closeLoginModal();
  document.getElementById("admin-panel-modal").classList.remove("hidden");
  switchAdminTab("Pengurus");
}

function closeAdminPanel() {
  document.getElementById("admin-panel-modal").classList.add("hidden");
}

function logoutAdmin() {
  sessionStorage.removeItem("kmm_admin_token");
  closeAdminPanel();
  alert("Sesi Admin telah diakhiri.");
}

// Proses Login Verifikasi PIN ke Google Sheets
document.getElementById("admin-login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pinInput = document.getElementById("admin-pin-input").value.trim();
  const btn = document.getElementById("btn-submit-login");
  const errEl = document.getElementById("login-error-msg");

  btn.disabled = true;
  btn.textContent = "Memverifikasi ke Server...";
  errEl.classList.add("hidden");

  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        api_key: API_KEY,
        action: "login",
        pin: pinInput
      })
    });
    const res = await response.json();

    if (res.status === "success" && res.token) {
      sessionStorage.setItem("kmm_admin_token", res.token);
      openAdminPanel();
    } else {
      errEl.textContent = res.message || "PIN tidak sesuai dengan Spreadsheet!";
      errEl.classList.remove("hidden");
    }
  } catch (err) {
    errEl.textContent = "Gagal terhubung ke server Apps Script.";
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Verifikasi PIN";
  }
});

// Konfigurasi Field Form Berdasarkan Tab Admin
const adminFieldConfigs = {
  Pengurus: [
    { name: "Nama", label: "Nama Lengkap Pengurus", type: "text", required: true },
    { name: "Dapukan", label: "Dapukan / Jabatan", type: "text", required: true },
    { name: "Desa", label: "Asal Desa", type: "text", required: true },
    { name: "Kelompok", label: "Asal Kelompok", type: "text", required: true }
  ],
  Tupoksi: [
    { name: "Dapukan", label: "Nama Dapukan", type: "text", required: true },
    { name: "Tupoksi", label: "Daftar Tupoksi Kegiatan (Pisahkan tiap poin dengan Enter / baris baru, tanpa batas panjang)", type: "textarea", required: true }
  ],
  Agenda: [
    { name: "Kegiatan", label: "Nama Kegiatan KMM", type: "text", required: true },
    { name: "Tanggal", label: "Tanggal Pelaksanaan", type: "date", required: true },
    { name: "WaktuTempat", label: "Waktu & Tempat", type: "text", required: false },
    { name: "Keterangan", label: "Deskripsi / Keterangan", type: "textarea", required: false }
  ],
  Monitoring: [
    { name: "Kegiatan", label: "Nama Kegiatan / Musyawarah", type: "text", required: true },
    { name: "TanggalStatus", label: "Tanggal / Status (Contoh: Nov 2026 - Aktif)", type: "text", required: false },
    { name: "Link", label: "URL Link Tujuan (https://...)", type: "url", required: true }
  ]
};

function switchAdminTab(tabName) {
  currentAdminTab = tabName;
  document.querySelectorAll(".admin-tab-btn").forEach((btn) => {
    if (btn.dataset.tab === tabName) {
      btn.className = "admin-tab-btn py-3.5 text-sm font-bold border-b-2 border-emerald-800 text-emerald-900 whitespace-nowrap";
    } else {
      btn.className = "admin-tab-btn py-3.5 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-800 whitespace-nowrap";
    }
  });
  resetAdminForm();
  renderAdminDataList();
}

function resetAdminForm() {
  document.getElementById("edit-record-id").value = "";
  document.getElementById("admin-form-title").textContent = `Tambah Data ${currentAdminTab}`;
  document.getElementById("btn-cancel-edit").classList.add("hidden");

  const container = document.getElementById("dynamic-form-fields");
  const fields = adminFieldConfigs[currentAdminTab];

  container.innerHTML = fields
    .map((f) => {
      if (f.type === "textarea") {
        return `
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">${f.label}</label>
            <textarea id="field-${f.name}" rows="6" ${f.required ? "required" : ""} class="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-700 outline-none"></textarea>
          </div>
        `;
      }
      return `
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">${f.label}</label>
          <input type="${f.type}" id="field-${f.name}" ${f.required ? "required" : ""} class="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-700 outline-none" />
        </div>
      `;
    })
    .join("");
}

function renderAdminDataList() {
  const listEl = document.getElementById("admin-data-list");
  const key = currentAdminTab.toLowerCase();
  const items = appData[key] || [];
  document.getElementById("admin-list-count").textContent = items.length;

  if (items.length === 0) {
    listEl.innerHTML = `<p class="text-xs text-slate-400 py-6 text-center">Belum ada data pada kategori ini.</p>`;
    return;
  }

  listEl.innerHTML = items
    .map((item) => {
      const title = item.Nama || item.Dapukan || item.Kegiatan || "Item";
      const subtitle = item.Dapukan && item.Nama ? `${item.Dapukan} • ${item.Desa}` : (item.Tanggal || item.Link || (item.Tupoksi ? item.Tupoksi.substring(0, 70) + "..." : ""));

      return `
        <div class="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="font-bold text-sm text-slate-900 truncate">${escapeHtml(title)}</p>
            <p class="text-xs text-slate-500 truncate">${escapeHtml(subtitle)}</p>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button onclick='editAdminRecord(${JSON.stringify(item).replace(/'/g, "&#39;")})' class="px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 text-xs font-semibold">Edit</button>
            <button onclick="deleteAdminRecord('${item.ID}')" class="px-2.5 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 text-xs font-semibold">Hapus</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function editAdminRecord(item) {
  document.getElementById("edit-record-id").value = item.ID;
  document.getElementById("admin-form-title").textContent = `Edit Data ${currentAdminTab}`;
  document.getElementById("btn-cancel-edit").classList.remove("hidden");

  const fields = adminFieldConfigs[currentAdminTab];
  fields.forEach((f) => {
    const el = document.getElementById(`field-${f.name}`);
    if (el) el.value = item[f.name] || "";
  });
}

// Simpan Data (Create / Update)
document.getElementById("admin-crud-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const token = sessionStorage.getItem("kmm_admin_token");
  if (!token) return alert("Sesi habis, silakan login ulang.");

  const editId = document.getElementById("edit-record-id").value;
  const action = editId ? "update" : "create";
  const fields = adminFieldConfigs[currentAdminTab];
  const record = {};

  fields.forEach((f) => {
    record[f.name] = document.getElementById(`field-${f.name}`).value;
  });

  const btn = document.getElementById("btn-save-crud");
  btn.disabled = true;
  btn.textContent = "Menyimpan...";

  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        api_key: API_KEY,
        token: token,
        action: action,
        sheet: currentAdminTab,
        id: editId,
        record: record
      })
    });
    const res = await response.json();

    if (res.status === "success") {
      resetAdminForm();
      await fetchAllData();
      alert(res.message);
    } else {
      alert("Gagal: " + res.message);
    }
  } catch (err) {
    alert("Terjadi kesalahan jaringan saat menyimpan data.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Simpan ke Spreadsheet";
  }
});

// Hapus Data
async function deleteAdminRecord(id) {
  if (!confirm("Yakin ingin menghapus data ini dari Spreadsheet?")) return;
  const token = sessionStorage.getItem("kmm_admin_token");
  if (!token) return alert("Sesi habis, silakan login ulang.");

  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        api_key: API_KEY,
        token: token,
        action: "delete",
        sheet: currentAdminTab,
        id: id
      })
    });
    const res = await response.json();

    if (res.status === "success") {
      await fetchAllData();
    } else {
      alert("Gagal menghapus: " + res.message);
    }
  } catch (err) {
    alert("Kesalahan koneksi saat menghapus data.");
  }
}

/**
 * ============================================================================
 * 5. UTILITAS & NAVIGASI MOBILE
 * ============================================================================
 */
document.getElementById("mobile-menu-btn").addEventListener("click", () => {
  document.getElementById("mobile-menu").classList.toggle("hidden");
});

document.querySelectorAll(".mobile-nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    document.getElementById("mobile-menu").classList.add("hidden");
  });
});

function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTanggalIndo(dateStr) {
  if (!dateStr) return "-";
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const parts = String(dateStr).split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]} ${months[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
}

// Jalankan fetch data saat halaman dibuka
window.addEventListener("DOMContentLoaded", fetchAllData);
