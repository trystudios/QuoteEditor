// Parses the "/data" page's free-text recipient list ("Name <email>, Name
// <email>, ...", comma and/or newline separated) into a plain array of
// email addresses, for use as the weekly digest's BCC list. The raw text
// (with names) is what gets stored and shown back in the textarea.

const EMAIL_RE = /<([^>]+)>|([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;

function parseRecipientEmails(text) {
  const emails = [];
  const seen = new Set();
  for (const m of String(text || "").matchAll(EMAIL_RE)) {
    const email = (m[1] || m[2] || "").trim().toLowerCase();
    if (email && !seen.has(email)) {
      seen.add(email);
      emails.push(email);
    }
  }
  return emails;
}

const DEFAULT_RECIPIENTS_TEXT = `anita jagodzinska <marianita.j@wp.pl>, hsing211 <hsing211@yahoo.com.tw>, Jean-Pierre PHILIPPE <jeanpierrephi@gmail.com>, Rajesh Rathod <rajeshnrathod@gmail.com>, Peter Boiu German Quotes <peter-boiu@gmx.de>, Lobo Gmail <tovoheryrazaka@gmail.com>, Marc G <ararasgrimberg@gmail.com>, Lobo Razakamanana <loborazaka@hotmail.com>, Rafal <rafalewski@gmail.com>, Viviane Vohangy Ratsisetraina <viviane.ratsisetraina@yahoo.fr>, Géraldi <tag_antonello@hotmail.com>, Carlos Saraiva <carlos.c.saraiva@gmail.com>, Delia Ortega <palabrasdepaz4@gmail.com>, Sergio Pereira <marzollini@msn.com>, Giorgos Dimitriou <drgiorgis@rocketmail.com>, Tiki regwun <regwuntiki@gmail.com>, Jean-Luc MARÉCHAL <jelumar00@gmail.com>, Julio Perez <juliodemenezespinto91@gmail.com>, Michael Dorfman <mdorfman7@gmail.com>, Umul choironi - Bahasa Indonesia <shidra12@gmail.com>, Ziga Valetic Slovenian Quotes <ziga.valetic@gmail.com>, Bahaa Zahnan <zahnanb@gmail.com>`;

module.exports = { parseRecipientEmails, DEFAULT_RECIPIENTS_TEXT };
