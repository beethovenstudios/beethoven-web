/* "What the model sees" — a one-file reimplementation of Beethoven's symbol
   slicing, running the Tree-sitter C++ grammar in WebAssembly.

   The engine keeps a live Tree-sitter graph of the whole workspace and cuts
   out the exact byte ranges a task needs. This demo does the same thing for a
   single file so the idea is visible: pick a symbol, see what a worker gets. */

import { Parser, Language } from '../vendor/web-tree-sitter.js';

const SAMPLE_PATH = 'src/net/rate_limit.cpp';
const SAMPLE = `// src/net/rate_limit.cpp — per-route token-bucket limiting for the HTTP router.
#include <algorithm>
#include <atomic>
#include <chrono>
#include <cstdlib>
#include <thread>
#include <stop_token>
#include <memory>
#include <mutex>
#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>

#include "core/log.h"
#include "net/request.h"
#include "net/response.h"
#include "net/router.h"

namespace net {

using Clock = std::chrono::steady_clock;

// One bucket per (route, client). Refills continuously; never bursts past cap.
struct TokenBucket {
  double cap = 60.0;
  double tokens = 60.0;
  double per_second = 1.0;
  Clock::time_point last = Clock::now();

  bool take(double n, Clock::time_point now) {
    refill(now);
    if (tokens < n) return false;
    tokens -= n;
    return true;
  }

  void refill(Clock::time_point now) {
    const double dt = std::chrono::duration<double>(now - last).count();
    tokens = std::min(cap, tokens + dt * per_second);
    last = now;
  }
};

// A limit declared for every path under \`prefix\`. Empty prefix is the default.
struct RouteRule {
  std::string prefix;
  double cap;
  double per_second;
};

// What a limited response looks like: 429 plus the retry hint in seconds.
Response too_many_requests(double retry_after_s);

// Matches the longest declared prefix, or nullptr when no rule applies.
const RouteRule* match_rule(const std::vector<RouteRule>& rules, std::string_view path);

class RateLimiter {
 public:
  explicit RateLimiter(std::vector<RouteRule> rules) : rules_(std::move(rules)) {}

  // Returns true when the request may proceed. Thread-safe.
  bool admit(const Request& req, Clock::time_point now);

  // Drops buckets idle for longer than \`idle\`. Called from the housekeeping thread.
  void sweep(Clock::time_point now, std::chrono::seconds idle);

 private:
  std::mutex mtx_;
  std::vector<RouteRule> rules_;
  std::unordered_map<std::string, TokenBucket> buckets_;
};

bool RateLimiter::admit(const Request& req, Clock::time_point now) {
  const RouteRule* rule = match_rule(rules_, req.path);
  if (!rule) return true;

  std::lock_guard<std::mutex> lock(mtx_);
  const std::string key = rule->prefix + '|' + req.client_ip;
  auto it = buckets_.find(key);
  if (it == buckets_.end()) {
    TokenBucket fresh;
    fresh.cap = rule->cap;
    fresh.tokens = rule->cap;
    fresh.per_second = rule->per_second;
    fresh.last = now;
    it = buckets_.emplace(key, fresh).first;
  }
  const bool ok = it->second.take(1.0, now);
  if (!ok) BVN_LOG_WARN("rate limit: %s from %s", req.path.c_str(), req.client_ip.c_str());
  return ok;
}

void RateLimiter::sweep(Clock::time_point now, std::chrono::seconds idle) {
  std::lock_guard<std::mutex> lock(mtx_);
  for (auto it = buckets_.begin(); it != buckets_.end();) {
    if (now - it->second.last > idle) it = buckets_.erase(it);
    else ++it;
  }
}

const RouteRule* match_rule(const std::vector<RouteRule>& rules, std::string_view path) {
  const RouteRule* best = nullptr;
  for (const RouteRule& r : rules) {
    if (path.substr(0, r.prefix.size()) != r.prefix) continue;
    if (!best || r.prefix.size() > best->prefix.size()) best = &r;
  }
  return best;
}

Response too_many_requests(double retry_after_s) {
  Response res;
  res.status = 429;
  res.headers["Retry-After"] = std::to_string(static_cast<int>(retry_after_s + 0.5));
  res.body = "rate limited";
  return res;
}

// Wire the limiter in front of every route the router knows about.
void install_rate_limiting(Router& router, std::vector<RouteRule> rules) {
  auto limiter = std::make_shared<RateLimiter>(std::move(rules));
  router.before_each([limiter](const Request& req, Response& res) {
    if (limiter->admit(req, Clock::now())) return true;
    res = too_many_requests(1.0);
    return false;
  });
}

// ---------------------------------------------------------------------------
// Rule loading. Rules live in [rate_limit] of the serve config as
//   /api/compose = 10/60   (ten requests, refilled over sixty seconds)
// ---------------------------------------------------------------------------
struct IniSection {
  std::string name;
  std::vector<std::pair<std::string, std::string>> entries;
};

// Parses "<cap>/<seconds>" into a RouteRule for the given prefix. Returns false on malformed input.
bool parse_rule_value(std::string_view prefix, std::string_view value, RouteRule& out) {
  const size_t slash = value.find('/');
  if (slash == std::string_view::npos) return false;
  const std::string cap_s(value.substr(0, slash));
  const std::string secs_s(value.substr(slash + 1));
  char* end = nullptr;
  const double cap = std::strtod(cap_s.c_str(), &end);
  if (end == cap_s.c_str() || cap <= 0.0) return false;
  const double secs = std::strtod(secs_s.c_str(), &end);
  if (end == secs_s.c_str() || secs <= 0.0) return false;
  out.prefix = std::string(prefix);
  out.cap = cap;
  out.per_second = cap / secs;
  return true;
}

std::vector<RouteRule> rules_from_ini(const std::vector<IniSection>& sections) {
  std::vector<RouteRule> rules;
  for (const IniSection& s : sections) {
    if (s.name != "rate_limit") continue;
    for (const auto& [key, value] : s.entries) {
      RouteRule r;
      if (parse_rule_value(key, value, r)) rules.push_back(std::move(r));
      else BVN_LOG_WARN("rate_limit: ignoring malformed rule %s = %s", key.c_str(), value.c_str());
    }
  }
  return rules;
}

// ---------------------------------------------------------------------------
// Counters. Read by the status bar and the /api/metrics route.
// ---------------------------------------------------------------------------
struct LimiterMetrics {
  std::atomic<uint64_t> admitted{0};
  std::atomic<uint64_t> rejected{0};
  std::atomic<uint64_t> buckets_swept{0};

  void record(bool ok) { (ok ? admitted : rejected).fetch_add(1, std::memory_order_relaxed); }
};

std::string metrics_json(const LimiterMetrics& m) {
  std::string out = "{";
  out += "\"admitted\":" + std::to_string(m.admitted.load(std::memory_order_relaxed)) + ",";
  out += "\"rejected\":" + std::to_string(m.rejected.load(std::memory_order_relaxed)) + ",";
  out += "\"buckets_swept\":" + std::to_string(m.buckets_swept.load(std::memory_order_relaxed));
  out += "}";
  return out;
}

// ---------------------------------------------------------------------------
// CORS. Unrelated to limiting, but it lives in the same translation unit
// because both are installed by the same serve bootstrap.
// ---------------------------------------------------------------------------
struct CorsPolicy {
  std::vector<std::string> allowed_origins;
  bool allow_credentials = false;
  int max_age_s = 600;
};

bool origin_allowed(const CorsPolicy& policy, std::string_view origin) {
  for (const std::string& o : policy.allowed_origins) {
    if (o == "*" || o == origin) return true;
  }
  return false;
}

void apply_cors_headers(const CorsPolicy& policy, const Request& req, Response& res) {
  const auto it = req.headers.find("Origin");
  if (it == req.headers.end()) return;
  if (!origin_allowed(policy, it->second)) return;
  res.headers["Access-Control-Allow-Origin"] = it->second;
  res.headers["Access-Control-Max-Age"] = std::to_string(policy.max_age_s);
  if (policy.allow_credentials) res.headers["Access-Control-Allow-Credentials"] = "true";
  res.headers["Vary"] = "Origin";
}

void install_cors(Router& router, CorsPolicy policy) {
  router.before_each([policy = std::move(policy)](const Request& req, Response& res) {
    apply_cors_headers(policy, req, res);
    if (req.method == "OPTIONS") {
      res.status = 204;
      return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Housekeeping thread: sweeps idle buckets once a minute until stop is requested.
// ---------------------------------------------------------------------------
class LimiterHousekeeper {
 public:
  LimiterHousekeeper(std::shared_ptr<RateLimiter> limiter, LimiterMetrics& metrics)
      : limiter_(std::move(limiter)), metrics_(metrics) {}

  void start() {
    thread_ = std::jthread([this](std::stop_token st) {
      while (!st.stop_requested()) {
        std::this_thread::sleep_for(std::chrono::seconds(60));
        limiter_->sweep(Clock::now(), std::chrono::minutes(10));
        metrics_.buckets_swept.fetch_add(1, std::memory_order_relaxed);
      }
    });
  }

  void stop() { thread_.request_stop(); }

 private:
  std::shared_ptr<RateLimiter> limiter_;
  LimiterMetrics& metrics_;
  std::jthread thread_;
};

}  // namespace net
`;

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const root = $('slice-demo');

