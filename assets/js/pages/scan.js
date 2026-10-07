(async function () {
  if (Auth.hasOAuthCallback && Auth.hasOAuthCallback()) {
    try {
      await Auth.handleOAuthLogin();
    } catch (err) {
      alert(err.message || "Gagal memproses login Google.");
      window.location.replace("/login/");
      return;
    } finally {
      document.documentElement.classList.remove("oauth-processing");
      const overlay = document.getElementById("scanOAuthLoading");
      if (overlay) overlay.remove();
    }
  }

  UI.renderPage({ active: "scan", title: "Scan Presensi", desc: "Pindai kode QR untuk mencatat kehadiran" });

  const manualInput = document.getElementById("manualInput");
  const btnManualSubmit = document.getElementById("btnManualSubmit");
  const tabManual = document.getElementById("tabManual");
  const tabCamera = document.getElementById("tabCamera");
  const panelManual = document.getElementById("panelManual");
  const panelCamera = document.getElementById("panelCamera");
  const btnRetryCam = document.getElementById("btnRetryCam");
  const camRetryRow = document.getElementById("camRetryRow");
  const camDot = document.getElementById("camDot");
  const camStatusText = document.getElementById("camStatusText");
  const reader = document.getElementById("reader");
  const cameraViewport = reader.parentElement;
  const scanDate = document.getElementById("scanDate");
  const todayHeading = document.getElementById("todayHeading");

  let html5QrCode = null;
  let cameraRunning = false;
  let cameraRequested = false;
  let cameraJob = Promise.resolve();
  let cameraVersion = 0;
  let cameraWidth = 0;
  let cameraHeight = 0;
  let cameraViewportHeight = 0;
  let cameraResizeTimer;
  let lastCode = null;
  let lastTime = 0;
  let processing = false;
  let siswaToday = [];
  let pelatihToday = [];

  init();

  function init() {
    bindTabs();
    setupDateField();
    bindManual();
    bindCamera();
    loadToday();
    focusManualInput();
    window.addEventListener("beforeunload", stopCamera);
    window.addEventListener("pagehide", stopCamera);
  }

  /* ---------------------- TANGGAL LATIHAN (BACKDATE) ---------------------- */
  function setupDateField() {
    const today = UI.todayISO();
    const min = new Date();
    min.setDate(min.getDate() - 7);
    scanDate.max = today;
    scanDate.min = UI.dateToISO(min);
    scanDate.value = today;
    scanDate.addEventListener("change", () => {
      if (!scanDate.value) scanDate.value = today;
      loadToday();
    });
  }

  function selectedTanggal() {
    return scanDate.value || UI.todayISO();
  }

  /* ---------------------- TAB SWITCHING ---------------------- */
  function bindTabs() {
    tabManual.addEventListener("click", () => switchTab("manual"));
    tabCamera.addEventListener("click", () => switchTab("camera"));
  }

  function switchTab(mode) {
    const isManual = mode === "manual";
    document.body.classList.toggle("camera-mode", !isManual);
    panelManual.classList.toggle("hidden", !isManual);
    panelCamera.classList.toggle("hidden", isManual);
    tabManual.classList.toggle("btn-dark", isManual);
    tabManual.classList.toggle("btn-ghost", !isManual);
    tabCamera.classList.toggle("btn-dark", !isManual);
    tabCamera.classList.toggle("btn-ghost", isManual);
    if (isManual) {
      stopCamera();
      focusManualInput();
    } else if (!cameraRunning) {
      startCamera();
    }
  }

  /* ---------------------- MODE MANUAL / ALAT SCANNER ---------------------- */
  function bindManual() {
    manualInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitManual();
      }
    });
    btnManualSubmit.addEventListener("click", submitManual);
    document.addEventListener("click", (e) => {
      // Kolom tetap fokus utk alat scanner, kecuali user isi form lain.
      if (!panelManual.classList.contains("hidden") && !e.target.closest(".modal")) {
        setTimeout(focusManualInput, 50);
      }
    });
  }

  function focusManualInput() {
    if (!panelManual.classList.contains("hidden")) manualInput.focus();
  }

  function submitManual() {
    const code = manualInput.value.trim();
    manualInput.value = "";
    if (!code) return;
    processBarcode(code);
  }

  /* ---------------------- MODE KAMERA ---------------------- */
  function bindCamera() {
    btnRetryCam.addEventListener("click", startCamera);
    reader.addEventListener("loadedmetadata", (event) => {
      const video = event.target;
      if (video.videoWidth && video.videoHeight) {
        cameraViewport.style.setProperty("--camera-ratio", video.videoWidth / video.videoHeight);
      }
    }, true);
    // Library hitung crop hanya saat start, bukan saat video resize.
    const cameraObserver = new ResizeObserver(() => {
      clearTimeout(cameraResizeTimer);
      if (!cameraRequested || !cameraRunning || !html5QrCode?.isScanning || panelCamera.classList.contains("hidden")) return;
      const width = reader.clientWidth;
      const height = reader.clientHeight;
      if (!width || !height || (width === cameraWidth && height === cameraHeight && cameraViewport.clientHeight === cameraViewportHeight)) return;
      cameraResizeTimer = setTimeout(() => {
        if (cameraRequested && cameraRunning && !panelCamera.classList.contains("hidden")) startCamera();
      }, 150);
    });
    cameraObserver.observe(reader);
    cameraObserver.observe(cameraViewport);
  }

  function startCamera() {
    clearTimeout(cameraResizeTimer);
    cameraRequested = true;
    cameraRunning = false;
    const version = ++cameraVersion;
    camRetryRow.classList.add("hidden");
    camDot.style.background = "#9CA3AF";
    camStatusText.textContent = "Menyalakan kamera…";

    // Serialize operasi kamera: resize tidak boleh tinggalkan stream lama.
    cameraJob = cameraJob.then(async () => {
      if (version !== cameraVersion) return;
      await releaseCamera();
      if (version !== cameraVersion) return;
      if (typeof Html5Qrcode === "undefined") {
        showCameraError("Library kamera gagal dimuat. Cek koneksi internet.");
        return;
      }
      html5QrCode = new Html5Qrcode("reader", {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      const config = {
        fps: 12,
        videoConstraints: { facingMode: "environment", aspectRatio: { ideal: 1 } },
        qrbox: (viewWidth, viewHeight) => {
          clearTimeout(cameraResizeTimer);
          cameraWidth = viewWidth;
          cameraHeight = viewHeight;
          cameraViewportHeight = cameraViewport.clientHeight;
          // Jaga area decoding tetap persegi + margin kecil di kamera compact.
          let availableSize = Math.min(viewWidth, viewHeight);
          if (window.matchMedia("(max-width: 767px)").matches) {
            // Pertahankan QR box saat video full-width di-crop tengah.
            availableSize = Math.min(availableSize, cameraViewportHeight, cameraViewportHeight * viewWidth / viewHeight);
          }
          const size = Math.min(280, Math.floor(availableSize - 24));
          return { width: size, height: size };
        },
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          if (version === cameraVersion) processBarcode(decodedText);
        },
        () => {
          /* abaikan error per-frame saat belum ada QR terbaca */
        },
      );
      if (version !== cameraVersion) {
        await releaseCamera();
      } else {
        cameraRunning = true;
        camDot.style.background = "var(--teal)";
        camStatusText.textContent = "Kamera aktif — arahkan ke kode QR";
      }
    })
      .catch(() => {
        if (version === cameraVersion) showCameraError("Tidak bisa mengakses kamera. Pastikan izin kamera diaktifkan di browser.");
      });
  }

  function showCameraError(message) {
    cameraRunning = false;
    cameraRequested = false;
    camDot.style.background = "var(--red)";
    camStatusText.textContent = message;
    camRetryRow.classList.remove("hidden");
  }

  async function releaseCamera() {
    cameraRunning = false;
    if (html5QrCode) {
      const video = reader.querySelector("video");
      try {
        const state = html5QrCode.getState();
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) await html5QrCode.stop();
        html5QrCode.clear();
      } finally {
        // Lepas juga stream yang dibatalkan sebelum frame pertama muncul.
        if (video && video.srcObject) {
          video.srcObject.getTracks().forEach((track) => {
            if (track.readyState === "live") track.stop();
          });
        }
        reader.replaceChildren();
        html5QrCode = null;
      }
    }
  }

  function stopCamera() {
    cameraRequested = false;
    cameraVersion++;
    clearTimeout(cameraResizeTimer);
    cameraJob = cameraJob.then(releaseCamera).catch(() => {});
    cameraRunning = false;
    camRetryRow.classList.add("hidden");
    camDot.style.background = "#6B7280";
    camStatusText.textContent = "Menyalakan kamera…";
  }

  /* ---------------------- PROSES Presensi ---------------------- */
  async function processBarcode(rawCode) {
    const code = String(rawCode).trim();
    if (!code || processing) return;

    const now = Date.now();
    if (code === lastCode && now - lastTime < 4000) return; // cegah scan ganda beruntun
    lastCode = code;
    lastTime = now;
    processing = true;

    const isPelatih = /^PLT-?/i.test(code);

    try {
      const data = isPelatih
        ? await Api.call("scanPresensiPelatih", { barcode: code })
        : await Api.call("scanPresensi", { barcode: code, tanggal: selectedTanggal() });
      playBeep(true);
      showResult({
        ok: true,
        late: data.status === "Telat",
        nama: data.nama,
        kelompok: data.kelompok,
        waktu: data.waktu,
        status: isPelatih ? `Pelatih · ${data.status}` : data.status,
      });
      await loadToday();
    } catch (err) {
      playBeep(false);
      showResult({ ok: false, message: err.message });
    } finally {
      processing = false;
      focusManualInput();
    }
  }

  function showResult({ ok, late, nama, kelompok, waktu, status, message }) {
    const empty = document.getElementById("resultEmpty");
    const card = document.getElementById("resultCard");
    const icon = document.getElementById("resultIcon");
    empty.classList.add("hidden");
    card.classList.add("show");

    if (ok) {
      icon.className = "result-icon " + (late ? "late" : "ok");
      icon.innerHTML = late ? UI.ICONS.alertTriangle : UI.ICONS.check;
      document.getElementById("resultName").textContent = nama;
      document.getElementById("resultMeta").textContent = `${status}`;
      document.getElementById("resultTime").textContent = UI.formatJam(waktu) + " WIB";
    } else {
      icon.className = "result-icon err";
      icon.innerHTML = UI.ICONS.x;
      document.getElementById("resultName").textContent = "Gagal Mencatat";
      document.getElementById("resultMeta").textContent = message;
      document.getElementById("resultTime").textContent = UI.formatJam(new Date()) + " WIB";
    }
  }

  function playBeep(success) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = success ? 880 : 220;
      gain.gain.value = 0.08;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (success ? 0.12 : 0.25));
    } catch (e) {
      /* abaikan jika audio tidak didukung */
    }
  }

  /* ---------------------- DAFTAR HARI INI ---------------------- */
  async function loadToday() {
    try {
      const tanggal = selectedTanggal();
      const [siswaData, pelatihData] = await Promise.all([
        Api.call("getPresensiList", { tanggal }),
        Api.call("getPresensiPelatihList", { dari: tanggal, sampai: tanggal }),
      ]);
      siswaToday = siswaData.rows || [];
      pelatihToday = pelatihData.rows || [];
      todayHeading.textContent = tanggal === UI.todayISO() ? "Presensi Hari Ini" : `Presensi ${UI.formatTanggal(tanggal)}`;
      renderTodayList();
    } catch (err) {
      // diam-diam gagal, tidak mengganggu proses scan
    }
  }

  function renderTodayList() {
    const box = document.getElementById("todayList");
    document.getElementById("todayCount").textContent = siswaToday.length + pelatihToday.length;
    if (!siswaToday.length && !pelatihToday.length) {
      box.innerHTML = '<div class="empty-state"><h3>Belum ada presensi</h3><p>Mulai scan untuk mencatat kehadiran.</p></div>';
      return;
    }
    box.innerHTML = UI.todayAttendanceHtml(siswaToday, pelatihToday);
  }
})();
