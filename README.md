# Memory ordering in CPUs — visualized

An interactive, dependency-free companion to Fabian Giesen's article, [“Memory ordering in CPUs”](https://fgiesen.wordpress.com/2026/08/25/memory-ordering-in-cpus/).

The simulation visualizes a message-passing race:

- both CPU models speculate an out-of-order load;
- a writer publishes `payload = 42` and `ready = 1`;
- a strong model detects the invalid speculative observation and replays it;
- a weak model may retire that outcome for relaxed operations, until an acquire/release edge tells it otherwise.

It is a conceptual visualization, not a cycle-accurate CPU model.

## Run locally

The site is static. Open `index.html` directly, or serve it locally:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## Publish to GitHub Pages

The included Actions workflow deploys every push to `main`.

1. In the repository, open **Settings → Pages**.
2. Under **Build and deployment**, choose **GitHub Actions** as the source.
3. Push the changes to `main`.

The site will be available at <https://matteodelseppia.github.io/memory-ordering-in-cpus/>.
