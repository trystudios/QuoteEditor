// Posts a photo to Instagram via the Graph API. Unlike Facebook's /photos
// endpoint, Instagram requires a publicly reachable image URL (no direct
// file upload) and a two-step create-container-then-publish flow.
//
// IG_ACCESS_TOKEN is the same non-expiring System User token as
// FB_PAGE_ACCESS_TOKEN (the System User has both the Page and the IG
// account assigned as business assets) - kept as a separate env var in
// case they ever need to diverge, but currently identical.

async function postToInstagram(imageUrl, caption) {
  const igUserId = process.env.IG_USER_ID;
  const token = process.env.IG_ACCESS_TOKEN;

  const createRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: token }),
  });
  const createData = await createRes.json();
  if (!createRes.ok) {
    throw new Error(`Instagram media creation failed: ${JSON.stringify(createData)}`);
  }

  const publishRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: createData.id, access_token: token }),
  });
  const publishData = await publishRes.json();
  if (!publishRes.ok) {
    throw new Error(`Instagram publish failed: ${JSON.stringify(publishData)}`);
  }
  return publishData;
}

module.exports = { postToInstagram };
