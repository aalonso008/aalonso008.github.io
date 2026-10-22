(function () {
  var deferredPrompt = null;
  var banner = document.getElementById('installBanner');
  var installBtn = document.getElementById('installBtn');
  var installClose = document.getElementById('installClose');
  var installHint = document.getElementById('installHint');
  var installModal = document.getElementById('installModal');
  var headerInstallBtn = document.getElementById('headerInstallBtn');

  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  var isAndroid = /Android/i.test(navigator.userAgent);
  var isIOSChrome = isIOS && /CriOS/i.test(navigator.userAgent);
  var isIOSFirefox = isIOS && /FxiOS/i.test(navigator.userAgent);
  var isInAppBrowser = /Instagram|FBAN|FBAV|WhatsApp|Line\//i.test(navigator.userAgent);
  var isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  function hideBanner() {
    if (banner) banner.classList.remove('show');
  }

  function showBanner() {
    if (banner && !isStandalone) banner.classList.add('show');
  }

  function setHint(text) {
    if (installHint) installHint.textContent = text;
  }

  function showInstallModal() {
    if (installModal) installModal.classList.add('show');
  }

  function hideInstallModal() {
    if (installModal) installModal.classList.remove('show');
  }

  function step(key) {
    return typeof I18n !== 'undefined' ? I18n.t(key) : key;
  }

  function getInstallSteps() {
    if (isInAppBrowser) return [step('pwa.inapp.1'), step('pwa.inapp.2'), step('pwa.inapp.3')];
    if (isIOSChrome || isIOSFirefox) return [step('pwa.iosx.1'), step('pwa.iosx.2'), step('pwa.iosx.3')];
    if (isIOS) return [step('pwa.ios.1'), step('pwa.ios.2')];
    if (isAndroid) return [step('pwa.and.1'), step('pwa.and.2'), step('pwa.and.3'), step('pwa.and.4'), step('pwa.and.5')];
    return [step('pwa.desk')];
  }

  function renderInstallSteps() {
    var list = document.getElementById('installSteps');
    if (!list) return;
    list.innerHTML = getInstallSteps()
      .map(function (step) {
        return '<li>' + step + '</li>';
      })
      .join('');
  }

  function setupMobileInstructions() {
    if (isStandalone) return;
    if (isIOS) {
      if (installBtn) installBtn.style.display = 'none';
      setHint(typeof I18n !== 'undefined' ? I18n.t('pwa.ios') : 'Safari → Compartir → Agregar a pantalla de inicio');
    } else if (isAndroid) {
      setHint(typeof I18n !== 'undefined' ? I18n.t('pwa.android') : 'Chrome normal → Menú (⋮) → Instalar app');
    }
    showBanner();
  }

  function tryInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () {
        deferredPrompt = null;
      });
      return;
    }
    renderInstallSteps();
    showInstallModal();
    showBanner();
  }

  function cleanupOldWorkers() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (reg) {
        if (reg.scope.indexOf('miturina') !== -1) reg.unregister();
      });
    });
  }

  function checkInstallReady() {
    if (isStandalone || !isAndroid) return;
    if (!('serviceWorker' in navigator)) {
      setHint(typeof I18n !== 'undefined' ? I18n.t('pwa.unsupported') : 'Tu navegador no soporta apps instalables. Usa Chrome.');
      showBanner();
      return;
    }
    navigator.serviceWorker.getRegistration('/').then(function (reg) {
      if (!reg || !reg.active) {
        setHint(typeof I18n !== 'undefined' ? I18n.t('pwa.wait') : 'Espera unos segundos a que cargue la app…');
        showBanner();
      }
    });
  }

  cleanupOldWorkers();

  if (!isStandalone) {
    setTimeout(setupMobileInstructions, 1500);
    setTimeout(checkInstallReady, 4000);
  } else {
    hideBanner();
    if (headerInstallBtn) headerInstallBtn.style.display = 'none';
    return;
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
    if (installBtn) {
      installBtn.style.display = '';
      installBtn.textContent = typeof I18n !== 'undefined' ? I18n.t('header.install') : 'Instalar';
    }
    setHint(typeof I18n !== 'undefined' ? I18n.t('pwa.ready') : 'Listo: toca Instalar para modo app');
    showBanner();
  });

  if (installBtn) installBtn.addEventListener('click', tryInstall);
  if (headerInstallBtn) headerInstallBtn.addEventListener('click', tryInstall);
  if (installClose) installClose.addEventListener('click', hideBanner);

  var modalClose = document.getElementById('installModalClose');
  if (modalClose) modalClose.addEventListener('click', hideInstallModal);

  if (installModal) {
    installModal.addEventListener('click', function (e) {
      if (e.target === installModal) hideInstallModal();
    });
  }

  window.addEventListener('appinstalled', function () {
    hideBanner();
    hideInstallModal();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (window.__reloadingForSw) return;
      window.__reloadingForSw = true;
      window.location.reload();
    });
    navigator.serviceWorker.getRegistration().then(function (registration) {
      if (!registration) return;
      if (registration.waiting) showUpdate(registration);
      registration.addEventListener('updatefound', function () {
        var worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', function () {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(registration);
        });
      });
    });
  }

  function showUpdate(registration) {
    var bar = document.getElementById('updateBanner');
    if (!bar) return;
    bar.hidden = false;
    var button = document.getElementById('updateNow');
    if (button) {
      button.onclick = function () {
        if (registration.waiting) registration.waiting.postMessage('skip-waiting');
      };
    }
  }
})();
