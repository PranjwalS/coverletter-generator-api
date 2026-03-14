// Persistent logic, API calls, message routing


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "scan") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "scanFields" }, (fields) => {
        // hit backend here, then send fill values back
        chrome.tabs.sendMessage(tabs[0].id, { action: "fillFields", data: fields });
        sendResponse({ status: "Done!" });
      });
    });
    return true; 
  }
});

