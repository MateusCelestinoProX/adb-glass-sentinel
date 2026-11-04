# Graph Report - adb-glass-sentinel  (2026-11-03)

## Corpus Check
- 20 files · ~451,789 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 876 nodes · 1722 edges · 59 communities (29 shown, 27 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 36 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `904bea16`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- _
- ks
- AndroidBridge
- ar
- U
- AdbLogStreamer
- tn
- q
- V
- it
- K
- .z
- pt
- .constructor
- .x
- sr
- ke
- le
- .addAttribute
- .scale
- gr
- app.js
- AdbSystemController
- ct
- zs
- vt
- build_and_install.sh
- SentinelGuardian
- gradlew
- oe
- ue
- .copy
- shaders.js
- 🛡️ ADB Glass Sentinel
- BootReceiver.kt
- AdbSentinelService
- AdbSocketTracker
- adb_sentinel_daemon.sh
- AudioStreamManager
- en
- W
- .getRenderList
- .sub
- zt
- rr
- .update
- ji
- .intersectMeshes
- Ot
- St
- .draw
- Fs
- .constructor
- De
- .copy
- qi

## God Nodes (most connected - your core abstractions)
1. `_` - 208 edges
2. `requestAnimationFrame()` - 39 edges
3. `U` - 35 edges
4. `V` - 33 edges
5. `getOptimizedDPR()` - 31 edges
6. `AudioStreamManager` - 31 edges
7. `resize()` - 29 edges
8. `AndroidBridge` - 27 edges
9. `ks` - 25 edges
10. `AdbSentinelService` - 24 edges

## Surprising Connections (you probably didn't know these)
- `MainActivity` --references--> `AdbSentinelService`  [EXTRACTED]
  app/src/main/java/com/mateuscelestino/adbsentinel/MainActivity.kt → app/src/main/java/com/mateuscelestino/adbsentinel/AdbSentinelService.kt

## Import Cycles
- None detected.

## Communities (59 total, 27 thin omitted)

### Community 0 - "_"
Cohesion: 0.04
Nodes (41): _, ae(), at, bs(), ce(), dt, Ei, Et (+33 more)

### Community 2 - "AndroidBridge"
Cohesion: 0.05
Nodes (17): AndroidBridge, MainActivity, WebChromeClient, WebViewClient, OnBackPressedCallback, Context, ServerSocket, Socket (+9 more)

### Community 3 - "ar"
Cohesion: 0.09
Nodes (7): ar, dr(), kt(), mr, pr(), Ut(), yr

### Community 4 - "U"
Cohesion: 0.04
Nodes (19): ai(), ci(), di(), _e(), gi(), hi(), ii(), li() (+11 more)

### Community 5 - "AdbLogStreamer"
Cohesion: 0.23
Nodes (4): AdbLogStreamer, AdbShellCommandEvent, Context, ParsedTimestampInfo

### Community 6 - "tn"
Cohesion: 0.14
Nodes (7): fr(), A(), E(), m(), p(), ns(), tn

### Community 10 - "K"
Cohesion: 0.21
Nodes (3): br, K, kr

### Community 11 - ".z"
Cohesion: 0.07
Nodes (5): Gs(), Hs(), qs(), Xs(), Ys()

### Community 12 - "pt"
Cohesion: 0.10
Nodes (8): bi(), _i(), pt, Se(), Si(), Ti(), vi(), zi()

### Community 15 - "sr"
Cohesion: 0.21
Nodes (7): sr(), C(), et(), L(), N(), tt(), xs()

### Community 16 - "ke"
Cohesion: 0.17
Nodes (3): er, ke, we()

### Community 20 - "gr"
Cohesion: 0.29
Nodes (3): As(), gr, Vr()

### Community 21 - "app.js"
Cohesion: 0.12
Nodes (17): applyAccentColor(), createLogCardElement(), escapeHtml(), fetchActiveDevices(), fetchAdbStatus(), formatRelativeTime(), hexToRgb(), loadHistoryModalData() (+9 more)

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

### Community 27 - "SentinelGuardian"
Cohesion: 0.29
Nodes (3): GuardianIncident, Context, SentinelGuardian

### Community 28 - "gradlew"
Cohesion: 0.70
Nodes (4): gradlew script, die(), save(), warn()

### Community 34 - ".copy"
Cohesion: 0.20
Nodes (4): v(), he(), j(), ye()

### Community 35 - "shaders.js"
Cohesion: 0.06
Nodes (59): buildStrandsPalette(), easePower2InOut(), getOptimizedDPR(), hexToRgb(), hexToRgbArr(), initAntigravity(), initAurora(), initBalatro() (+51 more)

### Community 36 - "🛡️ ADB Glass Sentinel"
Cohesion: 0.29
Nodes (6): 🛡️ ADB Glass Sentinel, 🏗️ Arquitetura do Sistema, 🔒 Auditoria de Segurança & Permissões, 👤 Autor, 📦 Binários e Instalação, 🌟 Funcionalidades Principais

### Community 37 - "BootReceiver.kt"
Cohesion: 0.53
Nodes (4): BootReceiver, Context, Intent, BroadcastReceiver

### Community 38 - "AdbSentinelService"
Cohesion: 0.14
Nodes (7): AdbSentinelService, IBinder, Intent, LocalBinder, Binder, Notification, Service

### Community 39 - "AdbSocketTracker"
Cohesion: 0.25
Nodes (3): AdbConnection, AdbSocketTracker, Context

### Community 41 - "AudioStreamManager"
Cohesion: 0.12
Nodes (14): android, AudioJitterBuffer, AudioStreamManager, Context, ServerSocket, Socket, SpeakerAudioSession, AudioManager (+6 more)

### Community 43 - "W"
Cohesion: 0.18
Nodes (4): on, rn, un, W

### Community 46 - "zt"
Cohesion: 0.15
Nodes (9): be(), gt, Ie(), Ne(), nn(), l(), h(), l() (+1 more)

## Knowledge Gaps
- **40 isolated node(s):** `adb_sentinel_daemon.sh script`, `fe`, `pe`, `Ei`, `J` (+35 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 202 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_` connect `_` to `ks`, `ar`, `U`, `tn`, `q`, `V`, `it`, `K`, `.z`, `pt`, `.constructor`, `.x`, `sr`, `ke`, `le`, `.addAttribute`, `.scale`, `gr`, `ct`, `zs`, `vt`, `oe`, `ue`, `.copy`, `shaders.js`, `en`, `W`, `.getRenderList`, `.sub`, `zt`, `rr`, `.update`, `ji`, `.intersectMeshes`, `Ot`, `St`, `.draw`, `Fs`, `.constructor`, `De`, `.copy`, `qi`?**
  _High betweenness centrality (0.409) - this node is a cross-community bridge._
- **Why does `V` connect `V` to `_`, `.copy`, `shaders.js`, `.constructor`, `.sub`, `sr`, `zt`, `ji`, `.intersectMeshes`, `.scale`, `De`, `qi`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `ks` connect `ks` to `_`, `shaders.js`, `q`, `K`, `.getRenderList`, `.x`, `.update`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **What connects `adb_sentinel_daemon.sh script`, `fe`, `pe` to the rest of the system?**
  _40 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `_` be split into smaller, more focused modules?**
  _Cohesion score 0.041742286751361164 - nodes in this community are weakly interconnected._
- **Should `AndroidBridge` be split into smaller, more focused modules?**
  _Cohesion score 0.05480769230769231 - nodes in this community are weakly interconnected._
- **Should `ar` be split into smaller, more focused modules?**
  _Cohesion score 0.08858858858858859 - nodes in this community are weakly interconnected._