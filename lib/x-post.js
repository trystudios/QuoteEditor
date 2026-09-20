// Posts a photo + caption to X (Twitter) via OAuth 1.0a User Context -
// chosen over OAuth 2.0 because 1.0a access tokens don't expire/rotate,
// matching the "permanent credential" approach used for Facebook/Instagram.
// Signing is implemented directly (HMAC-SHA1 per the OAuth 1.0a spec) since
// it's a small amount of code and avoids an extra dependency.

const crypto = require("crypto");

// Note the difference from the Facebook/Instagram caption: #human -> #gurupuja.
const CAPTION = `#PremRawat #prem #rawat #premrawatji #satsang #music #premrawatquotes #PeaceIsPossible #KnowTheSelf #PEP #PeaceEducationProgram #peaceeducation #PEAK #peace #inspiration #Breath #quotes #dailyquotes #life #gurupuja #breathbook #hearyourselfbook #tprf #wopg #amaroo`;

function pctEncode(str) {
  return encodeURIComponent(str).replace(/[!*'()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

// `extraParams` covers query-string or x-www-form-urlencoded body params
// that must be included in the signature - not used here since media
// upload is multipart and tweet creation is a JSON body, neither of which
// contributes params to an OAuth 1.0a signature base string.
function buildOAuthHeader(method, url, extraParams = {}) {
  const oauthParams = {
    oauth_consumer_key: process.env.X_CONSUMER_KEY,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: process.env.X_ACCESS_TOKEN,
    oauth_version: "1.0",
  };

  const allParams = { ...oauthParams, ...extraParams };
  const paramString = Object.keys(allParams)
    .sort()
    .map((k) => `${pctEncode(k)}=${pctEncode(allParams[k])}`)
    .join("&");

  const baseString = [method.toUpperCase(), pctEncode(url), pctEncode(paramString)].join("&");
  const signingKey = `${pctEncode(process.env.X_CONSUMER_SECRET)}&${pctEncode(process.env.X_ACCESS_TOKEN_SECRET)}`;
  const signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");

  const headerParams = { ...oauthParams, oauth_signature: signature };
  return (
    "OAuth " +
    Object.keys(headerParams)
      .sort()
      .map((k) => `${pctEncode(k)}="${pctEncode(headerParams[k])}"`)
      .join(", ")
  );
}

async function uploadMediaToX(imageBuffer) {
  const url = "https://upload.twitter.com/1.1/media/upload.json";
  const form = new FormData();
  form.append("media", new Blob([imageBuffer], { type: "image/jpeg" }), "quote.jpg");

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: buildOAuthHeader("POST", url) },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`X media upload failed: ${JSON.stringify(data)}`);
  }
  return data.media_id_string;
}

async function postTweet(text, mediaId) {
  const url = "https://api.twitter.com/2/tweets";
  const body = { text };
  if (mediaId) body.media = { media_ids: [mediaId] };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: buildOAuthHeader("POST", url),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`X post failed: ${JSON.stringify(data)}`);
  }
  return data;
}

async function postToX(imageBuffer, caption) {
  const mediaId = await uploadMediaToX(imageBuffer);
  return postTweet(caption, mediaId);
}

module.exports = { postToX, CAPTION, uploadMediaToX, postTweet };
