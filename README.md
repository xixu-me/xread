# Xread

Your LLMs deserve better input.

Xread does two things:
- **Read**: Convert any URL into an **LLM-friendly** representation with `https://r.example.com/https://your.url`.
- **Search**: Search the web with `https://s.example.com/your+query` and return summarized results in an LLM-friendly format.

Check out the placeholder demo at [https://example.com/xread#demo](https://example.com/xread#demo).

## Usage

### Read a single URL

Prepend `https://r.example.com/` to any URL:

[https://r.example.com/https://en.wikipedia.org/wiki/Artificial_intelligence](https://r.example.com/https://en.wikipedia.org/wiki/Artificial_intelligence)

### Search the web

Prepend `https://s.example.com/` to a URL-encoded search query:

[https://s.example.com/Who%20will%20win%202024%20US%20presidential%20election%3F](https://s.example.com/Who%20will%20win%202024%20US%20presidential%20election%3F)

Behind the scenes, Xread fetches relevant pages and converts them into a format that is easier for downstream LLMs and agent systems to consume.

### In-site search

Use repeated `site` parameters to constrain results:

```bash
curl 'https://s.example.com/When%20was%20example.com%20founded%3F?site=example.com&site=github.com'
```

### Interactive code builder

Use the placeholder builder URL:

[https://example.com/xread#apiform](https://example.com/xread#apiform)

## Request headers

The service behavior can be controlled via headers:

- `x-with-generated-alt: true` enables automatic image alt-text generation.
- `x-set-cookie` forwards cookies.
- `x-respond-with` supports `markdown`, `html`, `text`, `screenshot`, and related formats.
- `x-proxy-url` selects a custom proxy.
- `x-cache-tolerance` adjusts cache tolerance in seconds.
- `x-no-cache: true` bypasses cached content.
- `x-target-selector` narrows extraction to a CSS selector.
- `x-wait-for-selector` waits until a CSS selector appears.

## SPA fetching

For hash-based routing, use `POST` with the target URL in the body:

```bash
curl -X POST 'https://r.example.com/' -d 'url=https://example.com/#/route'
```

## Streaming mode

```bash
curl -H "Accept: text/event-stream" https://r.example.com/https://en.m.wikipedia.org/wiki/Main_Page
```

Streaming responses return progressively more complete content chunks.

## JSON mode

```bash
curl -H "Accept: application/json" https://r.example.com/https://en.m.wikipedia.org/wiki/Main_Page
```

For `s.example.com`, JSON mode returns a list of search results shaped like `{'title', 'content', 'url'}`.

## Generated alt

```bash
curl -H "X-With-Generated-Alt: true" https://r.example.com/https://en.m.wikipedia.org/wiki/Main_Page
```

## Standalone Notes

This repository now carries its shared infrastructure helpers in `src/shared/` so the stand-alone crawl/search/serp entrypoints can build and run without private dependencies.

## License

This repository is distributed under [Apache-2.0](./LICENSE). See [NOTICE](./NOTICE) for modification and attribution details.