let parser = null;
let source = SAMPLE;
let tree = null;
let defs = [];
let selectedKey = null;

const ui = {
  select: $('slice-symbol'),
  edit: $('slice-edit'),
  reset: $('slice-reset'),
  status: $('slice-status'),
  src: $('slice-source'),
  editor: $('slice-editor'),
  out: $('slice-output'),
  tokFile: $('tok-file'),
  tokSlice: $('tok-slice'),
  ratio: $('slice-ratio'),
  range: $('slice-range'),
};

function boot() {
  renderSource([]); // show the file immediately, before the grammar arrives
  ui.tokFile.innerHTML = tokenLabel(source.length);
  ui.out.innerHTML = '<span class="dim">Pick a task target once the grammar has loaded.</span>';

  ui.edit.addEventListener('click', toggleEdit);
  ui.reset.addEventListener('click', () => { source = SAMPLE; if (!ui.editor.hidden) toggleEdit(true); reparse(); });
  ui.select.addEventListener('change', () => { selectedKey = ui.select.value; render(); });

  const start = () => loadGrammar().catch((e) => setStatus('Parser failed to load: ' + (e && e.message ? e.message : e), 'err'));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) { io.disconnect(); start(); }
    }, { rootMargin: '800px 0px' });
    io.observe(root);
  } else {
    start();
  }
}

