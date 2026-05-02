/**
 * @file cookie.js
 * @description Utility functions for reading cookies in the browser.
 */

/**
 * Get cookie value by name
 * @param {string} name - The cookie name to retrieve
 * @returns {string|null} The cookie value or null if not found
 */
export function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}
