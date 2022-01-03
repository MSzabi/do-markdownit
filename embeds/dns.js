'use strict';

const safeObject = require('../util/safe_object');

module.exports = md => {
  md.block.ruler.before('paragraph', 'dns', (state, startLine, endLine, silent) => {
    // If silent, don't replace
    if (silent) return false;

    // Get current string to consider (just current line)
    const pos = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    const currentLine = state.src.substring(pos, max);

    // Perform some non-regex checks for speed
    if (currentLine.length < 7) return false; // [dns a]
    if (currentLine.slice(0, 5) !== '[dns ') return false;
    if (currentLine[currentLine.length - 1] !== ']') return false;

    // Check for dns match
    const match = currentLine.match(/^\[dns (\S+?)(?: (.+))?\]$/);
    if (!match) return false;

    // Get the domain
    const domain = match[1];
    if (!domain) return false;

    // Get the types
    const types = (match[2] || '').split(/ +/).filter(x => !!x).join(',') || 'A';

    // Update the pos for the parser
    state.line = startLine + 1;

    // Add token to state
    const token = state.push('dns', 'dns', 0);
    token.block = true;
    token.markup = match[0];
    token.dns = { domain, types };

    // Track that we need the script
    state.env._dns = safeObject(state.env._dns);
    state.env._dns.tokenized = true;

    // Done
    return true;
  });

  md.renderer.rules.dns = (tokens, index) => {
    const token = tokens[index];

    // Construct the fallback URL
    const url = new URL('https://www.digitalocean.com/community/tools/dns');
    url.searchParams.append('domain', token.dns.domain);

    // Return the HTML
    return `<div data-dns-tool-embed data-dns-domain="${md.utils.escapeHtml(token.dns.domain)}" data-dns-types="${md.utils.escapeHtml(token.dns.types)}">
    <a href="${url.toString()}" target="_blank">
        Perform a full DNS lookup for ${md.utils.escapeHtml(token.dns.domain)}
    </a>
</div>\n`;
  };

  md.core.ruler.push('dns_script', state => {
    // Check if we need to inject the script
    if (state.env._dns && state.env._dns.tokenized && !state.env._dns.injected) {
      // Set that we've injected it
      state.env._dns.injected = true;

      // Inject the token
      const token = new state.Token('html_block', '', 0);
      token.content = `<script async defer src="https://do-community.github.io/dns-tool-embed/bundle.js" type="text/javascript" onload="window.DNSToolEmbeds()"></script>\n`;
      state.tokens.push(token);
    }
  });
};