async function loadGrammar() {
  setStatus('Loading Tree-sitter (≈300 KB gzipped)…');
  const base = new URL('../vendor/', import.meta.url);
  await Parser.init({ locateFile: (f) => new URL(f, base).href });
  const lang = await Language.load(new URL('tree-sitter-cpp.wasm', base).href);
  parser = new Parser();
  parser.setLanguage(lang);
  setStatus('tree-sitter-cpp · ABI ' + lang.abiVersion, 'ok');
  reparse();
}

function setStatus(msg, cls) {
  ui.status.textContent = msg;
  ui.status.className = 'status' + (cls ? ' ' + cls : '');
}

function toggleEdit(forceClose) {
  const editing = !ui.editor.hidden;
  if (editing || forceClose === true) {
    if (editing && forceClose !== true) source = ui.editor.value;
    ui.editor.hidden = true;
    ui.src.hidden = false;
    ui.edit.textContent = 'Edit file';
    if (forceClose !== true) reparse();
  } else {
    ui.editor.value = source;
    ui.editor.hidden = false;
    ui.src.hidden = true;
    ui.edit.textContent = 'Apply';
    ui.editor.focus();
  }
}

// ---------------------------------------------------------------------------
// Parsing and the definition index
// ---------------------------------------------------------------------------
function reparse() {
  ui.tokFile.innerHTML = tokenLabel(source.length);
  if (!parser) { renderSource([]); return; }
  tree = parser.parse(source);
  defs = collectDefinitions(tree.rootNode);
  populateSelect();
  render();
}

const CONTAINERS = new Set(['translation_unit', 'namespace_definition', 'declaration_list', 'linkage_specification', 'preproc_if', 'preproc_ifdef', 'preproc_else', 'preproc_elif', 'template_declaration', 'export_declaration', 'module_declaration']);
const TYPES = new Set(['class_specifier', 'struct_specifier', 'union_specifier', 'enum_specifier']);

