# Graph Report - adb-glass-sentinel  (2026-10-06)

## Corpus Check
- 14 files · ~179,202 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 652 nodes · 1194 edges · 34 communities (25 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- _
- ks
- AdbSentinelService
- ar
- U
- AndroidBridge
- q
- W
- V
- tn
- pt
- .z
- it
- .intersectMeshes
- .update
- sr
- ke
- le
- .addAttribute
- .copy
- AdbLogStreamer
- app.js
- .scale
- ct
- zs
- vt
- build_and_install.sh
- .constructor
- gradlew
- oe
- ue

## God Nodes (most connected - your core abstractions)
1. `_` - 208 edges
2. `U` - 35 edges
3. `V` - 32 edges
4. `ks` - 26 edges
5. `tn` - 23 edges
6. `W` - 19 edges
7. `sr()` - 19 edges
8. `ar` - 19 edges
9. `pt` - 17 edges
10. `ke` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Renderer` --inherits--> `ks`  [EXTRACTED]
  app/src/main/assets/web/js/shaders.js → app/src/main/assets/web/js/ogl.js
- `MainActivity` --references--> `AdbSentinelService`  [EXTRACTED]
  app/src/main/java/com/mateuscelestino/adbsentinel/MainActivity.kt → app/src/main/java/com/mateuscelestino/adbsentinel/AdbSentinelService.kt

## Import Cycles
- None detected.

## Communities (34 total, 6 thin omitted)

### Community 0 - "_"
Cohesion: 0.04
Nodes (41): _, ae(), at, bs(), ce(), dt, Ei, Et (+33 more)

### Community 1 - "ks"
Cohesion: 0.05
Nodes (10): br, ge(), K, kr, ks, me(), nr, zr (+2 more)

### Community 2 - "AdbSentinelService"
Cohesion: 0.08
Nodes (16): AdbSentinelService, IBinder, LocalBinder, AdbConnection, AdbSocketTracker, MainActivity, WebChromeClient, WebViewClient (+8 more)

### Community 3 - "ar"
Cohesion: 0.08
Nodes (8): ar, dr(), kt(), mr, Ot, pr(), Ut(), yr

### Community 4 - "U"
Cohesion: 0.05
Nodes (17): ai(), ci(), di(), _e(), gi(), hi(), ii(), li() (+9 more)

### Community 5 - "AndroidBridge"
Cohesion: 0.10
Nodes (6): AdbSystemController, AuthorizedKeyInfo, IBinder, AndroidBridge, Context, Parcel

### Community 6 - "q"
Cohesion: 0.09
Nodes (7): As(), en, gr, q, sn, Vr(), ze

### Community 7 - "W"
Cohesion: 0.09
Nodes (13): be(), gt, Ie(), Ne(), on, or, rn, l() (+5 more)

### Community 8 - "V"
Cohesion: 0.08
Nodes (4): De(), ji(), qi(), V

### Community 9 - "tn"
Cohesion: 0.14
Nodes (7): fr(), A(), E(), m(), p(), ns(), tn

### Community 10 - "pt"
Cohesion: 0.08
Nodes (9): bi(), _i(), pn, pt, Se(), Si(), Ti(), vi() (+1 more)

### Community 11 - ".z"
Cohesion: 0.08
Nodes (4): Gs(), Hs(), qs(), Xs()

### Community 12 - "it"
Cohesion: 0.17
Nodes (3): Ds(), it, St

### Community 13 - ".intersectMeshes"
Cohesion: 0.17
Nodes (3): cr, Ee(), ki()

### Community 14 - ".update"
Cohesion: 0.12
Nodes (5): cs, Fs(), is, rr, Ys()

### Community 15 - "sr"
Cohesion: 0.14
Nodes (11): he(), nn(), sr(), C(), et(), j(), L(), N() (+3 more)

### Community 16 - "ke"
Cohesion: 0.17
Nodes (4): er, ke, we(), xe()

### Community 19 - ".copy"
Cohesion: 0.20
Nodes (3): ri(), ui(), ye()

### Community 21 - "app.js"
Cohesion: 0.33
Nodes (6): escapeHtml(), fetchActiveDevices(), fetchAdbStatus(), loadHistoryModalData(), renderActiveDevices(), updateUiWithStatus()

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

### Community 27 - ".constructor"
Cohesion: 0.40
Nodes (3): v(), tr, R()

### Community 28 - "gradlew"
Cohesion: 0.70
Nodes (4): gradlew script, die(), save(), warn()

## Knowledge Gaps
- **33 isolated node(s):** `fe`, `pe`, `Ei`, `J`, `H` (+28 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 157 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_` connect `_` to `ks`, `ar`, `U`, `q`, `W`, `V`, `tn`, `pt`, `.z`, `it`, `.intersectMeshes`, `.update`, `sr`, `ke`, `le`, `.addAttribute`, `.copy`, `.scale`, `ct`, `zs`, `vt`, `.constructor`, `oe`, `ue`?**
  _High betweenness centrality (0.605) - this node is a cross-community bridge._
- **Why does `ks` connect `ks` to `_`, `q`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `V` connect `V` to `_`, `ar`, `W`, `.intersectMeshes`, `.update`, `sr`, `.copy`, `.scale`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **What connects `fe`, `pe`, `Ei` to the rest of the system?**
  _33 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `_` be split into smaller, more focused modules?**
  _Cohesion score 0.041742286751361164 - nodes in this community are weakly interconnected._
- **Should `ks` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._
- **Should `AdbSentinelService` be split into smaller, more focused modules?**
  _Cohesion score 0.07729468599033816 - nodes in this community are weakly interconnected._