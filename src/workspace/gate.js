// The map is only available inside a project: until the person has at least one project, the front page asks them to create one.
// Kept as a small pure function so the rule is easy to read and to test.
//   status      the project store's state: 'loading' | 'ready' | 'error'
//   count       how many projects are saved
//   sharedOpen  a read-only shared project is open (opening a link someone sent you is allowed without a project of your own)
//   bypass      the saved projects could not be read; the person is allowed in only to fix that
export function isLocked({ status, count = 0, sharedOpen = false, bypass = false } = {}) {
  if (bypass || sharedOpen) return false;
  if (status !== 'ready') return true;     // still loading, or damaged: do not show the map yet
  return count === 0;
}