function collectDefinitions(rootNode) {
  const out = [];
  walk(rootNode, null, null);
  out.sort((a, b) => a.node.startIndex - b.node.startIndex);
  return out;

  function walk(node, owner, templateWrap) {
    const t = node.type;
    if (t === 'template_declaration') {
      for (const c of node.namedChildren) walk(c, owner, node);
      return;
    }
    if (CONTAINERS.has(t)) {
      for (const c of node.namedChildren) walk(c, owner, null);
      return;
    }
    if (t === 'function_definition') {
      const name = functionName(node);
      if (!name) return;
      out.push(mk('function', name, node, owner, templateWrap));
      return;
    }
    if (TYPES.has(t)) {
      const nm = node.childForFieldName('name');
      if (!nm) return; // anonymous
      const body = node.childForFieldName('body');
      if (!body) { out.push(mk('type-forward', nm.text, node, owner, templateWrap)); return; }
      const def = mk(t === 'enum_specifier' ? 'enum' : 'type', nm.text, node, owner, templateWrap);
      out.push(def);
      // Inline member definitions are symbols too.
      for (const c of body.namedChildren) walkMember(c, def);
      return;
    }
    if (t === 'alias_declaration' || t === 'type_definition') {
      const nm = t === 'alias_declaration' ? node.childForFieldName('name') : lastDeclarator(node.childForFieldName('declarator'));
      if (nm) out.push(mk('alias', nm.text, node, owner, templateWrap));
      return;
    }
    if (t === 'preproc_def' || t === 'preproc_function_def') {
      const nm = node.childForFieldName('name');
      if (nm) out.push(mk('macro', nm.text, node, owner, null));
      return;
    }
    if (t === 'declaration' || t === 'field_declaration') {
      // A prototype, or a variable. Classes declared inline in a declaration count as types.
      const spec = node.childForFieldName('type');
      if (spec && TYPES.has(spec.type) && spec.childForFieldName('body')) { walk(spec, owner, templateWrap); return; }
      const fd = findFunctionDeclarator(node);
      if (fd) {
        const nm = lastDeclarator(fd.childForFieldName('declarator'));
        if (nm) out.push(mk('prototype', nm.text, node, owner, templateWrap));
        return;
      }
      const decl = node.childForFieldName('declarator');
      const nm = lastDeclarator(decl && decl.type === 'init_declarator' ? decl.childForFieldName('declarator') : decl);
      if (nm) out.push(mk('variable', nm.text, node, owner, templateWrap));
    }
  }

  function walkMember(node, ownerDef) {
    const t = node.type;
    if (t === 'template_declaration') { for (const c of node.namedChildren) walkMember(c, ownerDef); return; }
    if (t === 'function_definition') {
      const name = functionName(node);
      if (name) out.push(mk('function', ownerDef.name + '::' + name, node, ownerDef, null, true));
      return;
    }
    if (TYPES.has(t) && node.childForFieldName('name') && node.childForFieldName('body')) {
      const def = mk('type', ownerDef.name + '::' + node.childForFieldName('name').text, node, ownerDef, null, true);
      out.push(def);
      for (const c of node.childForFieldName('body').namedChildren) walkMember(c, def);
    }
  }

  function mk(kind, name, node, owner, templateWrap, inline) {
    return { kind, name, short: name.split('::').pop(), node: templateWrap || node, inner: node, owner, inline: !!inline };
  }
}

function functionName(fn) {
  const fd = findFunctionDeclarator(fn);
  if (!fd) return null;
  const d = lastDeclarator(fd.childForFieldName('declarator'));
  return d ? d.text : null;
}

// Follow the declarator chain (pointer/reference/parenthesised) to the function_declarator.
function findFunctionDeclarator(node) {
  let d = node.childForFieldName('declarator');
  let guard = 0;
  while (d && guard++ < 12) {
    if (d.type === 'function_declarator') return d;
    d = d.childForFieldName('declarator');
  }
  return null;
}

function lastDeclarator(node) {
  let d = node;
  let guard = 0;
  while (d && guard++ < 12) {
    if (['identifier', 'field_identifier', 'qualified_identifier', 'destructor_name', 'operator_name', 'type_identifier'].includes(d.type)) return d;
    const next = d.childForFieldName('declarator');
    if (!next) break;
    d = next;
  }
  return null;
}

