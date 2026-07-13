import { createServer } from "node:http";
import { readFileSync } from "node:fs";

/** @type {Set<WeakRef<import('http').ServerResponse>>} */
const listeners = new Set();
const clientScript = readFileSync("./client.mjs", "utf8");
const indexFile = readFileSync("./index.html", "utf8");

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
      const detach = () => listeners.delete(k);
      listeners.add(k);

      req.on("close", detach);
      req.on("error", detach);
      return;

    case "POST /c":
      try {
        const body = Buffer.concat(await req.toArray()).toString("utf8");
        const json = JSON.stringify(JSON.parse(body));
        res.writeHead(202).end();

        console.log(json);

        listeners.forEach((ref) => {
          const stream = ref?.unref();

          if (!stream) {
            listeners.delete(ref);
            return;
          }

          stream.write("data: " + json + "\r\n\r\n");
        });
      } catch (e) {
        console.log(e);
        res.closed || res.writeHead(400).end();
      }
      return;

    default:
      res.writeHead(404).end("Not found");
  }
});

server.listen(process.env.PORT);
