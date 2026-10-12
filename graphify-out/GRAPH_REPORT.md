# Graph Report - adb-glass-sentinel  (2026-10-12)

## Corpus Check
- 16 files · ~445,555 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 774 nodes · 1476 edges · 39 communities (28 shown, 8 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 34 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3ba4a0ae`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- _
- ks
- AdbSentinelService
- ar
- U
- .multiply
- q
- zt
- V
- tn
- pt
- .z
- W
- .intersectMeshes
- ji
- sr
- ke
- le
- .addAttribute
- .sub
- AdbLogStreamer
- app.js
- AdbSystemController
- ct
- zs
- vt
- build_and_install.sh
- j
- gradlew
- oe
- ue
- .copy
- shaders.js
- 🛡️ ADB Glass Sentinel
- AdbSocketTracker
- adb_sentinel_daemon.sh

## God Nodes (most connected - your core abstractions)
1. `_` - 208 edges
2. `requestAnimationFrame()` - 39 edges
3. `U` - 35 edges
4. `V` - 33 edges
5. `getOptimizedDPR()` - 31 edges
6. `resize()` - 29 edges
7. `ks` - 25 edges
8. `tn` - 23 edges
9. `W` - 19 edges
10. `sr()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `MainActivity` --references--> `AdbSentinelService`  [EXTRACTED]
  app/src/main/java/com/mateuscelestino/adbsentinel/MainActivity.kt → app/src/main/java/com/mateuscelestino/adbsentinel/AdbSentinelService.kt

## Import Cycles
- None detected.

## Communities (39 total, 8 thin omitted)

### Community 0 - "_"
Cohesion: 0.04
Nodes (41): _, ae(), at, bs(), ce(), dt, Ei, Et (+33 more)

### Community 1 - "ks"
Cohesion: 0.10
Nodes (3): ge(), ks, me()

### Community 2 - "AdbSentinelService"
Cohesion: 0.05
Nodes (19): AdbSentinelService, IBinder, LocalBinder, AndroidBridge, MainActivity, WebChromeClient, WebViewClient, OnBackPressedCallback (+11 more)

### Community 3 - "ar"
Cohesion: 0.09
Nodes (7): ar, dr(), kt(), mr, pr(), Ut(), yr

### Community 4 - "U"
Cohesion: 0.05
Nodes (16): ai(), ci(), di(), gi(), hi(), ii(), li(), mi() (+8 more)

### Community 6 - "q"
Cohesion: 0.06
Nodes (11): As(), br, en, gr, K, kr, nr, q (+3 more)

### Community 7 - "zt"
Cohesion: 0.11
Nodes (11): be(), gt, Ie(), Ne(), nn(), rn, l(), zr (+3 more)

### Community 8 - "V"
Cohesion: 0.09
Nodes (3): De(), qi(), V

### Community 9 - "tn"
Cohesion: 0.14
Nodes (7): fr(), A(), E(), m(), p(), ns(), tn

### Community 10 - "pt"
Cohesion: 0.10
Nodes (8): bi(), _i(), pt, Se(), Si(), Ti(), vi(), zi()

### Community 11 - ".z"
Cohesion: 0.06
Nodes (7): cs, Gs(), Hs(), is, qs(), Xs(), Ys()

### Community 12 - "W"
Cohesion: 0.07
Nodes (11): Ds(), Fs(), it, on, or, pn, rr, St (+3 more)

### Community 13 - ".intersectMeshes"
Cohesion: 0.18
Nodes (3): cr, Ee(), ki()

### Community 15 - "sr"
Cohesion: 0.21
Nodes (7): sr(), C(), et(), L(), N(), tt(), xs()

### Community 16 - "ke"
Cohesion: 0.15
Nodes (4): er, ke, we(), xe()

### Community 20 - "AdbLogStreamer"
Cohesion: 0.23
Nodes (4): AdbLogStreamer, AdbShellCommandEvent, Context, ParsedTimestampInfo

### Community 21 - "app.js"
Cohesion: 0.14
Nodes (14): applyAccentColor(), createLogCardElement(), escapeHtml(), fetchActiveDevices(), fetchAdbStatus(), formatRelativeTime(), hexToRgb(), loadHistoryModalData() (+6 more)

### Community 22 - "AdbSystemController"
Cohesion: 0.23
Nodes (6): AdbSystemController, AuthorizedKeyInfo, Context, IBinder, Method, Parcel

### Community 23 - "ct"
Cohesion: 0.29
Nodes (3): ct(), fi(), ve

### Community 24 - "zs"
Cohesion: 0.33
Nodes (3): bt(), Tt(), zs

### Community 25 - "vt"
Cohesion: 0.33
Nodes (3): Es(), Ms(), vt()

### Community 26 - "build_and_install.sh"
Cohesion: 0.33
Nodes (5): ANDROID_HOME, BUILD_TOOLS, JAVA_HOME, PATH, build_and_install.sh script

### Community 27 - "j"
Cohesion: 0.33
Nodes (4): v(), j(), tr, R()

### Community 28 - "gradlew"
Cohesion: 0.70
Nodes (4): gradlew script, die(), save(), warn()

### Community 34 - ".copy"
Cohesion: 0.15
Nodes (4): he(), Ot, ri(), ye()

### Community 35 - "shaders.js"
Cohesion: 0.06
Nodes (59): buildStrandsPalette(), easePower2InOut(), getOptimizedDPR(), hexToRgb(), hexToRgbArr(), initAntigravity(), initAurora(), initBalatro() (+51 more)

### Community 36 - "🛡️ ADB Glass Sentinel"
Cohesion: 0.29
Nodes (6): 🛡️ ADB Glass Sentinel, 🏗️ Arquitetura do Sistema, 🔒 Auditoria de Segurança & Permissões, 👤 Autor, 📦 Binários e Instalação, 🌟 Funcionalidades Principais

### Community 38 - "AdbSocketTracker"
Cohesion: 0.28
Nodes (3): AdbConnection, AdbSocketTracker, Context

## Knowledge Gaps
- **41 isolated node(s):** `adb_sentinel_daemon.sh script`, `fe`, `pe`, `Ei`, `J` (+36 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 200 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_` connect `_` to `ks`, `ar`, `U`, `.multiply`, `q`, `zt`, `V`, `tn`, `pt`, `.z`, `W`, `.intersectMeshes`, `ji`, `sr`, `ke`, `le`, `.addAttribute`, `.sub`, `ct`, `zs`, `vt`, `j`, `oe`, `ue`, `.copy`, `shaders.js`?**
  _High betweenness centrality (0.524) - this node is a cross-community bridge._
- **Why does `V` connect `V` to `_`, `.copy`, `shaders.js`, `zt`, `.z`, `W`, `.intersectMeshes`, `ji`, `sr`, `.sub`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Why does `ks` connect `ks` to `_`, `shaders.js`, `q`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **What connects `adb_sentinel_daemon.sh script`, `fe`, `pe` to the rest of the system?**
  _41 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `_` be split into smaller, more focused modules?**
  _Cohesion score 0.041742286751361164 - nodes in this community are weakly interconnected._
- **Should `ks` be split into smaller, more focused modules?**
  _Cohesion score 0.09879032258064516 - nodes in this community are weakly interconnected._
- **Should `AdbSentinelService` be split into smaller, more focused modules?**
  _Cohesion score 0.0546448087431694 - nodes in this community are weakly interconnected._