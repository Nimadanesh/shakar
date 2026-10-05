/* Theme anti-FOUC: runs before hydration (beforeInteractive) so the saved
   theme applies before first paint. Kept as a separate file (rather than
   inline) so React/Next never see a <script> element in the component tree. */
(function () {
  try {
    var t = localStorage.getItem("shakar-theme");
    if (t === "light") {
      var d = document.documentElement;
      d.classList.remove("dark");
      d.classList.add("light");
    }
  } catch (e) {}
})();
