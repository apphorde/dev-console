const baseUrl = "https://__BASE_URL__";

// --- Pure Helper Functions (Allocated Only Once) ---

const isElement = (val) => typeof Element !== 'undefined' && val instanceof Element;
const isObject = (val) => typeof val === 'object' && val !== null;

function serializeError(err) {
  return {
    error: err.name || "Error",
    message: err.message,
    stack: err.stack ? err.stack.split('\n').map(line => line.trim()) : []
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
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      serializedObj[key] = transformValue(obj[key]);
    }
  }
  return serializedObj;
}

/**
 * Pure transformer function to handle individual values based on type
 */
function transformValue(val) {
  // 1. Primitives & Immediate Escapes
  if (val === null) return null;
  if (val === undefined) return "undefined";
  
  const type = typeof val;
  
  if (type === 'string' || type === 'number' || type === 'boolean') {
    return val;
  }
  if (type === 'function' || type === 'symbol') {
    return val.toString();
  }
  if (type === 'bigint') {
    return `${val.toString()}n`;
  }

  // 2. Complex Objects & Instances
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

  // Fallback for anything else
  return val;
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
