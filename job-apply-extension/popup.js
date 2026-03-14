// The UI when you click the icon, with the buttons and html and styles.css

document.getElementById("scanBtn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "scan" }, (response) => {
    document.getElementById("status").textContent = response.status;
  });
});