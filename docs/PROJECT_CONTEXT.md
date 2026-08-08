# AthleSense KIUH Edition — Project Context

## Status
- Current production/service version: the repository currently used by the user.
- Functional specification baseline: **AthleSense 全機能一覧 v4.1**.
- Repository: `chkr128-glitch/Kiuh-tfsprinters-mens-conditioning`
- Primary branch: `main`
- Development branch prepared by the user: `docs/ai-development-foundation`

## Purpose
AthleSense is a conditioning-management web application for a track-and-field sprint team. It records pre/post-practice subjective and objective condition data, calculates training/conditioning indicators, provides athlete-facing feedback, and provides coach/admin analytics.

## Main surfaces
1. Athlete application: `index.html`
2. Admin application: `admin.html`
3. Athlete PWA manifest: `manifest.json`
4. Admin PWA manifest: `manifest-admin.json`
5. Service Worker: `sw.js`

## Functional baseline
The v4.1 specification is the source of truth for intended functionality. Existing implementation must not be silently redesigned to match generic best practices.

## AI advice
The product intentionally calls its rule-based recommendation functions “AI advice”. This is accepted product terminology. Do not treat the rule-based implementation as a defect unless the user explicitly requests an LLM-based implementation.

## Current implementation characteristics
- Plain HTML/CSS/JavaScript architecture.
- Firebase Authentication and Cloud Firestore.
- Athlete and admin surfaces are separate HTML applications.
- PWA-related files are present.
- Charting and confetti libraries are loaded from CDNs in the athlete application.
- Weather functionality uses browser geolocation and an external weather service.
- Service-worker functionality exists and must be considered when modifying PWA/notification behavior.

## Development principle
Preserve the existing service first. New features should be additive and minimally invasive unless the user explicitly authorizes refactoring.

## Evidence policy
This document records facts established from the current repository and the v4.1 specification. Where the exact schema or implementation detail has not yet been fully verified, it must be marked as “to verify” rather than guessed.
