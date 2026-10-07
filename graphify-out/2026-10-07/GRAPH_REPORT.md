# Graph Report - adb-glass-sentinel  (2026-10-07)

## Corpus Check
- 16 files · ~403,169 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 678 nodes · 1219 edges · 41 communities (25 shown, 12 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5871644d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- _
- ks
- AdbSentinelService
- ar
- U
- AndroidBridge
- q
- zt
- V
- tn
- pt
- .z
- W
- .intersectMeshes
- MainActivity
- sr
- ke
- le
- .addAttribute
- .scale
- AdbLogStreamer
- app.js
- .sub
- ct
- zs
- vt
- build_and_install.sh
- j
- gradlew
- oe
- ue
- .copy
- initShader
- 🛡️ ADB Glass Sentinel
- .multiply
- .lookAt
- adb_sentinel_daemon.sh

## God Nodes (most connected - your core abstractions)
1. `_` - 207 edges
2. `U` - 35 edges
3. `V` - 32 edges
4. `ks` - 24 edges
5. `tn` - 23 edges
6. `sr()` - 19 edges
7. `ar` - 19 edges
8. `W` - 18 edges
9. `pt` - 17 edges
10. `ke` - 17 edges

## Surprising Connections (you probably didn't know these)
- `MainActivity` --references--> `AdbSentinelService`  [EXTRACTED]
  app/src/main/java/com/mateuscelestino/adbsentinel/MainActivity.kt → app/src/main/java/com/mateuscelestino/adbsentinel/AdbSentinelService.kt

## Import Cycles
- None detected.

## Communities (41 total, 12 thin omitted)

### Community 0 - "_"
Cohesion: 0.04
Nodes (41): _, ae(), at, bs(), ce(), dt, Ei, Et (+33 more)

### Community 1 - "ks"
Cohesion: 0.06
Nodes (8): br, ge(), K, kr, ks, me(), nr, zr

### Community 2 - "AdbSentinelService"
Cohesion: 0.12
Nodes (9): AdbSentinelService, IBinder, LocalBinder, AdbConnection, AdbSocketTracker, Binder, Intent, Notification (+1 more)

### Community 3 - "ar"
Cohesion: 0.09
Nodes (7): ar, dr(), kt(), mr, pr(), Ut(), yr

### Community 4 - "U"
Cohesion: 0.05
Nodes (16): ai(), ci(), di(), gi(), hi(), ii(), li(), mi() (+8 more)

### Community 5 - "AndroidBridge"
Cohesion: 0.10
Nodes (6): AdbSystemController, AuthorizedKeyInfo, IBinder, AndroidBridge, Context, Parcel

### Community 6 - "q"
Cohesion: 0.09
Nodes (7): As(), en, gr, q, sn, Vr(), ze

### Community 7 - "zt"
Cohesion: 0.11
Nodes (11): be(), gt, Ie(), Ne(), nn(), or, rn, l() (+3 more)

### Community 8 - "V"
Cohesion: 0.09
Nodes (4): De(), ji(), qi(), V

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
Cohesion: 0.08
Nodes (10): Ds(), Fs(), it, on, pn, rr, St, un (+2 more)

### Community 14 - "MainActivity"
Cohesion: 0.14
Nodes (11): MainActivity, WebChromeClient, WebViewClient, OnBackPressedCallback, AppCompatActivity, Bundle, ConsoleMessage, WebResourceRequest (+3 more)

### Community 15 - "sr"
Cohesion: 0.21
Nodes (7): sr(), C(), et(), L(), N(), tt(), xs()

### Community 16 - "ke"
Cohesion: 0.19
Nodes (4): er, ke, we(), xe()

### Community 19 - ".scale"
Cohesion: 0.31
Nodes (3): he(), Lt, ur()

### Community 21 - "app.js"
Cohesion: 0.16
Nodes (9): applyAccentColor(), createLogCardElement(), escapeHtml(), fetchActiveDevices(), fetchAdbStatus(), hexToRgb(), loadHistoryModalData(), renderActiveDevices() (+1 more)

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

### Community 36 - "🛡️ ADB Glass Sentinel"
Cohesion: 0.29
Nodes (6): 🛡️ ADB Glass Sentinel, 🏗️ Arquitetura do Sistema, 🔒 Auditoria de Segurança & Permissões, 👤 Autor, 📦 Binários e Instalação, 🌟 Funcionalidades Principais

## Knowledge Gaps
- **39 isolated node(s):** `adb_sentinel_daemon.sh script`, `fe`, `pe`, `Ei`, `J` (+34 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 175 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_` connect `_` to `ks`, `ar`, `U`, `q`, `zt`, `V`, `tn`, `pt`, `.z`, `W`, `.intersectMeshes`, `sr`, `ke`, `le`, `.addAttribute`, `.scale`, `.sub`, `ct`, `zs`, `vt`, `j`, `oe`, `ue`, `.copy`, `.multiply`, `.constructor`, `.lookAt`?**
  _High betweenness centrality (0.551) - this node is a cross-community bridge._
- **Why does `ks` connect `ks` to `_`, `q`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `V` connect `V` to `_`, `.copy`, `.constructor`, `zt`, `.z`, `.intersectMeshes`, `sr`, `.scale`, `.sub`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **What connects `adb_sentinel_daemon.sh script`, `fe`, `pe` to the rest of the system?**
  _39 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `_` be split into smaller, more focused modules?**
  _Cohesion score 0.041742286751361164 - nodes in this community are weakly interconnected._
- **Should `ks` be split into smaller, more focused modules?**
  _Cohesion score 0.05660377358490566 - nodes in this community are weakly interconnected._
- **Should `AdbSentinelService` be split into smaller, more focused modules?**
  _Cohesion score 0.11724137931034483 - nodes in this community are weakly interconnected._