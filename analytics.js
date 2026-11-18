// Google Analytics 4: anonymous counts of actions and moods reached.
// Fill in the ID once (steps in github.com/suhibug/personal-analytics). Empty = GA4 does not load.
// No session recordings here: the camera view stays on the device.
const GA4_ID = "G-4QHGR986MS";  // looks like G-XXXXXXXXXX (same one as the portfolio)

if (GA4_ID) {
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA4_ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  gtag("js", new Date());
  gtag("config", GA4_ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
}