function populateSelect() {
  const sel = ui.select;
  sel.innerHTML = '';
  const picks = defs.filter((d) => d.kind === 'function' || d.kind === 'type' || d.kind === 'enum');
  if (!picks.length) {
    sel.innerHTML = '<option>no symbols found</option>';
    sel.disabled = true;
    return;
  }
  for (const d of picks) {
    const o = document.createElement('option');
    o.value = keyOf(d);
    o.textContent = (d.kind === 'function' ? 'fn  ' : 'type ') + d.name;
    sel.appendChild(o);
  }
  sel.disabled = false;
  if (!selectedKey || !picks.some((d) => keyOf(d) === selectedKey)) {
    const pref = picks.find((d) => d.name === 'RateLimiter::admit' && !d.inline) || picks.find((d) => d.kind === 'function' && !d.inline) || picks[0];
    selectedKey = keyOf(pref);
  }
  sel.value = selectedKey;
}

const keyOf = (d) => d.kind + ':' + d.name + ':' + d.node.startIndex;

// ---------------------------------------------------------------------------
// The slice
// ---------------------------------------------------------------------------
function render() {
  const target = defs.find((d) => keyOf(d) === selectedKey);
  if (!target) { renderSource([]); return; }

  const slice = buildSlice(target);
  renderSource([{ s: target.node.startIndex, e: target.node.endIndex, cls: '' }].concat(slice.deps.map((d) => ({ s: d.node.startIndex, e: d.node.endIndex, cls: 'dep' }))));
  renderOutput(slice, target);

  const fileTok = est(source.length);
  const sliceTok = est(slice.text.length);
  ui.tokSlice.innerHTML = tokenLabel(slice.text.length);
  const ratio = sliceTok > 0 ? fileTok / sliceTok : 0;
  ui.ratio.innerHTML = ratio >= 1.05 ? '<span class="x">' + ratio.toFixed(1) + '×</span> fewer tokens for the worker' : 'the target is most of the file — no saving here';
  ui.range.textContent = 'target bytes [' + target.node.startIndex + ', ' + target.node.endIndex + ')  ·  lines ' + (target.node.startPosition.row + 1) + '–' + (target.node.endPosition.row + 1);
  scrollSourceTo(target.node.startPosition.row);
}

