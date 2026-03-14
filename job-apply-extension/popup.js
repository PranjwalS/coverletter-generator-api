// The UI when you click the icon, with the buttons and html and styles.css

document.getElementById("autofill").onclick = () => {

  chrome.tabs.query({active:true,currentWindow:true}, tabs => {

    chrome.tabs.sendMessage(
      tabs[0].id,
      {action:"autofill"}
    );

  });

};