// Posts a photo to the Facebook Page via the Graph API, using a Page
// Access Token derived from a Business Manager System User (doesn't
// expire, unlike tokens derived from a personal long-lived user token).

const CAPTION = `#PremRawat #prem #rawat #premrawatji #satsang #music #premrawatquotes #PeaceIsPossible #KnowTheSelf #PEP #PeaceEducationProgram #peaceeducation #PEAK #peace #inspiration #Breath #quotes #dailyquotes #life #human #breathbook #hearyourselfbook #tprf #wopg
#amaroo`;

async function postToFacebookPage(imageBuffer) {
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;

  const form = new FormData();
  form.append("source", new Blob([imageBuffer], { type: "image/jpeg" }), "quote.jpg");
  form.append("caption", CAPTION);
  form.append("access_token", token);

  const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Facebook post failed: ${JSON.stringify(data)}`);
  }
  return data;
}

module.exports = { postToFacebookPage, CAPTION };
