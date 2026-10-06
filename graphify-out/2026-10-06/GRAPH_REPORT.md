# Graph Report - adb-glass-sentinel  (2026-10-06)

## Corpus Check
- 14 files · ~425,990 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 657 nodes · 1196 edges · 37 communities (26 shown, 8 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `37da0d74`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- _
- ks
- AdbSentinelService
- ar
- U
- AdbSystemController
- q
- zt
- V
- tn
- pt
- .z
- it
- .intersectMeshes
- W
- sr
- ke
- le
- .addAttribute
- .copy
- AdbLogStreamer
- app.js
- .sub
- ct
- zs
- vt
- build_and_install.sh
- .constructor
- gradlew
- oe
- ue
- AdbSocketTracker
- initShader
- li

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

## Communities (37 total, 8 thin omitted)

### Community 0 - "_"
Cohesion: 0.04
Nodes (41): _, ae(), at, bs(), ce(), dt, Ei, Et (+33 more)

### Community 1 - "ks"
Cohesion: 0.10
Nodes (3): ge(), ks, me()

### Community 2 - "AdbSentinelService"
Cohesion: 0.06
Nodes (18): AdbSentinelService, IBinder, LocalBinder, AndroidBridge, MainActivity, WebChromeClient, WebViewClient, AppCompatActivity (+10 more)

### Community 3 - "ar"
Cohesion: 0.08
Nodes (7): ar, dr(), kt(), mr, pr(), Ut(), yr

### Community 4 - "U"
Cohesion: 0.05
Nodes (17): ai(), ci(), di(), _e(), gi(), hi(), ii(), mi() (+9 more)

### Community 5 - "AdbSystemController"
Cohesion: 0.23
Nodes (5): AdbSystemController, AuthorizedKeyInfo, IBinder, Context, Parcel

### Community 6 - "q"
Cohesion: 0.07
Nodes (11): As(), br, p(), gr, K, kr, nr, q (+3 more)

### Community 7 - "zt"
Cohesion: 0.11
Nodes (11): be(), gt, Ie(), Ne(), nn(), or, l(), zr (+3 more)

### Community 8 - "V"
Cohesion: 0.09
Nodes (3): De(), qi(), V

### Community 9 - "tn"
Cohesion: 0.15
Nodes (6): fr(), A(), E(), m(), ns(), tn

### Community 10 - "pt"
Cohesion: 0.07
Nodes (9): bi(), en, _i(), pt, Se(), Si(), sn, Ti() (+1 more)

### Community 11 - ".z"
Cohesion: 0.08
Nodes (4): Gs(), Hs(), qs(), Xs()

### Community 12 - "it"
Cohesion: 0.15
Nodes (3): Ds(), it, St

### Community 13 - ".intersectMeshes"
Cohesion: 0.20
Nodes (3): cr, ki(), j()

### Community 14 - "W"
Cohesion: 0.07
Nodes (11): cs, Fs(), is, on, pn, rn, rr, un (+3 more)

### Community 15 - "sr"
Cohesion: 0.21
Nodes (7): sr(), C(), et(), L(), N(), tt(), xs()

### Community 16 - "ke"
Cohesion: 0.13
Nodes (5): er, ji(), ke, we(), xe()

### Community 19 - ".copy"
Cohesion: 0.17
Nodes (4): he(), Ot, ri(), ye()

### Community 21 - "app.js"
Cohesion: 0.33
Nodes (6): escapeHtml(), fetchActiveDevices(), fetchAdbStatus(), loadHistoryModalData(), renderActiveDevices(), updateUiWithStatus()

### Community 22 - ".sub"
Cohesion: 0.25
Nodes (3): Ee(), Lt, ur()

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
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 160 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_` connect `_` to `ks`, `ar`, `U`, `q`, `zt`, `V`, `tn`, `pt`, `.z`, `it`, `.intersectMeshes`, `W`, `sr`, `ke`, `le`, `.addAttribute`, `.copy`, `.sub`, `ct`, `zs`, `vt`, `.constructor`, `oe`, `ue`, `li`?**
  _High betweenness centrality (0.587) - this node is a cross-community bridge._
- **Why does `ks` connect `ks` to `_`, `q`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Why does `V` connect `V` to `_`, `ar`, `zt`, `.intersectMeshes`, `W`, `sr`, `ke`, `.copy`, `.sub`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **What connects `fe`, `pe`, `Ei` to the rest of the system?**
  _33 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `_` be split into smaller, more focused modules?**
  _Cohesion score 0.041742286751361164 - nodes in this community are weakly interconnected._
- **Should `ks` be split into smaller, more focused modules?**
  _Cohesion score 0.09659090909090909 - nodes in this community are weakly interconnected._
- **Should `AdbSentinelService` be split into smaller, more focused modules?**
  _Cohesion score 0.05827067669172932 - nodes in this community are weakly interconnected._