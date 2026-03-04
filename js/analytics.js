(function () {
  // Galaxy Mini Games GA4 property.
  const MEASUREMENT_ID = 'G-ZCHTLPM0KL';

  function canTrack() {
    if (!MEASUREMENT_ID) {
      return false;
    }

    if (window.location.protocol === 'file:') {
      return false;
    }

    return true;
  }

  if (!canTrack()) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  const loader = document.createElement('script');
  loader.async = true;
  loader.src =
    'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(MEASUREMENT_ID);
  document.head.appendChild(loader);

  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID, {
    anonymize_ip: true
  });

  window.GMGAnalytics = {
    track: function (eventName, eventParams) {
      if (!eventName || typeof window.gtag !== 'function') {
        return;
      }

      window.gtag('event', eventName, eventParams || {});
    }
  };
})();
