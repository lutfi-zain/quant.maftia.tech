## REMOVED Requirements

### Requirement: Causal Composite Rescaling
**Reason**: Replaced by rolling 1460-day causal window to prevent pre-institutional data from contaminating modern percentiles.
**Migration**: Use the new `rolling-causal-rescaler` capability.
