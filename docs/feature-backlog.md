# Feature backlog and ownership

| Feature group | Priority | Owner | Acceptance outcome |
|---|---|---|---|
| Text+voice, accessible input/status | P0 | Revati (UI), Ramya (ASR) | transcribed/typed task matches intent; no-mouse navigation |
| Intent, structured DAG planning | P0 | Ramya | valid plan/action allowlist, no dependency cycles |
| Durable task state, audit journal | P0 | Ramya (+ Yukta DB infrastructure) | survives restart; plan versions maintained |
| Gateway, auth, service/event infrastructure | P0 | Yukta | accessible APIs, contracts, authenticated event channel |
| Portal DOM + Calendar API | P0 | Disha | read and write on controlled mock/test systems |
| Verification and uncertain-write policy | P0 | Disha | no false done or blind duplicate write |
| Pause/resume and approval | P0 | Ramya/Disha/Revati by interface | paused dispatch; scoped authorization |
| Spoken mid-task correction and selective replan | P1 | Ramya + Revati | preserve unrelated verified steps |
| API→DOM fallback + compensation | P1 | Disha | no duplicate writes under S4 and S7 |
| Local/cloud model routing | P1 | Yukta | empirical quality/cost/latency trade-off |
| Visual GUI real model | P2 | Disha | grounded supported-page benchmark |
| Full duplex and mobile app | P2 | Ramya/Revati | separately evaluated after MVP |
| Kubernetes/production observability | P2 | Yukta | only after measurable need |

Definitions: P0 means minimal integrated demo; P1 research differentiators; P2 stretch. This is the **proposed** final split for team approval, not evidence of work already completed.
