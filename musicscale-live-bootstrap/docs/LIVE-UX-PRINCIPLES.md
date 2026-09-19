# MusicScale Live — UX operating principles

These rules are product invariants, not provider-specific styling. Holyrics, ProPresenter, Resolume and future adapters must fit the same operator mental model.

## 1. Spatial invariant: NOW → NEXT

On landscape/desktop surfaces:

**left = what is truly on air now**  
**right = what is prepared to happen next**

The direction must never be reversed by a provider integration.

On narrow mobile screens the same order becomes vertical:

**NOW first → NEXT second**

This preserves the left-to-right / top-to-bottom reading flow and removes the need for the operator to reinterpret the interface during a service.

## 2. Observed truth vs operator intent

The NOW side is derived from provider-observed state whenever the provider exposes it. It is not allowed to optimistically pretend an action happened before the provider accepted/observed it.

The NEXT side represents operator intent. Selecting a slide, visual clip, scene or media cue prepares it; an explicit **TAKE** commits the transition where a safe preview/prepare boundary is possible.

Direct-fire actions remain possible only for actions whose provider semantics do not support a meaningful preview boundary.

## 3. TAKE is the commit boundary

TAKE must be visually stable and located on the NEXT side.

- routine Take: one action;
- guarded/destructive action: explicit confirmation;
- critical action: blocked unless policy enables it.

The user should never need to hunt for the button that makes NEXT become NOW.

## 4. Same mental model across content types

The model applies to:

- song slides;
- Bible slides;
- text and announcements;
- video/image/audio cues;
- Resolume clips/layers;
- ProPresenter presentations;
- scenes combining multiple providers;
- future stage/broadcast outputs.

The provider may differ; the operator model does not.

## 5. Live mode is not a dashboard

During a service the interface removes non-operational information. Live mode prioritizes:

1. NOW / NEXT;
2. Run of Show;
3. contextual tools;
4. provider/output health;
5. guarded recovery controls.

Configuration, billing, organization management and verbose diagnostics belong in Studio/setup surfaces.

## 6. Progressive disclosure

Only capabilities actually declared by connected providers appear.

A Holyrics-only church should not see dead Resolume controls. A Resolume installation should gain visual controls without changing the presentation workflow.

## 7. Visual confirmation beats text where available

When a provider can supply a real slide/output preview, show it. Text is the fallback, not the primary representation.

High-cost preview images are fetched only when the presented frame changes or when the operator explicitly requests them. Health polling must remain lightweight.

## 8. Safe by default

Visual clips use prepare/arm → TAKE rather than immediate fire by default.

Clearing program, layers, all visuals or other destructive actions require a guarded confirmation when the consequence is broad.

## 9. Provider names stay secondary

The operator should think in terms of:

- NOW;
- NEXT;
- TAKE;
- song;
- Bible;
- media;
- visuals;
- stage;
- output.

Names such as F8/F9/F10, REST endpoint paths or provider-specific internal terminology belong inside adapters and diagnostics.

## 10. Recovery must preserve the mental model

If cloud/Firebase disappears, the Local Recovery UI keeps the same NOW → NEXT orientation and the same command semantics. Losing internet must not force the operator to learn a second interface during a service.


## 11. Prepare before TAKE is the default

Selecting content should not unexpectedly put it on air.

The following actions prepare the NEXT side first:

- a song selected from provider search;
- a Bible reference;
- an image/video/audio item;
- the next compatible item from Run of Show;
- a visual clip;
- a multi-provider linked cue.

The operator then commits the prepared intent through the same TAKE boundary.

Exceptions must be explicit and justified by provider semantics. Search results are not “fire buttons”.

## 12. Multi-provider ambiguity is a setup problem, never a live gamble

When exactly one provider supports a route group, routing is automatic.

When two or more providers can own the same function, MusicScale Live requires an explicit primary route. It must not broadcast a routine presentation command to multiple providers or silently choose one based on registration order.

The Studio topology should expose the resulting system graph. The local Node setup owns route mutation so service-time tablets cannot accidentally change infrastructure.

## 13. Reduce duplication before adding controls

A preview should have one authoritative visual home.

For example, a Resolume output snapshot belongs on the left NOW surface. Output selection is a utility control; it must not create a second competing large preview below the operator deck.

The same rule applies as more providers are added: new capability does not automatically justify a new dashboard card.
