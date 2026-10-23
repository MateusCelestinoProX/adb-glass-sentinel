# Graph Report - adb-glass-sentinel  (2026-10-22)

## Corpus Check
- 19 files · ~449,644 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 844 nodes · 1629 edges · 62 communities (31 shown, 28 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6ad06418`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- _
- ks
- AndroidBridge
- ar
- U
- .multiply
- K
- zt
- V
- tn
- q
- .z
- W
- .intersectMeshes
- ji
- sr
- ke
- le
- .addAttribute
- .sub
- it
- app.js
- AdbSystemController
- ct
- zs
- vt
- build_and_install.sh
- WebcamStreamServer
- gradlew
- oe
- ue
- .copy
- shaders.js
- 🛡️ ADB Glass Sentinel
- MainActivity
- AdbSentinelService
- AdbSocketTracker
- adb_sentinel_daemon.sh
- SamsungDeXController
- j
- WebChromeClient
- AudioStreamManager
- en
- gr
- .x
- St
- .add
- .applyMatrix4
- bs
- .getTranslation
- gi
- hi
- ii
- ni
- oi
- Rt
- pi
- Re
- Te

## God Nodes (most connected - your core abstractions)
1. `_` - 208 edges
2. `requestAnimationFrame()` - 39 edges
3. `U` - 35 edges
4. `V` - 33 edges
5. `getOptimizedDPR()` - 31 edges
6. `resize()` - 29 edges
7. `ks` - 25 edges
8. `tn` - 23 edges
9. `AndroidBridge` - 23 edges
10. `WebcamStreamServer` - 22 edges

## Surprising Connections (you probably didn't know these)
- `MainActivity` --references--> `AdbSentinelService`  [EXTRACTED]
  app/src/main/java/com/mateuscelestino/adbsentinel/MainActivity.kt → app/src/main/java/com/mateuscelestino/adbsentinel/AdbSentinelService.kt

## Import Cycles
- None detected.

## Communities (62 total, 28 thin omitted)

### Community 0 - "_"
Cohesion: 0.05
Nodes (36): _, at, ce(), dt, Ei, Et, fe, ft (+28 more)

### Community 3 - "ar"
Cohesion: 0.08
Nodes (8): ar, dr(), kt(), mr, Ot, pr(), Ut(), yr

### Community 4 - "U"
Cohesion: 0.09
Nodes (7): ai(), di(), li(), mi(), ri(), U, xi()

### Community 6 - "K"
Cohesion: 0.09
Nodes (10): be(), br, gt, K, kr, nr, l(), zr (+2 more)

### Community 7 - "zt"
Cohesion: 0.24
Nodes (4): Ie(), Ne(), or, zt

### Community 8 - "V"
Cohesion: 0.09
Nodes (3): De(), qi(), V

### Community 9 - "tn"
Cohesion: 0.15
Nodes (6): fr(), A(), E(), m(), ns(), tn

### Community 10 - "q"
Cohesion: 0.21
Nodes (4): p(), q, ze, zi()

### Community 11 - ".z"
Cohesion: 0.06
Nodes (6): cs, Gs(), Hs(), qs(), Xs(), Ys()

### Community 12 - "W"
Cohesion: 0.05
Nodes (16): bi(), Fs(), _i(), is, on, pn, pt, rn (+8 more)

### Community 13 - ".intersectMeshes"
Cohesion: 0.18
Nodes (3): cr, Ee(), ki()

### Community 15 - "sr"
Cohesion: 0.19
Nodes (8): nn(), sr(), C(), et(), L(), N(), tt(), xs()

### Community 16 - "ke"
Cohesion: 0.17
Nodes (4): er, ke, we(), xe()

### Community 21 - "app.js"
Cohesion: 0.13
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
Cohesion: 0.40
Nodes (4): BUILD_TOOLS, JAVA_HOME, PATH, build_and_install.sh script

### Community 27 - "WebcamStreamServer"
Cohesion: 0.08
Nodes (18): AdbLogStreamer, AdbShellCommandEvent, Context, ParsedTimestampInfo, ByteArray, Context, ServerSocket, Socket (+10 more)

### Community 28 - "gradlew"
Cohesion: 0.70
Nodes (4): gradlew script, die(), save(), warn()

### Community 34 - ".copy"
Cohesion: 0.20
Nodes (3): he(), ui(), ye()

### Community 35 - "shaders.js"
Cohesion: 0.06
Nodes (59): buildStrandsPalette(), easePower2InOut(), getOptimizedDPR(), hexToRgb(), hexToRgbArr(), initAntigravity(), initAurora(), initBalatro() (+51 more)

### Community 36 - "🛡️ ADB Glass Sentinel"
Cohesion: 0.29
Nodes (6): 🛡️ ADB Glass Sentinel, 🏗️ Arquitetura do Sistema, 🔒 Auditoria de Segurança & Permissões, 👤 Autor, 📦 Binários e Instalação, 🌟 Funcionalidades Principais

### Community 37 - "MainActivity"
Cohesion: 0.17
Nodes (9): MainActivity, WebViewClient, OnBackPressedCallback, AppCompatActivity, Bundle, WebResourceRequest, WebResourceResponse, WebView (+1 more)

### Community 38 - "AdbSentinelService"
Cohesion: 0.15
Nodes (6): AdbSentinelService, IBinder, LocalBinder, Binder, Notification, Service

### Community 39 - "AdbSocketTracker"
Cohesion: 0.25
Nodes (3): AdbConnection, AdbSocketTracker, Context

### Community 41 - "SamsungDeXController"
Cohesion: 0.32
Nodes (5): Context, ServerSocket, Socket, SamsungDeXController, Intent

### Community 42 - "j"
Cohesion: 0.33
Nodes (4): v(), j(), tr, R()

### Community 44 - "AudioStreamManager"
Cohesion: 0.33
Nodes (5): AudioStreamManager, ByteArray, Context, ServerSocket, Socket

### Community 46 - "gr"
Cohesion: 0.29
Nodes (3): As(), gr, Vr()

## Knowledge Gaps
- **40 isolated node(s):** `adb_sentinel_daemon.sh script`, `fe`, `pe`, `Ei`, `J` (+35 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 198 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **28 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_` connect `_` to `ks`, `ar`, `U`, `.multiply`, `K`, `zt`, `V`, `tn`, `q`, `.z`, `W`, `.intersectMeshes`, `ji`, `sr`, `ke`, `le`, `.addAttribute`, `.sub`, `it`, `ct`, `zs`, `vt`, `oe`, `ue`, `.copy`, `shaders.js`, `j`, `en`, `gr`, `.x`, `St`, `.add`, `.applyMatrix4`, `bs`, `.getTranslation`, `gi`, `hi`, `ii`, `ni`, `oi`, `Rt`, `pi`, `Re`, `Te`?**
  _High betweenness centrality (0.440) - this node is a cross-community bridge._
- **Why does `V` connect `V` to `_`, `.copy`, `ar`, `shaders.js`, `K`, `zt`, `.z`, `.intersectMeshes`, `ji`, `sr`, `.sub`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `ks` connect `ks` to `_`, `shaders.js`, `K`, `q`, `.x`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **What connects `adb_sentinel_daemon.sh script`, `fe`, `pe` to the rest of the system?**
  _40 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `_` be split into smaller, more focused modules?**
  _Cohesion score 0.04653061224489796 - nodes in this community are weakly interconnected._
- **Should `ks` be split into smaller, more focused modules?**
  _Cohesion score 0.14624505928853754 - nodes in this community are weakly interconnected._
- **Should `AndroidBridge` be split into smaller, more focused modules?**
  _Cohesion score 0.14492753623188406 - nodes in this community are weakly interconnected._