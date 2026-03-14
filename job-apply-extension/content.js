// Runs inside the tab, touches the page DOM


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "scanFields") {
    const fields = scanPage(); 
    sendResponse(fields);
  }
  if (message.action === "fillFields") {
    fillPage(message.data);
  }
});

///gotta move everything to a storage with a collection, key-value typeshit (HIDDEN)


```
User clicks "Scan" in popup
        ↓
popup.js sends message to background: { action: "scan" }
        ↓
background.js forwards to content.js in the active tab
        ↓
content.js reads all inputs, sends field data back to background
        ↓
background.js hits your backend API with the field summary
        ↓
backend responds with fill values
        ↓
background.js sends those values to content.js
        ↓
content.js fills the form fields
        ↓
content.js sends "done" back, popup updates UI
```