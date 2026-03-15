// Runs inside the tab, touches the page DOM

console.log("content script loaded on:", window.location.href);
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "scanFields") {
    const fields = scanPage(); 
    sendResponse(fields);
  }
  if (message.action === "fillFields") {
    fillPage(message.data);
  }

  if (message.action === "togglePanel") {
    const result = togglePanel();
    sendResponse(result);
  }
});

///gotta move everything to a storage with a collection, key-value typeshit (HIDDEN)

function scanPage() {
  const inputs = document.querySelectorAll("input, textarea");
  const fields = [];
  inputs.forEach(input => {
    fields.push({
      name: input.name,
      id: input.id,
      placeholder: input.placeholder,
      type: input.type
    });
  });
  console.log("scanned fields:", fields);
  return fields;
}

function fillPage(data) {
  const inputs = document.querySelectorAll("input, textarea");
  
  inputs.forEach(input => {
    const ctx = getFieldContext(input);
    console.log("ctx:", ctx, "| type:", input.type);

    if (ctx.includes("name")) {
      fillInput(input, "Pranjwal Singh");
    }

    if (ctx.includes("firstname") || ctx.includes("first name") || ctx.includes("fname")) {
      fillInput(input, "Pranjwal");
    }
    if (ctx.includes("lastname") || ctx.includes("last name") || ctx.includes("lname")) {
      fillInput(input, "Singh");
    }

    if (ctx.includes("phone") || ctx.includes("phone number") || ctx.includes("phoneNumber") || ctx.includes("telephone")) {
      fillInput(input, "4387734010");
    }
    if (ctx.includes("country") || ctx.includes("select-input")) {
      fillDropdown(input, "Canada");
    }

    if (ctx.includes("email")) {
      fillInput(input, "singhpranjwal@gmail.com");
    }
  });
}



function getFieldContext(input) {
  const attrs = [
    input.name,
    input.id,
    input.placeholder,
    input.getAttribute("aria-label"),
  ];
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) attrs.push(label.innerText);
  }
  return attrs.filter(Boolean).join(" ").toLowerCase();
}
 
function fillInput(input, value) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, "value"
  ).set;
  nativeInputValueSetter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
 
function fillDropdown(input, value) {
  input.focus();
  input.click();
  fillInput(input, value);
  setTimeout(() => {
    const selectors = ['[role="option"]', '[class*="option"]', '[class*="item"]', 'li'];
    for (const sel of selectors) {
      const options = document.querySelectorAll(sel);
      if (options.length) {
        options.forEach(opt => {
          if (opt.textContent.trim().toLowerCase().includes(value.toLowerCase())) {
            opt.click();
          }
        });
        break;
      }
    }
  }, 300);
}




