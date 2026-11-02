// Static fallback for GitHub Pages (when Express/Socket.IO server is not running)
window.io = window.io || function () {
  return { on: function () {}, emit: function () {}, off: function () {} };
};
