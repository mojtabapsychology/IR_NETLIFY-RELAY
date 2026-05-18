const express = require("express");

const app = express();

const FALLBACK_PAGE =
  "https://ir-netlify.github.io/NETLIFY/";

const BLOCKED_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
]);

app.use(
  express.raw({
    type: "*/*",
    limit: "50mb",
  })
);

function constructDestUrl(
  domain,
  path,
  query
) {
  if (
    domain.startsWith("http://") ||
    domain.startsWith("https://")
  ) {
    return `${domain}${path}${query}`;
  }

  const isHttps =
    !domain.includes(":") ||
    domain.includes(":443") ||
    /^s\d+\./.test(domain);

  return `${
    isHttps
      ? "https://"
      : "http://"
  }${domain}${path}${query}`;
}

app.use(async (req, res) => {

  console.log(
    req.method,
    req.path,
    req.headers["x-host"] ||
      "NO_X_HOST"
  );

  try {

    const destHost =
      req.headers["x-host"];

    // fallback page
    if (
      req.path === "/" &&
      !destHost
    ) {

      const page =
        await fetch(
          FALLBACK_PAGE
        );

      const html =
        await page.text();

      res.setHeader(
        "content-type",
        "text/html; charset=UTF-8"
      );

      return res.send(
        html
      );
    }

    if (!destHost) {
      return res
        .status(400)
        .send(
          "Invalid Request: Missing target host."
        );
    }

    const query =
      req.url.includes("?")
        ? "?" +
          req.url.split(
            "?"
          )[1]
        : "";

    const targetUrl =
      constructDestUrl(
        destHost,
        req.path,
        query
      );

    const headers = {};

    let clientIp =
      null;

    for (const [
      key,
      value,
    ] of Object.entries(
      req.headers
    )) {

      const k =
        key.toLowerCase();

      if (
        BLOCKED_HEADERS.has(
          k
        ) ||
        k.startsWith(
          "x-nf-"
        ) ||
        k.startsWith(
          "x-netlify-"
        ) ||
        k ===
          "x-host"
      ) {
        continue;
      }

      if (
        k ===
        "x-real-ip"
      ) {
        clientIp =
          value;
        continue;
      }

      if (
        k ===
        "x-forwarded-for"
      ) {
        if (
          !clientIp
        ) {
          clientIp =
            value;
        }

        continue;
      }

      headers[k] =
        value;
    }

    if (clientIp) {
      headers[
        "x-forwarded-for"
      ] = clientIp;
    }

    const upstream =
      await fetch(
        targetUrl,
        {
          method:
            req.method,

          headers,

          redirect:
            "manual",

          body:
            req.method ===
              "GET" ||
            req.method ===
              "HEAD"
              ? undefined
              : req.body,
        }
      );

    res.status(
      upstream.status
    );

    upstream.headers.forEach(
      (
        value,
        key
      ) => {

        if (
          key.toLowerCase() !==
          "transfer-encoding"
        ) {
          res.setHeader(
            key,
            value
          );
        }

      }
    );

    const body =
      Buffer.from(
        await upstream.arrayBuffer()
      );

    res.send(body);

  } catch (err) {

    console.error(
      err
    );

    res
      .status(502)
      .send(
        "Gateway Error: Connection Failed"
      );
  }

});

const port =
  process.env.PORT ||
  10000;

app.listen(
  port,
  () => {
    console.log(
      `Relay running on ${port}`
    );
  }
);
