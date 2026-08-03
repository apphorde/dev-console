const baseUrl = "https://__BASE_URL__";

const isElement = (val) => val && val instanceof Element;
const isObject = (val) => val && typeof val === 'object';

function serializeError(err) {
  return {
    error: err.name || "Error",
    message: err.message,
    stack: err.stack ? String(err.stack).split('\n').map(line => line.trim()) : []
  };
}

function serializeMap(map) {
  const serializedObj = {};
  
  for (const [key, value] of map.entries()) {
    serializedObj[key] = transformValue(value);
  }
  
  return serializedObj;
}

function serializeObject(obj) {
  const serializedObj = {};
  
  for (const key in obj) {
    serializedObj[key] = transformValue(obj[key]);
  }
  
  return serializedObj;
}

function transformValue(val) {
  if (val === null) return null;
  if (val === undefined) return "undefined";
  
  const type = typeof val;
  
  if (type === 'string' || type === 'number' || type === 'boolean') {
    return val;
  }
  
  if (type === 'function' || type === 'symbol') {
    return String(val);
  }
  
  if (type === 'bigint') {
    return `${val.toString()}n`;
  }

  if (isElement(val)) {
    return val.outerHTML;
  }
  
  if (val instanceof Error) {
    return serializeError(val);
  }
  
  if (val instanceof Date) {
    return val.toISOString();
  }
  
  if (val instanceof Set) {
    return Array.from(val).map(transformValue);
  }
  
  if (val instanceof Map) {
    return serializeMap(val);
  }
  
  if (Array.isArray(val)) {
    return val.map(transformValue);
  }
  
  if (isObject(val)) {
    return serializeObject(val);
  }

  return String(val);
}

function send(type, args) {
  const source = new URL(location.href).hostname;
  const a = args.map(transformValue)
  try {
    fetch(new URL("/c", baseUrl), {
      method: "POST",
      body: JSON.stringify({ source, type, args: a }),
    });
  } catch {}
}

const logger = console.log;

export function listen() {
  const events = new EventTarget();
  const source = new EventSource("/events");

  source.onmessage = (e) => {
    logger(e.data);
    const { type, args, source } = JSON.parse(e.data);
    events.dispatchEvent(
      new CustomEvent("log", { detail: { type, args, source } }),
    );
  };

  return events;
}

if (new URL(location.href).searchParams.get("console")) {
  const l = ["info", "error", "debug", "log", "warn"];
  l.forEach((m) => {
    const original = globalThis.console[m];
    globalThis.console[m] = function (...args) {
      original(...args);
      send(m, args);
    };
  });
}
