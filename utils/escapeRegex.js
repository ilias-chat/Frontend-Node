/**
 * Escape a string for safe use inside a RegExp source (literal substring match).
 * @param {string} s
 */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegex };
