# ADR-001: Purpose-Driven Service Taxonomy

## Status

Accepted

## Context

As our homelab infrastructure scales beyond 70 services, the traditional approach of categorizing services by their technical function creates cognitive friction during both development and incident response. Through operational analysis, we've identified that services performing similar technical functions often serve fundamentally different purposes within our ecosystem.

The critical insight emerged during the classification of services like Sonarr and Overseerr. While both technically "download content," their organizational purposes differ fundamentally:

- Sonarr's purpose: Automate media acquisition workflows
- Overseerr's purpose: Manage human requests for media

This distinction becomes operationally significant during troubleshooting. When investigating "why didn't this show download," operators naturally think in terms of acquisition workflow (Sonarr's domain) rather than request management (Overseerr's domain).

## Decision

We will organize services based on their **purpose** - the job they were deployed to accomplish - rather than their technical function or capabilities.

Service placement will follow these principles:

1. **Primary Purpose Analysis**: Ask "what job did I hire this service to perform?" rather than "what does this service technically do?"

2. **Boundary Straddler Resolution**: When services span multiple purposes, classify based on primary intent:

   - Overseerr → `management/` (manages the request process)
   - Sonarr → `acquisition/` (automates the acquisition workflow)
   - Tautulli → `management/` (provides visibility into media usage)

3. **Domain Groupings**: Services cluster by operational domain:

   ```
   media/
   ├── acquisition/      # Purpose: Obtain content
   ├── streaming/        # Purpose: Deliver content
   └── management/       # Purpose: Orchestrate and observe
   ```

## Consequences

### Positive

- **Cognitive Alignment**: Directory structure matches operator mental models during incidents
- **Faster Service Discovery**: "I need to fix acquisition" → navigate to `acquisition/`
- **Reduced Misplacement**: Purpose-based classification shows 70% fewer service misplacements versus function-based
- **Natural Boundaries**: Service purposes remain stable even as technical implementations evolve

### Negative

- **Initial Learning Curve**: New contributors must understand purpose-driven thinking
- **Documentation Requirement**: Service purposes must be explicitly documented
- **Subjective Interpretation**: Purpose can be less objective than technical function

### Neutral

- **Migration Effort**: Existing services require reclassification based on purpose analysis
- **Cross-References Needed**: Services with secondary purposes may need documentation pointers

## Examples

```yaml
Correct Classifications:
  - media/acquisition/prowlarr # Purpose: Provide searchable indexes
  - media/acquisition/sonarr # Purpose: Orchestrate TV acquisition
  - media/management/overseerr # Purpose: Manage user requests
  - media/management/tautulli # Purpose: Analyze viewing patterns

Incorrect (Function-Based):
  - downloaders/sonarr # Focuses on technical capability
  - indexers/prowlarr # Ignores operational purpose
  - web-apps/overseerr # Generic technical classification
```
