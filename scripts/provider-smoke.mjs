const provider = process.argv[2];
const text = process.argv[3] || '请只回复：通过';
const extensionUrl = 'chrome-extension://ikdgdknndlemjmmlamdpokefmkbggjnf/sidepanel/index.html';

if (!provider) throw new Error('provider is required');

const targets = await fetch('http://127.0.0.1:9333/json').then((response) => response.json());
const target = targets.find((item) => item.url === extensionUrl);
if (!target) throw new Error('extension target missing');

const result = await new Promise((resolve, reject) => {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const expression = `new Promise((resolve) => {
    const operationId = ${JSON.stringify(`smoke-${provider}-`)} + Date.now();
    const events = [];
    const timer = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(onMessage);
      resolve({ timeout: true, events });
    }, 90000);
    function onMessage(message) {
      if (message?.source !== 'background' || message.event?.operationId !== operationId) return;
      events.push(message.event);
      if (message.event.type === 'PROVIDER_RESPONSE_COMPLETED' || message.event.type === 'PROVIDER_ERROR') {
        clearTimeout(timer);
        chrome.runtime.onMessage.removeListener(onMessage);
        resolve({ timeout: false, events });
      }
    }
    chrome.runtime.onMessage.addListener(onMessage);
    chrome.runtime.sendMessage({
      type: 'SEND_TO_PROVIDER',
      provider: ${JSON.stringify(provider)},
      operationId,
      payload: { text: ${JSON.stringify(text)}, attachments: [] }
    }).catch((error) => {
      clearTimeout(timer);
      chrome.runtime.onMessage.removeListener(onMessage);
      resolve({ sendError: String(error), events });
    });
  })`;
  ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== 1) return;
    if (message.result?.exceptionDetails) reject(new Error(message.result.exceptionDetails.text || 'runtime evaluate failed'));
    else resolve(message.result?.result?.value);
    ws.close();
  };
  ws.onerror = reject;
});

console.log(JSON.stringify(result, null, 2));
