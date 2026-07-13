import { createServer } from "node:http";
import { readFileSync } from "node:fs";

/** @type {Set<WeakRef<import('http').ServerResponse>>} */
const listeners = new Set();
const clientScript = readFileSync("./client.mjs", "utf8");
const indexFile = readFileSync("./index.html", "utf8");

export function publish(type, event) {
  for (const ref of listeners) {
    const stream = ref.deref();
    if (!stream || stream.detached || !stream.writable) {
      listeners.delete(ref);
      continue;
    }

    stream.write(`data: ${JSON.stringify({ type, data: event })}\n\n`);
  }
}

const server = createServer(async function (req, res) {
  const url = new URL(req.url, "http://a");
  const route = `${req.method} ${url.pathname}`;

  switch (route) {
    case "GET /":
      res
        .writeHead(200, {
          "Content-Type": "text/html",
        })
        .end(indexFile);
      return;

    case "GET /index.mjs":
      const code = clientScript.replace(
        "__BASE_URL__",
        String(req.headers["x-forwarded-for"]),
      );

      res
        .writeHead(200, {
          "Content-Type": "text/javascript",
          "Content-Length": code.length,
          "Cache-Control": "max-age=604800, must-revalidate",
          "Access-Control-Allow-Origin": "*",
        })
        .end(code);
      return;

    case "GET /events":
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");

      const k = new WeakRef(res);

      listeners.add(k);
      const detach = () => {
        listeners.delete(k);
      };

      req.on("close", detach);
      req.on("error", detach);
      return;

    case "POST /c":
      try {
        const body = Buffer.concat(await req.toArray()).toString("utf8");
        const json = JSON.stringify(JSON.parse(body));

        listeners.forEach((l) => {
          const stream = l.unref();
          if (!stream) {
            listeners.delete(l);
            return;
          }

          stream.write("data: " + json + "\r\n\r\n");
        });

        res.writeHead(202).end();
      } catch {}
      return;

    default:
      res.writeHead(404).end("Not found");
  }
});

server.listen(process.env.PORT);
