// Loading screen, theme shortcut and the optional performance readout.
document.addEventListener("DOMContentLoaded", function () {
  const loadingScreen = document.getElementById("loadingScreen");
  if (loadingScreen) {
    loadingScreen.classList.add("hidden");
    setTimeout(() => {
      loadingScreen.style.display = "none";
    }, 500);
  }

  // Frame rate readout, only with ?debug in the address.
  const debug = new URLSearchParams(location.search).has("debug");
  const perfIndicator = document.getElementById("perfIndicator");
  if (debug && perfIndicator) {
    perfIndicator.style.display = "block";
    let lastTime = performance.now();

    function updateFPS() {
      const now = performance.now();
      const fps = Math.round(1000 / (now - lastTime));
      lastTime = now;
      document.getElementById("perfText").textContent = `FPS: ${fps} | Theme: ${LiveBackground.getTheme()}`;
      requestAnimationFrame(updateFPS);
    }

    updateFPS();
  }

  // Press 'T' to cycle background themes.
  document.addEventListener("keydown", function (e) {
    if ((e.key === "t" || e.key === "T") && typeof LiveBackground !== "undefined") {
      LiveBackground.nextTheme();

      const notification = document.createElement("div");
      notification.className = "theme-toast";
      notification.textContent = `Theme: ${LiveBackground.getTheme()}`;
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.remove();
      }, 2000);
    }
  });
});