// ── FLOATING PANEL ──────────────────────────────────────────────
function injectPanel() {
  if (document.getElementById("applyai-panel")) return;
 
  const panel = document.createElement("div");
  panel.id = "applyai-panel";
  panel.innerHTML = `
    <div id="applyai-header">
      <span id="applyai-logo">⚡</span>
      <span id="applyai-title">APPLY AI</span>
      <button id="applyai-close">✕</button>
    </div>
    <div id="applyai-buttons">
      <button class="applyai-btn applyai-primary" id="applyai-fill">
        <span class="applyai-icon">🗂</span>
        <span class="applyai-label">Autofill Profile</span>
      </button>
      <button class="applyai-btn applyai-secondary" id="applyai-cover">
        <span class="applyai-icon">✍️</span>
        <span class="applyai-label">Cover Letter</span>
      </button>
      <button class="applyai-btn applyai-tertiary" id="applyai-answer">
        <span class="applyai-icon">💡</span>
        <span class="applyai-label">Answer Question</span>
      </button>
    </div>
    <div id="applyai-status">ready</div>
  `;
 
  const style = document.createElement("style");
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
 
    #applyai-panel {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      width: 210px;
      background: #0a0a0f;
      border: 1px solid #1e1e2e;
      border-radius: 16px;
      padding: 12px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,109,250,0.1);
      font-family: 'Syne', sans-serif;
      animation: applyai-slide-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      transition: opacity 0.2s, transform 0.2s;
    }
 
    #applyai-panel.applyai-hidden {
      opacity: 0;
      transform: translateY(12px) scale(0.95);
      pointer-events: none;
    }
 
    @keyframes applyai-slide-in {
      from { opacity: 0; transform: translateY(16px) scale(0.93); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
 
    #applyai-header {
      display: flex;
      align-items: center;
      gap: 7px;
      margin-bottom: 10px;
      padding-bottom: 9px;
      border-bottom: 1px solid #1e1e2e;
    }
 
    #applyai-logo {
      width: 22px; height: 22px;
      background: linear-gradient(135deg, #7c6dfa, #fa6d9a);
      border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px;
      flex-shrink: 0;
    }
 
    #applyai-title {
      font-size: 11px;
      font-weight: 800;
      color: #e8e8f0;
      letter-spacing: 0.06em;
      flex: 1;
    }
 
    #applyai-close {
      background: none;
      border: none;
      color: #5a5a7a;
      font-size: 10px;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 4px;
      transition: color 0.15s, background 0.15s;
      line-height: 1;
    }
    #applyai-close:hover { color: #e8e8f0; background: #1e1e2e; }
 
    #applyai-buttons { display: flex; flex-direction: column; gap: 6px; }
 
    .applyai-btn {
      width: 100%;
      background: #111118;
      border: 1px solid #1e1e2e;
      border-radius: 9px;
      padding: 8px 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.15s ease;
      text-align: left;
    }
 
    .applyai-btn:hover { transform: translateX(2px); }
    .applyai-primary:hover  { border-color: #7c6dfa; box-shadow: 0 0 12px rgba(124,109,250,0.2); }
    .applyai-secondary:hover { border-color: #fa6d9a; box-shadow: 0 0 12px rgba(250,109,154,0.2); }
    .applyai-tertiary:hover  { border-color: #6dfabc; box-shadow: 0 0 12px rgba(109,250,188,0.2); }
 
    .applyai-icon { font-size: 13px; flex-shrink: 0; }
 
    .applyai-label {
      font-family: 'Syne', sans-serif;
      font-size: 10.5px;
      font-weight: 700;
      color: #e8e8f0;
      letter-spacing: 0.01em;
    }
 
    #applyai-status {
      font-family: 'DM Mono', monospace;
      font-size: 8.5px;
      color: #5a5a7a;
      letter-spacing: 0.06em;
      margin-top: 9px;
      padding-top: 8px;
      border-top: 1px solid #1e1e2e;
      text-align: center;
      transition: color 0.2s;
    }
 
    #applyai-status.applyai-success { color: #6dfabc; }
    #applyai-status.applyai-loading { color: #7c6dfa; }
    #applyai-status.applyai-error   { color: #fa6d9a; }
  `;
 
  document.head.appendChild(style);
  document.body.appendChild(panel);
 
  const panelStatus = (msg, type = "") => {
    const el = document.getElementById("applyai-status");
    el.textContent = msg;
    el.className = type ? `applyai-${type}` : "";
  };
 
  document.getElementById("applyai-close").addEventListener("click", () => {
    panel.classList.add("applyai-hidden");
  });
 
  document.getElementById("applyai-fill").addEventListener("click", () => {
    panelStatus("scanning...", "loading");
    const fields = scanPage();
    fillPage(fields);
    panelStatus("done!", "success");
    setTimeout(() => panelStatus("ready"), 2500);
  });
 
  document.getElementById("applyai-cover").addEventListener("click", () => {
    panelStatus("coming soon...", "loading");
    setTimeout(() => panelStatus("ready"), 2000);
  });
 
  document.getElementById("applyai-answer").addEventListener("click", () => {
    panelStatus("highlight text first", "");
    setTimeout(() => panelStatus("ready"), 2000);
  });
}
 
function togglePanel() {
  const panel = document.getElementById("applyai-panel");
  if (!panel) { injectPanel(); return { visible: true }; }
  const isHidden = panel.classList.toggle("applyai-hidden");
  return { visible: !isHidden };
}
 
// Auto-show on job pages
function isJobPage() {
  const keywords = ["apply", "careers", "jobs", "application", "join", "lever", "greenhouse", "workday"];
  return keywords.some(k => window.location.href.toLowerCase().includes(k));
}
 
if (isJobPage()) {
  setTimeout(() => injectPanel(), 1200);
}