function buildSlice(target) {
  const defByShort = new Map();
  for (const d of defs) {
    if (!defByShort.has(d.short)) defByShort.set(d.short, []);
    defByShort.get(d.short).push(d);
  }

  // The owner class of a member function, if any.
  let owner = null;
  if (target.owner) owner = target.owner;
  else if (target.name.includes('::')) {
    const scope = target.name.split('::').slice(0, -1).pop();
    owner = (defByShort.get(scope) || []).find((d) => d.kind === 'type') || null;
  }

  // Names used by the target (and by its owner's declaration, one level).
  const used = new Set();
  const locals = new Set();
  const calledBare = new Set();
  const typeNames = new Set();
  const macroLike = new Set();
  gather(target.inner, used, locals, calledBare, typeNames, macroLike);
  if (owner) gather(owner.inner, used, locals, calledBare, typeNames, macroLike, /*skipBodies*/ true);
  locals.add(target.short);

  // Resolve against this file's definitions.
  const deps = [];
  const seen = new Set();
  const consider = (d) => {
    if (d === target || seen.has(d)) return;
    if (d.inline) return;                       // members come with their class
    if (contains(d.node, target.node)) return;  // an enclosing thing, handled as owner
    if (contains(target.node, d.node)) return;  // nested inside the target
    seen.add(d);
    deps.push(d);
  };
  if (owner) consider(owner);
  for (const name of used) {
    if (locals.has(name) && name !== target.short) continue;
    for (const d of defByShort.get(name) || []) {
      if (owner && d === owner) continue;
      if (d.kind === 'prototype' && (defByShort.get(name) || []).some((x) => x.kind === 'function' && x !== target)) {
        // A prototype and a definition both exist: the signature comes from the prototype, which is cheaper.
      }
      if (d.kind === 'function' && (defByShort.get(name) || []).some((x) => x.kind === 'prototype')) continue;
      consider(d);
    }
  }
  deps.sort((a, b) => a.node.startIndex - b.node.startIndex);

  // Names that are not defined in this file at all: the engine's workspace graph would supply them.
  const unresolved = [];
  const isDefined = (n) => defByShort.has(n);
  for (const n of typeNames) if (!isDefined(n) && !locals.has(n)) unresolved.push(n);
  for (const n of calledBare) if (!isDefined(n) && !locals.has(n)) unresolved.push(n);
  for (const n of macroLike) if (!isDefined(n)) unresolved.push(n);
  const unresolvedList = Array.from(new Set(unresolved)).sort();

  const includes = [];
  for (const c of tree.rootNode.namedChildren) if (c.type === 'preproc_include') includes.push(c.text.trim());

  const outline = defs.filter((d) => d !== target && !deps.includes(d) && !d.inline && d.kind !== 'macro' && d.kind !== 'variable').map((d) => d.name);

  // Assemble.
  const parts = [];
  parts.push({ hdr: 'task target' });
  parts.push({ hdr: SAMPLE_PATH + '  bytes [' + target.node.startIndex + ', ' + target.node.endIndex + ')  lines ' + (target.node.startPosition.row + 1) + '–' + (target.node.endPosition.row + 1), sub: true });
  parts.push({ code: withLeadingComment(target.node) });
  if (deps.length) {
    parts.push({ hdr: 'declared in this file, used by the target' });
    for (const d of deps) {
      parts.push({ hdr: 'bytes [' + d.node.startIndex + ', ' + d.node.endIndex + ')  ' + d.kind + ' ' + d.name, sub: true });
      parts.push({ code: signatureOf(d) });
    }
  }
  if (unresolvedList.length) {
    parts.push({ hdr: 'not in this file' });
    parts.push({ hdr: unresolvedList.join(', '), sub: true });
    parts.push({ hdr: 'the engine resolves these from the workspace graph; this demo only has one file', sub: true });
  }
  if (includes.length) {
    parts.push({ hdr: 'includes' });
    parts.push({ code: includes.join('\n') });
  }
  if (outline.length) {
    parts.push({ hdr: 'outline of the rest of the file' });
    parts.push({ hdr: outline.join(', '), sub: true });
  }

  const text = parts.map((p) => p.code !== undefined ? p.code : '// ' + p.hdr).join('\n');
  return { parts, text, deps };
}

function gather(node, used, locals, calledBare, typeNames, macroLike, skipBodies) {
  const cursor = node.walk();
  let reached = false;
  while (!reached) {
    const n = cursor.currentNode;
    const t = n.type;
    if (skipBodies && t === 'compound_statement') {
      // don't descend
    } else {
      if (t === 'identifier' || t === 'type_identifier' || t === 'namespace_identifier') {
        const p = n.parent;
        const inStd = p && p.type === 'qualified_identifier' && p.childForFieldName('scope') && p.childForFieldName('scope').text === 'std';
        if (!inStd) used.add(n.text);
        if (t === 'type_identifier' && !inStd) typeNames.add(n.text);
        if (t === 'identifier' && /^[A-Z][A-Z0-9_]{2,}$/.test(n.text)) macroLike.add(n.text);
        if (t === 'identifier' && p && p.type === 'call_expression' && p.childForFieldName('function') && p.childForFieldName('function').id === n.id) calledBare.add(n.text);
        // Locals: declarators of parameters and local declarations.
        if (p && (p.type === 'parameter_declaration' || p.type === 'optional_parameter_declaration' || p.type === 'declaration' || p.type === 'init_declarator' || p.type === 'reference_declarator' || p.type === 'pointer_declarator')) {
          const holder = p.type === 'init_declarator' || p.type === 'reference_declarator' || p.type === 'pointer_declarator' ? p.parent : p;
          if (holder && (holder.type === 'parameter_declaration' || holder.type === 'optional_parameter_declaration' || holder.type === 'declaration' || holder.type === 'for_range_loop' || holder.type === 'condition_clause')) locals.add(n.text);
        }
      }
      if (t === 'field_identifier') {
        // member access on something else: not a dependency we can resolve here
      }
      if (cursor.gotoFirstChild()) continue;
    }
    while (true) {
      if (cursor.gotoNextSibling()) break;
      if (!cursor.gotoParent() || cursor.currentNode.id === node.id) { reached = true; break; }
    }
    if (!reached && cursor.currentNode.id === node.id) reached = true;
  }
}

