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
    if (ctx.includes("firstname") || ctx.includes("first name") || ctx.includes("fname")) {
      fillInput(input, "Pranjwal");
    }
    if (ctx.includes("lastname") || ctx.includes("last name") || ctx.includes("lname")) {
      fillInput(input, "Singh");
    }

    if (ctx.includes("phone") || ctx.includes("phone number") || ctx.includes("phoneNumber") || ctx.includes("telephone")) {
      fillInput(input, "4387734010");
    }
    if(ctx.includes("_r_11_")) {
      fillInput(input, "Canada");
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
    window.HTMLInputElement.prototype, 'value'
  ).set;
  nativeInputValueSetter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}