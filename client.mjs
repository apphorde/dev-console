const baseUrl = "https://__BASE_URL__";

function send(type, args) {
  try {
    fetch(new URL("/c", baseUrl), {
      method: "POST",
      body: JSON.stringify({ source: location.href, type, args }),
    });
  } catch {}
}

export function listen() {
  const events = new EventTarget();
  const source = new EventSource("/events");

  source.onmessage = (e) => {
    const { type, args, source } = JSON.parse(e.data);
    events.dispatchEvent(new CustomEvent("log", { type, args, source }));
  };

  return events;
}

const original = globalThis.console;

if (new URL(location.href).searchParams.get("console")) {
  const l = ["info", "error", "debug", "log", "warn"];
  l.forEach((m) => {
    globalThis.console[m] = function (...args) {
      original[m](...args);
      send(m, args);
    };
  });
}
