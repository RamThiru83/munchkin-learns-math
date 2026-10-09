/**
 * Safe wrapper around localStorage. Every key is stored as `nilaa:<key>`.
 *
 * NOTE: the `nilaa:` prefix dates from the site's first name. It is kept on
 * purpose: changing it would make every child's saved stars disappear.
 * Never rename it; see docs/decisions/0004-saved-progress.md.
 */
const PREFIX = 'nilaa:';

export const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(PREFIX + k);
      return v == null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(PREFIX + k, JSON.stringify(v));
    } catch {
      /* storage full or blocked: ignore */
    }
  },
  remove(k) {
    try {
      localStorage.removeItem(PREFIX + k);
    } catch {
      /* ignore */
    }
  },
};
