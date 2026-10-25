# Final submission: field-by-field paste guide

Prepared 25 October 2026, Singapore time. This is copy for the entrant to paste; no portal fields were changed or final submission made.

Update the [existing project 126704](https://innovationstudio.microsoft.com/hackathons/insidethegamedeveloperhackathon/project/126704), not a duplicate. Click **Show all page details** to expose its sections, then each section's Edit control.

## Fields confirmed in the live portal

| Field | Exact value / action |
| --- | --- |
| Title | `Why That Goal? — See the Play Behind the Finish` |
| Tagline | `See the play behind the finish. Microsoft Foundry agents turn synthetic football events into reviewed narratives, automatic recaps and cinematic 3D replays—with clickable pitch evidence and a producer workspace.` |
| Keywords | Select the existing suggested tags **Explainable AI**, **Microsoft Foundry**, **Football Analytics**. These are tag selections, not a single semicolon-separated text value. |
| Description | Replace the old description with the entire contents of [submission-description.md](submission-description.md). Paste Markdown source. It includes the demo, repository, category evidence, limits and judge instructions. |
| Challenge | Keep **The Synthetic Match Insights Engine for Premier League Studio** (5078). |
| Writing Code | **Yes** |
| Code Repository | `https://github.com/mk-tdev/why-that-goal` |
| Open for others to join | **No**, retaining the existing closed recruitment. |
| Skills Needed | Leave empty/not applicable while recruitment is closed. |
| Team | Retain the actual entrant/team. Currently one owner and no other members; only add real eligible team members. |
| Images/Video | Use **Edit video or images → Manage video manually → Choose video** for the final MP4 if uploading directly. One video maximum; the dialog recommends 16:9 and English audio. Also supply the required public-host URL in the description as below. |
| Images | Prefer an actual product screenshot such as `docs/screenshots/deployed-replay.png` or `docs/screenshots/judge-agent-evidence.png` over the current concept artwork. No fabricated UI or metrics. |

Title: 47 characters. Tagline: 211 characters. Both fit the previously observed limits of 140 and 300 respectively. No description character limit was displayed in the editor inspected today.

The portal still showed the old **Current stage: in development** description and an empty Code Repository field at this review. These need saving even though the actual app and repository exist.

## Final public video

The entrant has uploaded the final video. Use this exact line after the app/source links (already included in `submission-description.md`):

```text
**Demo video (1 minute 50 seconds):** https://www.youtube.com/watch?v=qVZuNPllBsk
```

The video opened in the browser and YouTube displayed 1:50. Confirm playback in a genuinely signed-out session before final submission; existing tested browser sessions were signed in. The portal also offers direct file upload, but keep the public-host URL in the description. No local file path belongs in that field.

The silent picture master and timed script remain available in [video instructions](demo-video.md); the entrant's uploaded final version supersedes those local editing deliverables for submission.

## Categories: what to select if the portal asks

A separate prize-category selector was **not** visible in the inspected project sections or Manage project menu. The **Challenge** field is not a prize-category selector. Do not create duplicate entries for the three categories.

If a later form offers multiple categories, choose **Best Use of Microsoft Foundry**, **Best Multi-Agent System / Multi-Agent Orchestration**, and **Best Enterprise Solution**, using its exact labels. If it permits one only, prioritize **Best Use of Microsoft Foundry**. The description already supplies evidence for all three. Judges decide category fit; custom orchestration is disclosed, not described as officially pre-approved.

If separate category-justification fields appear, use these optional blocks. They are not additional confirmed portal fields.

### Foundry justification

Microsoft Foundry powers the application's evidence selection, narrative generation and semantic review through the deployed wtg-insights model. Typed contracts, versioned facts, citation validation, bounded revisions and labeled fallback connect model output to clickable 3D replay evidence. Managed identity protects server-side inference; caching and useful event checkpoints constrain repeated calls. Judges can inspect actual role handoffs and recorded evaluations in the public application. We use Foundry model inference with custom TypeScript coordination, not Foundry Agent Service or native Foundry tracing/evaluation services.

### Multi-agent justification

A match analyst selects grounded findings, a storyteller drafts the audience-specific story, and a reviewer audits all narrative targets against the full shared snapshot. Explicit handoffs carry facts and concrete corrections. One targeted revision returns to review; unresolved errors withhold AI text. In a recorded false-save test, structural checks accepted the draft's shape but the reviewer identified the wrong outcome and required a successful repair. This demonstrates a distinct review gate, with published latency/token tradeoffs and limited synthetic evidence. All roles use the same Foundry deployment through custom TypeScript orchestration.

### Enterprise justification

The deployed Azure Container Apps prototype combines scoped managed identity, server-side inference, caller rate limits, bounded concurrency and budgets, validated evidence contracts, health checks, sanitized audits and inspectable monitoring. A producer can trace the event-to-story path and manually take a reviewed graphic to air. The public workspace deliberately has no sign-in hurdle. The adoption plan explicitly addresses tenant isolation, shared state, persistent alerts, private identity verification, data rights and production load targets. These are demonstrable enterprise foundations and a pilot path, not a production certification or measured business ROI claim.

## What is still pending

1. **Uploaded video:** https://www.youtube.com/watch?v=qVZuNPllBsk is provided and displays 1:50. Final signed-out playback check remains pending.
2. **Copy the public video link into the portal** along with the finished description; hosting itself is done.
3. **Save the portal updates**: description, tagline, repository, media/video link, and optionally replace concept art with a product screenshot. Reopen the saved page and verify each value.
4. **Final access check**: app and repository public; video plays without permission requests; Foundry runs or clearly labels cache/fallback; test a goal, save and failed attack. Ensure demo quotas still allow judges to complete that path. Current deployment and judging reports were refreshed after the quota-recovery and notice fixes; see `docs/judging-readiness.md` for scope and limitations.
5. **Entrant declarations**: confirm eligibility, actual team, original ownership/data and asset rights, open-source license compliance, no disqualifying prior prize or support, and any required terms. The dependency notice audit is now documented in `THIRD_PARTY_NOTICES.md`; it does not attest to personal ownership or every external asset right. Personal attestations remain the entrant's responsibility.
6. **Complete the portal's final workflow before the deadline** and retain its confirmation. No separate Submit button was visible in the inspected project page or Manage project menu (Change log / Clone / Delete only); check any event-specific instructions before claiming submission is complete.
7. **Keep free judge access available through judging**, including adequate Azure/Foundry budget and working resource permissions.

Submission closes **28 October 2026 at 2:59 PM Singapore** (27 October, 11:59 PM Pacific daylight time). Judging ends **11 November 2026 at 3:59 PM Singapore** (10 November, 11:59 PM Pacific standard time). Finish earlier than the cutoff. Source: [official rules §§1, 4.4 and 4.8](https://github.com/microsoft/insidethegamehackathon/blob/main/OFFICIAL%20RULES.md).

## Evidence and scope of this preparation

Re-read the official rules and inspected project 126704, its description editor, media dialog and Manage project menu on 25 October 2026. No values were saved. Claims were checked against the public source documentation and recorded deployment, multi-agent and enterprise reports. The live Foundry evaluations were not rerun for this writing task.

For independent inspection: [agent design and recorded recovery](multi-agent.md), [enterprise controls and gaps](enterprise-readiness.md), [deployment verification](evaluations/deployment.json), [40-check report](evaluations/enterprise.json), [four-case live report](evaluations/enterprise-live.json), [judging review](judging-review.md), [video instructions](demo-video.md).
