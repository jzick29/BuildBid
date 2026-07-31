// AnalyticsScripts — injects Google Tag (gtag.js) and Meta Pixel (fbq)
// configured via env vars. IDs are read at server-render time, so they are
// embedded directly in the HTML response. They are NOT secrets.

const googleAdsId = process.env.GOOGLE_ADS_ID || "";
const googleConversionId = process.env.GOOGLE_CONVERSION_ID || "";
const metaPixelId = process.env.META_PIXEL_ID || "";

const hasGoogle = Boolean(googleAdsId);
const hasMeta = Boolean(metaPixelId);

export function AnalyticsScripts() {
  if (!hasGoogle && !hasMeta) return null;

  return (
    <>
      {/* Google Tag (gtag.js) */}
      {hasGoogle && (
        <>
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`} />
          <script
            dangerouslySetInnerHTML={{
              __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${googleAdsId}');
${googleConversionId ? `gtag('config', 'AW-${googleConversionId}');` : ""}
`,
            }}
          />
        </>
      )}

      {/* Meta Pixel */}
      {hasMeta && (
        <script
          dangerouslySetInnerHTML={{
            __html: `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${metaPixelId}');
fbq('track', 'PageView');
`,
          }}
        />
      )}

      {/* Shared conversion helper — callable from any page */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
window.__buildbidTrack = function(eventType, eventData) {
  ${hasGoogle ? `
  try {
    var data = eventData || {};
    // Google Ads conversion events
    if (eventType === 'signup') {
      gtag('event', 'conversion', { send_to: 'AW-${googleConversionId}/signup' });
      gtag('event', 'sign_up', { method: 'email' });
    } else if (eventType === 'trial_started') {
      gtag('event', 'conversion', { send_to: 'AW-${googleConversionId}/trial' });
      gtag('event', 'begin_trial', {});
    } else if (eventType === 'subscription') {
      gtag('event', 'conversion', { send_to: 'AW-${googleConversionId}/subscribe' });
      gtag('event', 'purchase', { value: data.value || '0.00', currency: 'USD' });
    }
  } catch(e) {}
  ` : ""}
  ${hasMeta ? `
  try {
    if (eventType === 'signup') {
      fbq('track', 'Lead');
    } else if (eventType === 'trial_started') {
      fbq('trackCustom', 'TrialStarted');
    } else if (eventType === 'subscription') {
      fbq('track', 'Subscribe', { value: (eventData && eventData.value) || '0.00', currency: 'USD' });
    }
  } catch(e) {}
  ` : ""}
};
`,
        }}
      />
    </>
  );
}
