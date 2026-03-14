
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