// Looks up a YouTube video's oEmbed info (title + thumbnail) via the public
// oEmbed endpoint (no API key needed). Used so the header's second link
// shows the actual video title, and the email can show a clickable
// thumbnail - Gmail's own "paste a bare link" preview card is a compose-
// time-only feature and never appears in a programmatically-sent email, so
// this thumbnail is how we get an equivalent look.

async function getYoutubeOEmbed(videoUrl) {
  if (!videoUrl) return null;
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(videoUrl)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function getYoutubeTitle(videoUrl) {
  const data = await getYoutubeOEmbed(videoUrl);
  return (data && data.title) || null;
}

async function getYoutubeThumbnail(videoUrl) {
  const data = await getYoutubeOEmbed(videoUrl);
  return (data && data.thumbnail_url) || null;
}

module.exports = { getYoutubeTitle, getYoutubeThumbnail, getYoutubeOEmbed };
