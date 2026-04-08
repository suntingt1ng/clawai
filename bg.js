// bg.js - 极简版
chrome.runtime.onInstalled.addListener(() => {
  console.log("ClawAI 插件已加载");
  chrome.contextMenus.create({
    id: "explain",
    title: "AI解释",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "explain") {
    chrome.tabs.sendMessage(tab.id, { text: info.selectionText });
  }
});
