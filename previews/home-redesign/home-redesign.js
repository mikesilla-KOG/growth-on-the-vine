// Ask chips are plain links to /ask/ (work without JavaScript). With JavaScript, the shared ask.js
// (same file the live home uses) fills the box and answers in place, so we only stop the link navigation.
(function () {
  if (!document.getElementById('askform')) return;
  [].forEach.call(document.querySelectorAll('a.gv-chip'), function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); });
  });
})();