function contains(outer, inner) {
  return outer.startIndex <= inner.startIndex && outer.endIndex >= inner.endIndex && outer.id !== inner.id;
}

// The signature form a worker is handed for a dependency: enough to call or use it, no bodies.
function signatureOf(d) {
  const n = d.inner;
  if (d.kind === 'function') {
    const body = n.childForFieldName('body');
    const head = source.slice(d.node.startIndex, body ? body.startIndex : n.endIndex).trimEnd();
    return head + ';';
  }
  if (d.kind === 'type') {
    // Whole specifier with every member function body elided.
    const bodies = [];
    const cursor = n.walk();
    let done = false;
    while (!done) {
      const c = cursor.currentNode;
      if (c.type === 'function_definition') {
        const b = c.childForFieldName('body');
        if (b) bodies.push([b.startIndex, b.endIndex]);
        // don't descend into functions
      } else if (cursor.gotoFirstChild()) continue;
      while (true) {
        if (cursor.gotoNextSibling()) break;
        if (!cursor.gotoParent() || cursor.currentNode.id === n.id) { done = true; break; }
      }
      if (!done && cursor.currentNode.id === n.id) done = true;
    }
    bodies.sort((a, b) => a[0] - b[0]);
    let out = '';
    let pos = d.node.startIndex;
    for (const [s, e] of bodies) {
      if (s < pos) continue;
      out += source.slice(pos, s) + '{ … }';
      pos = e;
    }
    out += source.slice(pos, d.node.endIndex);
    return out;
  }
  return withLeadingComment(d.node);
}

// Include a doc comment that sits directly above the node, the way the engine's anchors do.
function withLeadingComment(node) {
  let start = node.startIndex;
  let prev = node.previousNamedSibling;
  while (prev && prev.type === 'comment' && onlyWhitespaceBetween(prev.endIndex, start)) {
    start = prev.startIndex;
    prev = prev.previousNamedSibling;
  }
  return source.slice(start, node.endIndex);
}

function onlyWhitespaceBetween(a, b) {
  const gap = source.slice(a, b);
  return /^\s*$/.test(gap) && (gap.match(/\n/g) || []).length <= 1;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderSource(ranges) {
  // Non-overlapping marks, target first.
  const clean = [];
  const sorted = ranges.slice().sort((a, b) => a.s - b.s);
  for (const r of sorted) {
    if (clean.some((c) => r.s < c.e && r.e > c.s)) {
      // overlap: keep the target (cls '') over deps
      if (r.cls === '') { for (let i = clean.length - 1; i >= 0; i--) if (r.s < clean[i].e && r.e > clean[i].s) clean.splice(i, 1); clean.push(r); }
      continue;
    }
    clean.push(r);
  }
  clean.sort((a, b) => a.s - b.s);
  let html = '';
  let pos = 0;
  for (const r of clean) {
    html += esc(source.slice(pos, r.s));
    html += '<mark' + (r.cls ? ' class="' + r.cls + '"' : '') + '>' + esc(source.slice(r.s, r.e)) + '</mark>';
    pos = r.e;
  }
  html += esc(source.slice(pos));
  ui.src.innerHTML = html;
}

function renderOutput(slice) {
  let html = '';
  for (const p of slice.parts) {
    if (p.code !== undefined) html += esc(p.code) + '\n';
    else if (p.sub) html += '<span class="dim">// ' + esc(p.hdr) + '</span>\n';
    else html += '\n<span class="hdr">// ── ' + esc(p.hdr) + ' ' + '─'.repeat(Math.max(4, 52 - p.hdr.length)) + '</span>\n';
  }
  ui.out.innerHTML = html.replace(/^\n/, '');
}

function scrollSourceTo(row) {
  const pre = ui.src;
  const lh = parseFloat(getComputedStyle(pre).lineHeight) || 18;
  const top = Math.max(0, row * lh - lh * 3);
  if (Math.abs(pre.scrollTop - top) > 4) pre.scrollTo({ top, behavior: 'smooth' });
}

const est = (bytes) => Math.round(bytes / 3.5);
function tokenLabel(bytes) {
  return '≈ <b>' + est(bytes).toLocaleString() + '</b> tokens · ' + (bytes / 1024).toFixed(1) + ' KB';
}

if (root) boot();
