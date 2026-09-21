// Builds the "Thought for the Day" daily email HTML: header links, the
// quote image (rounded corners are decorative CSS only — the underlying
// image file/URL is untouched, so save/download always gets the full
// sharp-cornered JPG), and two rows of footer links.
//
// `unchangeUrl` is the one per-day variable; everything else is fixed.

const STATIC_LINKS = {
  thoughtForTheDay: "https://www.premrawat.com/",
  premRawat: "https://www.premrawat.com/",
  i4joy: "https://i4joy.com/",
  youtube: "http://youtube.com/premrawatofficial",
  timelessToday: "https://timelesstoday.tv/",
  tprf: "https://tprf.org/",
  intelligentExistence: "https://www.intelligentexistence.com/",
  breathBook: "https://breathbook.life/",
  growWithKnowledge: "https://growwithknowledge.com/",
};

function buildEmailHtml({ imageUrl, unchangeUrl, unchangeTitle, subject }) {
  const linkStyle = "color:#1155CC; text-decoration:underline;";
  const sep = `<span style="color:#333; padding:0 3px;">|</span>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<style>
  @media only screen and (max-width: 480px) {
    .footer-links { font-size: 15px !important; }
    .footer-break { display: none !important; }
    .footer-sep-mobile { display: inline !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background:#ffffff; font-family:Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr>
      <td align="center" style="padding:0 16px;">
        <!--[if mso]>
        <table role="presentation" width="600" align="center"><tr><td>
        <![endif]-->
        <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="width:100%; max-width:600px;">
          <tr>
            <td align="center" style="padding:16px 8px 14px 8px; font-size:14px;">
              <a href="${STATIC_LINKS.thoughtForTheDay}" style="${linkStyle}">Thought for the Day</a> ${sep} <a href="${unchangeUrl}" style="${linkStyle}">${unchangeTitle || "Watch video"}</a>
            </td>
          </tr>
          <tr>
            <td align="center">
              <div style="border-radius:16px; overflow:hidden; width:100%; max-width:600px; line-height:0;">
                <img src="${imageUrl}" alt="${subject || "Quote of the Day"}" style="display:block; width:100%; max-width:600px; height:auto; border:0;" />
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" class="footer-links" style="padding:12px 4px 18px 4px; font-size:13px; line-height:1.3;">
              <a href="${STATIC_LINKS.premRawat}" style="${linkStyle} white-space:nowrap;">Prem Rawat</a> ${sep} <a href="${STATIC_LINKS.i4joy}" style="${linkStyle}">i4Joy</a> ${sep} <a href="${STATIC_LINKS.youtube}" style="${linkStyle}">Youtube</a> ${sep} <a href="${STATIC_LINKS.timelessToday}" style="${linkStyle} white-space:nowrap;">TimelessToday</a><br class="footer-break"><span class="footer-sep-mobile" style="display:none; color:#333; padding:0 3px;"> ${sep} </span> <a href="${STATIC_LINKS.tprf}" style="${linkStyle}">TPRF</a> ${sep} <a href="${STATIC_LINKS.intelligentExistence}" style="${linkStyle} white-space:nowrap;">Intelligent Existence</a> ${sep} <a href="${STATIC_LINKS.breathBook}" style="${linkStyle} white-space:nowrap;">Breath Book</a> ${sep} <a href="${STATIC_LINKS.growWithKnowledge}" style="${linkStyle} white-space:nowrap;">Grow with Knowledge</a>
            </td>
          </tr>
        </table>
        <!--[if mso]>
        </td></tr></table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { buildEmailHtml, STATIC_LINKS };
